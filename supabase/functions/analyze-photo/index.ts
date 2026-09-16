// On-demand, per-photo vision analysis — deliberately NOT run automatically
// on every photo view (cost/latency), unlike generate-insights. The client
// only calls this when the user explicitly asks for it. Looks at the actual
// pixels (posture, visible muscle definition/symmetry, and a comparison
// against the previous same-pose photo if one is given) grounded with the
// real body_metrics deltas for those two dates, so the model never has to
// guess numbers it can instead just be told.
import { createAnthropicClient, PHOTO_ANALYSIS_MODEL } from '../_shared/anthropic-client.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

type RequestBody = { photoId: string; previousPhotoId?: string };

const BUCKET = 'progress-photos';

const SYSTEM_PROMPT = `Sei un coach fitness che osserva una foto di progresso fisico caricata dall'utente stesso.
Commenta SOLO aspetti rilevanti per l'allenamento: postura, definizione muscolare visibile, simmetria, tono
generale — e se viene fornita una foto precedente per confronto, le differenze visibili tra le due. Usa un tono
professionale, di supporto, mai giudicante sull'aspetto fisico. Non dare consigli medici e non fare diagnosi. Se
i dati quantitativi forniti (peso, girovita, massa grassa) sono disponibili, integrali nell'osservazione invece di
ripeterli a parte. Se non vedi cambiamenti significativi, dillo onestamente invece di inventarne uno. Rispondi in
italiano, massimo 3-4 frasi.`;

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    observation: { type: 'string' },
  },
  required: ['observation'],
  additionalProperties: false,
};

type PhotoRow = { id: string; date: string; pose: string; storage_path: string };

async function loadPhoto(supabase: ReturnType<typeof createUserScopedClient>, photoId: string): Promise<PhotoRow> {
  const { data, error } = await supabase.from('body_photos').select('id, date, pose, storage_path').eq('id', photoId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Photo not found: ${photoId}`);
  return data as PhotoRow;
}

async function downloadAsBase64(supabase: ReturnType<typeof createUserScopedClient>, storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw error;
  const buffer = new Uint8Array(await data.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) binary += String.fromCharCode(buffer[i]);
  return btoa(binary);
}

async function metricsNear(supabase: ReturnType<typeof createUserScopedClient>, date: string) {
  const { data } = await supabase
    .from('body_metrics')
    .select('date, weight_kg, waist_cm, body_fat_pct')
    .lte('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function describeMetrics(label: string, m: Awaited<ReturnType<typeof metricsNear>>): string {
  if (!m) return `${label}: nessuna misurazione disponibile.`;
  const parts = [
    m.weight_kg != null ? `peso ${m.weight_kg}kg` : null,
    m.waist_cm != null ? `girovita ${m.waist_cm}cm` : null,
    m.body_fat_pct != null ? `massa grassa ${m.body_fat_pct}%` : null,
  ].filter(Boolean);
  return `${label} (misurazione del ${m.date}): ${parts.length > 0 ? parts.join(', ') : 'nessun dato numerico'}.`;
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createUserScopedClient(req);
    await getAuthenticatedUser(supabase);

    const { photoId, previousPhotoId } = (await req.json()) as RequestBody;
    if (!photoId) throw new Error('Missing photoId');

    const photo = await loadPhoto(supabase, photoId);
    const previous = previousPhotoId ? await loadPhoto(supabase, previousPhotoId) : null;

    const [photoBase64, previousBase64, latestMetrics, previousMetrics] = await Promise.all([
      downloadAsBase64(supabase, photo.storage_path),
      previous ? downloadAsBase64(supabase, previous.storage_path) : Promise.resolve(null),
      metricsNear(supabase, photo.date),
      previous ? metricsNear(supabase, previous.date) : Promise.resolve(null),
    ]);

    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: `Foto attuale (${photo.date}, posa: ${photo.pose}). ${describeMetrics('Dati corpo attuali', latestMetrics)}` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 } },
    ];
    if (previous && previousBase64) {
      content.push(
        { type: 'text', text: `Foto precedente nella stessa posa (${previous.date}). ${describeMetrics('Dati corpo alla foto precedente', previousMetrics)}` },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: previousBase64 } }
      );
    }

    const anthropic = createAnthropicClient();
    const response = await anthropic.messages.create({
      model: PHOTO_ANALYSIS_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      // deno-lint-ignore no-explicit-any
      output_config: { format: { type: 'json_schema', schema: ANALYSIS_SCHEMA } } as any,
      messages: [{ role: 'user', content: content as never }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`No text response (stop_reason: ${response.stop_reason})`);
    }
    const { observation } = JSON.parse(textBlock.text) as { observation: string };

    return jsonResponse({ observation });
  } catch (err) {
    console.error('analyze-photo function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
