// Reads a workout card from a photo or a PDF and transcribes it as plain text, one exercise per line, in the
// format the app's own parser (src/lib/planning/custom-workout.ts) understands. The client shows the text for
// review before anything is saved, so a misread number can be fixed by the person.
import { createAnthropicClient, WORKOUT_CARD_MODEL } from '../_shared/anthropic-client.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

type RequestBody = { base64: string; mediaType: string };

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Base64 of ~6 MB of file: enough for a scanned card, small enough for the function's request limit.
const MAX_BASE64_LENGTH = 8_000_000;

const SYSTEM_PROMPT = `Trascrivi una scheda di allenamento (foto, screenshot o PDF) in testo semplice, senza inventare nulla.

Formato di uscita, ESATTAMENTE questo:
- una riga per ogni giorno o sessione: "Lunedì - Titolo" (usa i nomi dei giorni se la scheda li ha, altrimenti "Giorno A - Titolo", "Giorno B - Titolo"...). Un giorno di riposo: "Martedì - Riposo".
- sotto, una riga per esercizio: "Nome esercizio SERIExRIPETIZIONI rec 90s tempo 3-1-1"
  - SERIExRIPETIZIONI come scritto (4x8, 3x10-12, 4x6/8/10); se mancano le serie scrivi solo il nome.
  - "rec" solo se la scheda indica il recupero, in secondi (90s) o minuti (2 min).
  - "tempo" solo se la scheda indica i tempi di esecuzione (eccentrica-pausa-concentrica, es. 3-1-1 o 3010 → 3-0-1); se sono uguali per tutta la scheda scrivi una riga "Tempo: 3-1-1" all'inizio.
- Superserie o circuiti: un esercizio per riga, nello stesso ordine.
- Note, carichi in kg e altro che non sia giorno/esercizio/serie/recupero/tempo: ignorali.
Rispondi in italiano, solo con la trascrizione. Se non vedi una scheda di allenamento, rispondi con una stringa vuota.`;

const SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
  additionalProperties: false,
};

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  try {
    const supabase = createUserScopedClient(req);
    await getAuthenticatedUser(supabase);

    const { base64, mediaType } = (await req.json()) as RequestBody;
    if (!base64 || !mediaType) throw new Error('Missing file');
    if (base64.length > MAX_BASE64_LENGTH) throw new Error('File troppo grande');
    const isPdf = mediaType === 'application/pdf';
    if (!isPdf && !IMAGE_TYPES.includes(mediaType)) throw new Error('Formato non supportato');

    const fileBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

    const anthropic = createAnthropicClient();
    const response = await anthropic.messages.create({
      model: WORKOUT_CARD_MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      // deno-lint-ignore no-explicit-any
      output_config: { format: { type: 'json_schema', schema: SCHEMA } } as any,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: 'Trascrivi la scheda.' }] as never }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error(`No text response (stop_reason: ${response.stop_reason})`);
    const { text } = JSON.parse(textBlock.text) as { text: string };
    return jsonResponse({ text: text.trim() });
  } catch (err) {
    console.error('extract-workout-card function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
