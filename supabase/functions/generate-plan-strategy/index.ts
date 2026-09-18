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
const MIN_SAFE_CALORIE_TARGET = 1200;
const MAX_SANE_CALORIE_TARGET = 6000;
const MAX_CALORIE_DEVIATION_FROM_REQUESTED = 0.25; // a monthly target more than 25% off the client's own computed target is untrusted, not "aggressive periodization"

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
function validateStrategy(raw: any, requestedDailyCalorieTarget: number): any {
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
    const d = strategy.diet;
    const monthlyTargets = Array.isArray(d.monthlyTargets)
      ? d.monthlyTargets.filter((m: Record<string, unknown>) => {
          const cal = m?.calorieTarget;
          if (typeof cal !== 'number' || cal < MIN_SAFE_CALORIE_TARGET || cal > MAX_SANE_CALORIE_TARGET) return false;
          if (requestedDailyCalorieTarget > 0) {
            const deviation = Math.abs(cal - requestedDailyCalorieTarget) / requestedDailyCalorieTarget;
            if (deviation > MAX_CALORIE_DEVIATION_FROM_REQUESTED) return false;
          }
          const macros = m?.macroTargetsG as Record<string, unknown> | undefined;
          return macros && typeof macros.protein === 'number' && typeof macros.carbs === 'number' && typeof macros.fats === 'number';
        })
      : [];
    strategy.diet = monthlyTargets.length > 0 ? { ...d, monthlyTargets } : null;
  }

  return strategy;
}

function yesNo(v: unknown): boolean {
  return v === 'yes' || v === 'sì' || v === 'si' || v === true;
}

function buildProfileSummary(body: RequestBody): string {
  const { answers, dailyCalorieTarget, macroTargetsG, durationMonths } = body;

  const limitations: string[] = [];
  if (yesNo(answers.hasPain) && answers.painDetails) limitations.push(`dolori/limitazioni attuali: ${answers.painDetails}`);
  if (yesNo(answers.cannotDoExercises) && answers.cannotDoDetails) limitations.push(`esercizi da NON includere: ${answers.cannotDoDetails}`);
  if (yesNo(answers.recentInjuries) && answers.recentInjuriesDetails) limitations.push(`infortuni recenti: ${answers.recentInjuriesDetails}`);

  const foodConstraints: string[] = [];
  if (answers.allergiesIntolerances) foodConstraints.push(`allergie/intolleranze: ${answers.allergiesIntolerances}`);
  if (answers.excludedFoods) foodConstraints.push(`alimenti da escludere: ${answers.excludedFoods}`);
  if (answers.includedFoods) foodConstraints.push(`alimenti da includere se possibile: ${answers.includedFoods}`);

  const usualMeals: string[] = [];
  if (answers.usualBreakfast) usualMeals.push(`colazione: ${answers.usualBreakfast}`);
  if (answers.usualLunch) usualMeals.push(`pranzo: ${answers.usualLunch}`);
  if (answers.usualDinner) usualMeals.push(`cena: ${answers.usualDinner}`);
  if (answers.usualMorningSnack) usualMeals.push(`spuntino mattina: ${answers.usualMorningSnack}`);
  if (answers.usualAfternoonSnack) usualMeals.push(`spuntino pomeriggio: ${answers.usualAfternoonSnack}`);
  if (answers.usualPreSleepSnack) usualMeals.push(`spuntino pre-nanna: ${answers.usualPreSleepSnack}`);

  const gymBackground: string[] = [];
  if (answers.gymExperience) gymBackground.push(`da quanto tempo: ${answers.gymExperience}`);
  if (answers.gymSkillLevel) gymBackground.push(`livello: ${answers.gymSkillLevel}`);

  return `Profilo utente:
- Obiettivo: ${answers.goal ?? 'sconosciuto'}
- Attività praticate: ${JSON.stringify(answers.activitiesPracticed ?? [])}
- Focus palestra: ${answers.focus_gym ?? 'n/d'}, Focus corsa: ${answers.focus_running ?? 'n/d'}
${gymBackground.length > 0 ? `- Esperienza in palestra: ${gymBackground.join(', ')}\n` : ''}- Giorni disponibili: ${answers.availableDays ?? 'n/d'}, Durata sessione: ${answers.sessionDuration ?? 'n/d'}, Frequenza palestra: ${answers.freq_gym ?? 'n/d'}, Frequenza corsa: ${answers.freq_running ?? 'n/d'}
- Luogo allenamento: ${answers.trainingLocation ?? 'palestra'}
${limitations.length > 0 ? `- LIMITAZIONI FISICHE (vincolanti, non contraddire mai nella rationale/focusNote): ${limitations.join('; ')}\n` : ''}- Pattern alimentare: ${answers.dietaryPattern ?? 'onnivoro'}
- Pasti selezionati: ${JSON.stringify(answers.mealsSelected ?? [])}, orari: colazione ${answers.breakfastTime ?? 'n/d'} / pranzo ${answers.lunchTime ?? 'n/d'} / cena ${answers.dinnerTime ?? 'n/d'}
${usualMeals.length > 0 ? `- Cosa mangia di solito (contesto, non vincolante): ${usualMeals.join('; ')}\n` : ''}${foodConstraints.length > 0 ? `- VINCOLI ALIMENTARI (vincolanti, non contraddire mai nella rationale/focusNote): ${foodConstraints.join('; ')}\n` : ''}- Target calorico finale: ${dailyCalorieTarget} kcal, macro finali: ${JSON.stringify(macroTargetsG)}
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
    const parsed = JSON.parse(textBlock.text);
    const strategy = validateStrategy(parsed, body.dailyCalorieTarget);

    return jsonResponse({ strategy });
  } catch (err) {
    console.error('generate-plan-strategy function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
