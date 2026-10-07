// Produces the METHODOLOGICAL decisions behind a user's diet/training plan
// (split choice, set/rep scheme, calorie/macro periodization, phase focus
// notes) grounded in the two reference PDFs (RAG) only — no web search (it was
// the most expensive part and the guides already cover the methodology).
// Results are cached per similar profile (plan_strategy_cache), so most users
// never trigger a model call at all, and the model is the cheaper Haiku. Deliberately does NOT generate the full
// meal-by-meal/exercise-by-exercise plan: src/lib/planning/{diet,training}-planner.ts
// still assembles that mechanically from the app's own food-database/
// exercise-library, so a hallucinated food or exercise id can never reach
// the plan. It does NOT decide calories or macros either: those come from the
// energy model in src/domain (training and nutrition are coupled there and
// recalibrated monthly), so the AI only writes the methodology and the wording. Every field here is optional from the client's point of view —
// src/store/plan-store.ts falls back to today's deterministic tables
// per-field when a field (or the whole call) is missing, so this is purely
// additive, never a hard dependency for onboarding to complete.
import { createAnthropicClient, STRATEGY_MODEL } from '../_shared/anthropic-client.ts';
import { formatChunksForPrompt, retrieveKnowledge } from '../_shared/agents/rag.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createServiceRoleClient, createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

type RequestBody = {
  answers: Record<string, unknown>;
  /** Computed by the client's energy model — context for the AI, never to be changed by it. */
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  durationMonths: number;
};

const SYSTEM_PROMPT = `Sei un esperto di personal training e nutrizione. Il tuo compito è decidere la METODOLOGIA di un
piano di allenamento/alimentazione (non i singoli pasti o esercizi, che vengono assemblati altrove da un catalogo
reale) per un utente specifico, basandoti SOLO su:
1. Il contesto di riferimento fornito (estratti dalle due guide interne)
2. Il profilo dell'utente fornito

Nella "rationale" spiega in 2-3 frasi la logica della metodologia scelta, citando le guide interne solo se il
contesto fornito la copre davvero — non un saggio. Il testo viene riutilizzato per profili simili: non scrivere
dati personali (nome, età esatta, peso) ma solo la caratteristica del profilo (es. "principiante", "minorenne"). Nei campi
"focusNote" sii specifico e concreto (volume, intensità, motivazione fisiologica) ma stringato: massimo 2 frasi
brevi per mese, non un paragrafo. Se il profilo non prevede allenamento in palestra/corsa imposta "training" a
null; se non serve un piano alimentare imposta "diet" a null. NON decidi tu calorie e macro: le calcola l'app
dal fabbisogno energetico e dal programma di allenamento, e vengono ricalibrate ogni mese in base ai progressi.
Le persone che usano l'app sono persone comuni (dai 16 ai 60 anni, sedentarie o molto attive, principianti o
esperte): adatta volume e progressione all'età e all'esperienza reale, con prudenza per principianti e minorenni. "splitLabels" deve usare ESCLUSIVAMENTE i valori
"Full Body", "Upper", "Lower", "Push", "Pull", "Legs" (uno per ogni giorno di allenamento in ordine, ripetuti se
necessario) — sono gli unici tipi di scheda presenti nel catalogo esercizi dell'app.

Se il profilo elenca LIMITAZIONI FISICHE o VINCOLI ALIMENTARI, sono vincolanti: non nominare mai nella
"rationale" o nei "focusNote" un esercizio, un movimento o un alimento incompatibile con quanto indicato (il
codice a valle già esclude questi esercizi/alimenti dal piano concreto — il tuo testo non deve contraddirlo
suggerendone comunque uno). Se non sai come formulare il focus rispettando il vincolo, resta più generico
piuttosto che nominare qualcosa di escluso.`;

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
            monthlyFocus: MONTHLY_FOCUS_SCHEMA,
            rationale: { type: 'string' },
          },
          required: ['monthlyFocus', 'rationale'],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ['training', 'diet'],
  additionalProperties: false,
};

// Rule/constraint validation on top of the JSON-schema conformance
// output_config already guarantees (spec §4.2, "Proposta di redesign —
// validazione dell'output AI"): the schema only proves the SHAPE is right,
// not that the VALUES are sane. Anything that fails a check here is
// stripped back to null/omitted rather than the whole request failing —
// src/store/plan-store.ts and the deterministic planners already treat a
// missing strategy field as "use the hardcoded default", so this keeps the
// existing "AI is purely additive, never a hard dependency" guarantee
// while adding a real safety net around the values it's allowed to affect.
const VALID_SPLIT_LABELS = new Set(['Full Body', 'Upper', 'Lower', 'Push', 'Pull', 'Legs']);
function isSaneSetScheme(scheme: unknown): scheme is { sets: number; reps: string; restSec: number; tempo: string } {
  if (!scheme || typeof scheme !== 'object') return false;
  const s = scheme as Record<string, unknown>;
  return (
    typeof s.sets === 'number' &&
    s.sets >= 1 &&
    s.sets <= 8 &&
    typeof s.reps === 'string' &&
    s.reps.length > 0 &&
    typeof s.restSec === 'number' &&
    s.restSec >= 15 &&
    s.restSec <= 600 &&
    typeof s.tempo === 'string' &&
    /^\d+-\d+-\d+$/.test(s.tempo)
  );
}

// deno-lint-ignore no-explicit-any
function validateStrategy(raw: any): any {
  const strategy = raw && typeof raw === 'object' ? raw : { training: null, diet: null };

  if (strategy.training) {
    const t = strategy.training;
    const splitLabels = Array.isArray(t.splitLabels) ? t.splitLabels.filter((l: string) => VALID_SPLIT_LABELS.has(l)) : [];
    const gymSchemeValid = isSaneSetScheme(t.gymScheme?.adattamento) && isSaneSetScheme(t.gymScheme?.later);
    strategy.training =
      splitLabels.length > 0 && gymSchemeValid
        ? { ...t, splitLabels }
        : null; // let the deterministic tables take over entirely rather than mix a partially-untrusted structure in
  }

  if (strategy.diet) {
    // wording only: keep the focus notes, never any numeric target
    const focus = Array.isArray(strategy.diet.monthlyFocus) ? strategy.diet.monthlyFocus : [];
    strategy.diet = { monthlyFocus: focus, rationale: String(strategy.diet.rationale ?? '') };
  }

  return strategy;
}

// Bump when the prompt or schema changes, so old cached strategies are not reused.
const CACHE_VERSION = 'v1';

function ageBand(age: unknown): string {
  const n = Number(age);
  if (!Number.isFinite(n)) return 'n/d';
  if (n < 18) return 'minorenne';
  if (n < 40) return '18-39 anni';
  if (n < 55) return '40-54 anni';
  return '55+ anni';
}

// The fields that shape the methodology. They are BOTH the cache key and the whole profile the
// model sees, so a cached strategy is exactly what the model would have written for anyone with
// the same values — and no personal data (weight, height, exact age, usual meals…) reaches the
// shared text. Free-text constraints (pain, allergies, exclusions) are part of the key too, so a
// person with specific limits only ever reuses a strategy written for exactly those limits.
const PROFILE_FIELDS = [
  'goal', 'activitiesPracticed', 'focus_gym', 'focus_running', 'gymExperience', 'gymSkillLevel', 'gymSplitPreference',
  'freq_gym', 'freq_running', 'sessionDuration', 'trainingLocation', 'availableDays', 'dietaryPattern', 'mealsSelected',
  'hasPain', 'painDetails', 'cannotDoExercises', 'cannotDoDetails', 'recentInjuries', 'recentInjuriesDetails',
  'allergiesIntolerances', 'excludedFoods', 'includedFoods',
] as const;

function norm(v: unknown): string {
  return Array.isArray(v) ? [...v].map(String).sort().join('+') : String(v ?? '').trim().toLowerCase();
}

async function cacheKey(body: RequestBody): Promise<string> {
  const a = body.answers ?? {};
  const parts = [CACHE_VERSION, String(body.durationMonths), ageBand(a.age), ...PROFILE_FIELDS.map((k) => norm(a[k]))];
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function buildProfileSummary(body: RequestBody): string {
  const a = body.answers ?? {};
  const lines = PROFILE_FIELDS.map((k) => (norm(a[k]) ? `- ${k}: ${norm(a[k])}` : null)).filter(Boolean);
  return `Profilo utente (fascia d'età: ${ageBand(a.age)}). I campi hasPain, cannotDoExercises, recentInjuries (con i relativi dettagli) e le allergie/esclusioni alimentari sono vincoli vincolanti: non contraddirli mai nella rationale/focusNote.
${lines.join('\n')}
- durata del piano: ${body.durationMonths} mesi (mese 1 = adattamento, ultimo = consolidamento, gli intermedi = progressione)`;
}

// The cache is optional: if the table is missing or a query fails, the strategy is simply generated.
async function readCache(key: string) {
  try {
    const db = createServiceRoleClient();
    const { data } = await db.from('plan_strategy_cache').select('strategy, hits').eq('key', key).maybeSingle();
    if (data?.strategy) {
      db.from('plan_strategy_cache').update({ hits: (data.hits ?? 0) + 1 }).eq('key', key).then(() => {}, () => {});
      return data.strategy;
    }
  } catch (err) {
    console.warn('plan_strategy_cache read failed', err);
  }
  return null;
}

async function writeCache(key: string, strategy: unknown) {
  try {
    await createServiceRoleClient().from('plan_strategy_cache').upsert({ key, strategy });
  } catch (err) {
    console.warn('plan_strategy_cache write failed', err);
  }
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
    const key = await cacheKey(body);
    const cached = await readCache(key);
    if (cached) return jsonResponse({ strategy: cached, cached: true });

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
      model: STRATEGY_MODEL,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      // Schema-constrained output — guarantees the final text block is
      // valid JSON matching STRATEGY_SCHEMA exactly (prompt-only JSON generation
      // for this large a structure occasionally produced malformed JSON).
      // deno-lint-ignore no-explicit-any
      output_config: { format: { type: 'json_schema', schema: STRATEGY_SCHEMA } } as any,
      messages: [{ role: 'user', content: `${buildProfileSummary(body)}\n\n${knowledgeBlock}` }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`No text response (stop_reason: ${response.stop_reason})`);
    }
    const parsed = JSON.parse(textBlock.text);
    const strategy = validateStrategy(parsed);
    // only a usable strategy is worth reusing
    if (strategy.training || strategy.diet) await writeCache(key, strategy);

    return jsonResponse({ strategy });
  } catch (err) {
    console.error('generate-plan-strategy function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
