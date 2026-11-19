// Reads a workout card from a photo or a PDF and transcribes it as plain text, one exercise per line, in the
// format the app's own parser (src/lib/planning/custom-workout.ts) understands. The client shows the text for
// review before anything is saved, so a misread number can be fixed by the person.
import { createAnthropicClient, WORKOUT_CARD_MODEL } from '../_shared/anthropic-client.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

type RequestBody = { base64: string; mediaType: string; /** What the file is: a workout card (default) or a diet. */ kind?: 'training' | 'diet' };

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Base64 of ~6 MB of file: enough for a scanned card, small enough for the function's request limit.
const MAX_BASE64_LENGTH = 8_000_000;

const SYSTEM_PROMPT = `Trascrivi una scheda di allenamento (foto, screenshot o PDF) in testo semplice, senza inventare nulla.

Formato di uscita, ESATTAMENTE questo:
- una riga per ogni giorno o sessione: "Lunedì - Titolo" (usa i nomi dei giorni se la scheda li ha, altrimenti "Giorno 1 - Titolo", "Giorno 2 - Titolo"...). Un giorno di riposo: "Martedì - Riposo". Se la scheda è fatta di tabelle senza titolo, ogni tabella è un giorno: "Giorno 1", "Giorno 2"... e come titolo i muscoli allenati se sono evidenti (es. "Giorno 1 - Gambe").
- sotto, una riga per esercizio: "Nome esercizio SERIExRIPETIZIONI rec 90s tempo 3-1-1"
  - SERIExRIPETIZIONI come scritto (4x8, 3x10-12, 4x6/8/10, 4x10+10+max); le piramidi restano come scritte ("2x20 10 8 8 12", "10 8 8 15"); se mancano le serie scrivi solo il nome (es. "Addome").
  - "per gamba" / "per braccio" se la scheda lo indica ("x gamba" → "per gamba").
  - "rec" solo se la scheda indica il recupero, in secondi (90s) o minuti (2 min). In una colonna REC un numero senza unità da 1 a 5 sono minuti ("1" → "rec 1 min"); "45se", "45''" sono secondi ("rec 45s").
  - Abbreviazioni scritte per esteso: "man" → manubri, "MP" → multipower, "ext" → extension, "mov." → movimento.
  - "tempo" solo se la scheda indica i tempi di esecuzione (eccentrica-pausa-concentrica, es. 3-1-1, 303 → 3-0-3, 3010 → 3-0-1); se sono uguali per tutta la scheda scrivi una riga "Tempo: 3-1-1" all'inizio.
- Superserie o circuiti: un esercizio per riga, nello stesso ordine.
- Note, carichi in kg (colonna KG), intestazioni delle colonne, nome, cognome, data, logo e slogan: ignorali. Non trascrivere esercizi barrati o illeggibili inventandoli.
Rispondi in italiano, solo con la trascrizione. Se non vedi una scheda di allenamento, rispondi con una stringa vuota.`;

const DIET_SYSTEM_PROMPT = `Trascrivi una dieta o un piano alimentare (foto, screenshot o PDF) in testo semplice, senza inventare nulla.

Formato di uscita, ESATTAMENTE questo:
- se la dieta distingue i giorni, una riga con il nome del giorno ("Lunedì", "Martedì"...) prima dei suoi pasti; se è uguale tutti i giorni non scrivere giorni. Giorni numerati ("Giorno 1", "Giorno 2"...) diventano Lunedì, Martedì...
- se la dieta è una tabella con i giorni in colonna (o i pasti in colonna), riscrivila giorno per giorno: prima tutto il Lunedì, poi tutto il Martedì, e così via.
- una riga per ogni pasto, usando SOLO questi nomi: "Colazione", "Spuntino mattina", "Pranzo", "Spuntino pomeriggio", "Cena", "Spuntino sera" (uno snack, un pre o post allenamento diventa lo spuntino della sua fascia; aggiungi l'orario solo se indicato: "Colazione ore 7:30").
- sotto, una riga per alimento: "Nome alimento QUANTITÀ" con la quantità dopo il nome (80g, 200 ml, 2 uova, 1 cucchiaio): "g 80 pasta" diventa "Pasta 80g". Gli alimenti senza quantità ("verdure a piacere", "q.b.") restano così come scritti.
- Se un pasto offre alternative ("oppure", "in alternativa", opzione A/B), trascrivi solo la prima.
- Totali, calorie, intestazioni, nome del professionista o del paziente: ignorali.
- Note, integratori, consigli e altro che non sia giorno/pasto/alimento/quantità: ignorali.
Rispondi in italiano, solo con la trascrizione. Se non vedi una dieta, rispondi con una stringa vuota.`;

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

    const { base64, mediaType, kind } = (await req.json()) as RequestBody;
    const isDiet = kind === 'diet';
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
      system: isDiet ? DIET_SYSTEM_PROMPT : SYSTEM_PROMPT,
      // deno-lint-ignore no-explicit-any
      output_config: { format: { type: 'json_schema', schema: SCHEMA } } as any,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: isDiet ? 'Trascrivi la dieta.' : 'Trascrivi la scheda.' }] as never }],
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
