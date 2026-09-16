import { SPECIALIST_MODEL } from '../anthropic-client.ts';
import { getBodyContext } from './body-data.ts';
import type { AgentRunContext } from './types.ts';

const SYSTEM_PROMPT = `Sei il coach AI di FITBRO per corpo e progressi. Rispondi in italiano, in modo breve e onesto,
basandoti SOLO sui dati reali forniti (peso, misure, obiettivo). Se mancano abbastanza dati per rispondere con
sicurezza, dillo chiaramente invece di inventare un trend.`;

export async function runBodyProgressAgent(ctx: AgentRunContext, question: string): Promise<string> {
  const body = await getBodyContext(ctx.supabase);

  const dataBlock = `Dati reali dell'utente (da Postgres, RLS-scoped):
- Obiettivo: ${body.profile?.goal ?? 'sconosciuto'}, peso target: ${body.profile?.targetWeightKg ?? 'sconosciuto'} kg
- Numero di misurazioni registrate: ${body.entryCount}
- Ultima misurazione: ${JSON.stringify(body.latest)}
- Variazione peso (30gg): ${body.weightDelta30d ?? 'n/d'} kg
- Variazione girovita (30gg): ${body.waistDelta30d ?? 'n/d'} cm
- Variazione massa grassa (30gg): ${body.bodyFatDelta30d ?? 'n/d'} punti%`;

  const response = await ctx.anthropic.messages.create({
    model: SPECIALIST_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${dataBlock}\n\nDomanda: ${question}` }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : 'Non sono riuscito a formulare una risposta su corpo e progressi.';
}
