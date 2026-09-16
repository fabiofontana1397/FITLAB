// Produces the METHODOLOGICAL decisions behind a user's diet/training plan
// (split choice, set/rep scheme, calorie/macro periodization, phase focus
// notes) grounded in the two reference PDFs (RAG) plus authoritative
// sources on the open web (Claude's native web_search tool — no separate
// search vendor/key needed). Deliberately does NOT generate the full
// meal-by-meal/exercise-by-exercise plan: src/lib/planning/{diet,training}-planner.ts
// still assembles that mechanically from the app's own food-database/
// exercise-library, so a hallucinated food or exercise id can never reach
// the plan. Every field here is optional from the client's point of view —
// src/store/plan-store.ts falls back to today's deterministic tables
// per-field when a field (or the whole call) is missing, so this is purely
// additive, never a hard dependency for onboarding to complete.
import { createAnthropicClient, ORCHESTRATOR_MODEL } from '../_shared/anthropic-client.ts';
import { formatChunksForPrompt, retrieveKnowledge } from '../_shared/agents/rag.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

type RequestBody = {
  answers: Record<string, unknown>;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  durationMonths: number;
};

// A curated allowlist biases the native web_search tool toward evidence-based,
// reputable fitness/nutrition sources rather than arbitrary blog content —
// this is what makes the result "referenced and authoritative," not just
// "whatever ranks first."
const AUTHORITATIVE_DOMAINS = [
  'examine.com',
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'nih.gov',
  'who.int',
  'acsm.org',
  'nsca.com',
  'issn.net',
  'eatright.org',
  'strongerbyscience.com',
];

const SYSTEM_PROMPT = `Sei un esperto di personal training e nutrizione. Il tuo compito è decidere la METODOLOGIA di un
piano di allenamento/alimentazione (non i singoli pasti o esercizi, che vengono assemblati altrove da un catalogo
reale) per un utente specifico, basandoti SOLO su:
1. Il contesto di riferimento fornito (estratti dalle due guide interne)
2. Ricerche autorevoli che puoi fare tramite lo strumento di ricerca web (preferisci fonti scientifiche/evidence-based)
3. Il profilo dell'utente fornito

Nella "rationale" cita in 2-3 frasi le fonti/studi reali su cui ti sei basato — non un saggio. Nei campi
"focusNote" sii specifico e concreto (volume, intensità, motivazione fisiologica) ma stringato: massimo 2 frasi
brevi per mese, non un paragrafo. Se il profilo non prevede allenamento in palestra/corsa imposta "training" a
null; se non serve un piano alimentare imposta "diet" a null. "splitLabels" deve usare ESCLUSIVAMENTE i valori
"Full Body", "Upper", "Lower", "Push", "Pull", "Legs" (uno per ogni giorno di allenamento in ordine, ripetuti se
necessario) — sono gli unici tipi di scheda presenti nel catalogo esercizi dell'app.`;

const SET_SCHEME_SCHEMA = {
  type: 'object',
  properties: {
    sets: { type: 'integer' },
    reps: { type: 'string' },
    restSec: { type: 'integer' },
    tempo: { type: 'string' },
  },
  required: ['sets', 'reps', 'restSec', 'tempo'],
  additionalProperties: false,
};

const MONTHLY_FOCUS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      monthIndex: { type: 'integer' },
      title: { type: 'string' },
      focusNote: { type: 'string' },
    },
    required: ['monthIndex', 'title', 'focusNote'],
    additionalProperties: false,
  },
};

const STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    training: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            splitLabels: { type: 'array', items: { type: 'string', enum: ['Full Body', 'Upper', 'Lower', 'Push', 'Pull', 'Legs'] } },
            gymScheme: {
              type: 'object',
              properties: { adattamento: SET_SCHEME_SCHEMA, later: SET_SCHEME_SCHEMA },
              required: ['adattamento', 'later'],
              additionalProperties: false,
            },
            runSessions: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object',
                  properties: {
                    adattamento: { type: 'array', items: { type: 'string' } },
                    later: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['adattamento', 'later'],
                  additionalProperties: false,
                },
              ],
            },
            monthlyFocus: MONTHLY_FOCUS_SCHEMA,
            rationale: { type: 'string' },
          },
          required: ['splitLabels', 'gymScheme', 'runSessions', 'monthlyFocus', 'rationale'],
          additionalProperties: false,
        },
      ],
    },
    diet: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            monthlyTargets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  monthIndex: { type: 'integer' },
                  calorieTarget: { type: 'integer' },
                  macroTargetsG: {
                    type: 'object',
                    properties: { protein: { type: 'integer' }, carbs: { type: 'integer' }, fats: { type: 'integer' } },
                    required: ['protein', 'carbs', 'fats'],
                    additionalProperties: false,
                  },
                },
                required: ['monthIndex', 'calorieTarget', 'macroTargetsG'],
                additionalProperties: false,
              },
            },
            monthlyFocus: MONTHLY_FOCUS_SCHEMA,
            rationale: { type: 'string' },
          },
          required: ['monthlyTargets', 'monthlyFocus', 'rationale'],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ['training', 'diet'],
  additionalProperties: false,
};

function buildProfileSummary(body: RequestBody): string {
  const { answers, dailyCalorieTarget, macroTargetsG, durationMonths } = body;
  return `Profilo utente:
- Obiettivo: ${answers.goal ?? 'sconosciuto'}
- Attività praticate: ${JSON.stringify(answers.activitiesPracticed ?? [])}
- Focus palestra: ${answers.focus_gym ?? 'n/d'}, Focus corsa: ${answers.focus_running ?? 'n/d'}
- Giorni disponibili: ${answers.availableDays ?? 'n/d'}, Frequenza palestra: ${answers.freq_gym ?? 'n/d'}, Frequenza corsa: ${answers.freq_running ?? 'n/d'}
- Luogo allenamento: ${answers.trainingLocation ?? 'palestra'}
- Pattern alimentare: ${answers.dietaryPattern ?? 'onnivoro'}
- Target calorico finale: ${dailyCalorieTarget} kcal, macro finali: ${JSON.stringify(macroTargetsG)}
- Durata piano: ${durationMonths} mesi (mese 1 = adattamento, ultimo = consolidamento, gli intermedi = progressione)`;
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

    const body = (await req.json()) as RequestBody;
    const goal = String(body.answers?.goal ?? 'generalHealth');
    const query = `${goal} ${JSON.stringify(body.answers?.activitiesPracticed ?? [])} ${body.answers?.focus_gym ?? ''} ${body.answers?.dietaryPattern ?? ''}`;

    const [trainingChunks, nutritionChunks] = await Promise.all([
      retrieveKnowledge(supabase, query, 'training_guide').catch(() => []),
      retrieveKnowledge(supabase, query, 'nutrition_guide').catch(() => []),
    ]);
    const knowledgeBlock = [
      formatChunksForPrompt(trainingChunks, 'Guida PT'),
      formatChunksForPrompt(nutritionChunks, 'Guida Dieta'),
    ]
      .filter(Boolean)
      .join('\n\n');

    const anthropic = createAnthropicClient();
    const response = await anthropic.messages.create({
      model: ORCHESTRATOR_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      // deno-lint-ignore no-explicit-any
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 5, allowed_domains: AUTHORITATIVE_DOMAINS },
      ] as any,
      // Schema-constrained output — guarantees the final text block is
      // valid JSON matching STRATEGY_SCHEMA exactly, even with web_search
      // tool use interleaved beforehand. Confirmed empirically against the
      // real API before relying on it here (prompt-only JSON generation for
      // this large a structure occasionally produced malformed JSON).
      // deno-lint-ignore no-explicit-any
      output_config: { format: { type: 'json_schema', schema: STRATEGY_SCHEMA } } as any,
      messages: [{ role: 'user', content: `${buildProfileSummary(body)}\n\n${knowledgeBlock}` }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`No text response (stop_reason: ${response.stop_reason})`);
    }
    const strategy = JSON.parse(textBlock.text);

    return jsonResponse({ strategy });
  } catch (err) {
    console.error('generate-plan-strategy function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
