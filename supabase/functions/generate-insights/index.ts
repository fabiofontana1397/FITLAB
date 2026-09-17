// Replaces src/lib/mock/progress.ts's hardcoded, non-data-grounded
// `insights` array (it references untracked things like sleep/running pace
// that don't correspond to any real tracked feature). This function only
// ever hands the model data that's actually real, so it structurally
// cannot invent an untracked metric the way the old static copy did.
import { createAnthropicClient, INSIGHTS_MODEL } from '../_shared/anthropic-client.ts';
import { getBodyContext } from '../_shared/agents/body-data.ts';
import type { ClientContext } from '../_shared/agents/types.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

type RequestBody = { clientContext?: ClientContext };
type Insight = { tone: 'positive' | 'warning' | 'neutral'; headline: string; body: string };

const SYSTEM_PROMPT = `Sei il coach AI di FITLAB. Genera 3-4 brevi "insight" motivazionali in italiano per la home
dell'utente, basandoti SOLO sui dati reali forniti — non inventare mai metriche non presenti nei dati (es. sonno,
passi, ritmo di corsa) se non sono esplicitamente inclusi. Se un dominio (corpo, nutrizione, allenamento) non ha
abbastanza dati per un insight affidabile, ometti quel dominio invece di inventare un trend.

Rispondi SOLO con un array JSON valido, nessun altro testo, in questo formato esatto:
[{"tone":"positive"|"warning"|"neutral","headline":"...","body":"..."}]`;

function buildDataBlock(body: Awaited<ReturnType<typeof getBodyContext>>, clientContext: ClientContext): string {
  const parts = [
    `Corpo: ${body.entryCount} misurazioni registrate. Variazione peso (30gg): ${body.weightDelta30d ?? 'n/d'} kg. ` +
      `Variazione girovita (30gg): ${body.waistDelta30d ?? 'n/d'} cm. Variazione massa grassa (30gg): ${body.bodyFatDelta30d ?? 'n/d'} punti%. ` +
      `Obiettivo: ${body.profile?.goal ?? 'sconosciuto'}, peso target: ${body.profile?.targetWeightKg ?? 'sconosciuto'} kg.`,
  ];
  if (clientContext.nutritionToday) {
    const n = clientContext.nutritionToday;
    parts.push(
      `Nutrizione oggi: ${n.kcalEaten}/${n.kcalTarget} kcal, proteine ${n.proteinEatenG}/${n.proteinTargetG} g, streak di logging ${n.loggingStreakDays} giorni.`
    );
  }
  if (clientContext.trainingAdherence14d) {
    const t = clientContext.trainingAdherence14d;
    parts.push(`Allenamento: ${t.done}/${t.planned} sessioni pianificate completate negli ultimi 14 giorni.`);
  }
  return parts.join('\n');
}

function parseInsights(text: string): Insight[] {
  const jsonStart = text.indexOf('[');
  const jsonEnd = text.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('Model did not return a JSON array');
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  if (!Array.isArray(parsed)) throw new Error('Parsed result is not an array');
  return parsed.filter(
    (item): item is Insight =>
      item &&
      typeof item.headline === 'string' &&
      typeof item.body === 'string' &&
      ['positive', 'warning', 'neutral'].includes(item.tone)
  );
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createUserScopedClient(req);
    const user = await getAuthenticatedUser(supabase);
    const { clientContext = {} } = (await req.json().catch(() => ({}))) as RequestBody;

    const body = await getBodyContext(supabase);
    const dataBlock = buildDataBlock(body, clientContext);

    const anthropic = createAnthropicClient();
    const response = await anthropic.messages.create({
      model: INSIGHTS_MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: dataBlock }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    const insights = parseInsights(textBlock && textBlock.type === 'text' ? textBlock.text : '[]');

    // Insights are a current snapshot, not accumulating history —
    // delete-then-insert per user on every generation.
    const { error: deleteError } = await supabase.from('coach_insights').delete().eq('user_id', user.id);
    if (deleteError) throw deleteError;

    if (insights.length === 0) {
      return jsonResponse({ insights: [] });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('coach_insights')
      .insert(insights.map((i) => ({ user_id: user.id, tone: i.tone, headline: i.headline, body: i.body })))
      .select('id, tone, headline, body, generated_at');
    if (insertError) throw insertError;

    return jsonResponse({ insights: inserted });
  } catch (err) {
    console.error('generate-insights function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
