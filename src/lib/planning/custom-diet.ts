/**
 * A diet the person already has (from a dietitian, a coach, another app), typed
 * or pasted as text, turned into a DietPlan the app treats like its own: same
 * day-by-day week, same Nutrizione page, same meal cards.
 *
 * Accepted shape (one food per line, or several on a line split by commas):
 *
 *   Lunedì                         Colazione
 *   Colazione                      Yogurt greco 200g, avena 50g, 1 banana
 *   Yogurt greco 200g              Pranzo
 *   Fiocchi d'avena 50g            Riso basmati 80g
 *   Pranzo                         Petto di pollo 150g
 *   Riso basmati 80g               ...
 *
 * With weekday headers each menu lands on that weekday; without, the same day
 * repeats all week. Foods found in the Fit Lab catalog get calories and macros;
 * the others are kept as written, without numbers.
 */
import { NEUTRAL_CALIBRATION } from '@/domain/recalibration';
import type { Goal } from '@/lib/mock/types';
import type { MealSlot } from '@/store/nutrition-store';

import { DIET_ENGINE_VERSION } from './diet-planner';
import { WEEKDAY_LABELS } from './exercise-library';
import { short, UNITS } from './fitlab/catalog';
import { FITLAB_FOODS, fitlabById, type FitLabFood } from './fitlab/foods';
import { MEAL_SLOT_ORDER } from './meal-slots';
import type { DietDayPlan, DietMonthPlan, DietPlan, PlanMeal, PlanMealItem, TrainingDayPlan } from './types';

export type CustomDietResult =
  | { ok: true; week: DietDayPlan[]; warnings: string[]; /** Foods kept as written because the catalog does not know them. */ unknownFoods: string[] }
  | { ok: false; error: string };

type Macros = { protein: number; carbs: number; fats: number };

const WEEKDAY_RE = /^(lun(?:ed[iì])?|mar(?:ted[iì])?|mer(?:coled[iì])?|gio(?:ved[iì])?|ven(?:erd[iì])?|sab(?:ato)?|dom(?:enica)?)(?![a-zàèéìòù])/i;
const BULLET_RE = /^\s*(?:[-–•*·▪]|\d+[.)])\s+/;
const TIME_RE = /\b(?:ore\s*)?([01]?\d|2[0-3])[:.,h]([0-5]\d)\b/i;
/** "200g", "200 gr", "1,5 kg", "250 ml". */
const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grammi|ml|cl|l|litri?)(?![a-zàèéìòù])/i;
/** "2 uova", "n. 2 fette", "1/2 avocado". */
const COUNT_RE = /(?:^|\s)(?:n\.?\s*)?(\d+(?:[.,]\d+)?|1\/2)\s+(?=[a-zàèéìòù])|^(mezz[oa]|un[oa]?)\s+(?=[a-zàèéìòù])/i;
/** Lines that are neither a day, a meal nor a food ("Opzione A", "Note: ..."). */
const NOISE_RE = /^(giorno|opzione|settimana|men[uù]|dieta|piano|note?|nb)\b/i;

const DEFAULT_TIME: Record<MealSlot, string> = {
  colazione: '07:30',
  spuntinoMattina: '10:30',
  pranzo: '13:00',
  spuntinoPomeriggio: '17:30',
  cena: '20:00',
  spuntinoSera: '22:30',
};
const SLOT_LABEL: Record<MealSlot, string> = {
  colazione: 'Colazione',
  spuntinoMattina: 'Spuntino mattina',
  pranzo: 'Pranzo',
  spuntinoPomeriggio: 'Spuntino pomeriggio',
  cena: 'Cena',
  spuntinoSera: 'Spuntino sera',
};

/** Household measures, in grams of one unit. */
const MEASURES: { re: RegExp; grams: number }[] = [
  { re: /\bcucchiain[oi]\b/i, grams: 5 },
  { re: /\bcucchiai[oa]?\b/i, grams: 10 },
  { re: /\b(tazz[ae]|bicchier[ei])\b/i, grams: 200 },
  { re: /\bvasett[oi]\b/i, grams: 125 },
  { re: /\bfett[ae]\b/i, grams: 25 },
  { re: /\bmanciat[ae]\b/i, grams: 30 },
];

const STOP_WORDS = new Set(['di', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'allo', 'ai', 'con', 'e', 'ed', 'il', 'la', 'lo', 'le', 'gli', 'i', 'in', 'a', 'da', 'un', 'una', 'uno', 'o', 'oppure', 'circa', 'tipo', 'q', 'b']);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9% ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words of a food name, without articles and with the final vowel dropped so "uovo/uova" and "banana/banane" meet. */
function words(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && /[aeio]$/.test(w) ? w.slice(0, -1) : w));
}

const CATALOG: { food: FitLabFood; names: string[][] }[] = FITLAB_FOODS.map((food) => ({
  food,
  names: [food.name, short(food.name), ...food.synonyms].map(words).filter((w) => w.length > 0),
}));

/** The catalog food a typed name refers to, or null. An exact name wins, then the most specific name fully contained in the text, then the catalog name that adds the least to it. */
export function matchCatalogFood(name: string): FitLabFood | null {
  const typed = words(name);
  if (typed.length === 0) return null;
  const typedSet = new Set(typed);
  let best: { food: FitLabFood; score: number } | null = null;
  for (const entry of CATALOG) {
    for (const candidate of entry.names) {
      const candidateSet = new Set(candidate);
      const candidateInTyped = candidate.every((w) => typedSet.has(w));
      const typedInCandidate = typed.every((w) => candidateSet.has(w));
      let score = 0;
      if (candidateInTyped && typedInCandidate) score = 1000;
      else if (candidateInTyped) score = 100 + candidate.length * 10;
      else if (typedInCandidate) score = 60 - (candidate.length - typed.length) * 10;
      if (score > 0 && (!best || score > best.score)) best = { food: entry.food, score };
    }
  }
  return best?.food ?? null;
}

type Quantity = { grams: number | null; label: string | null; rest: string };

function toNumber(raw: string): number {
  const v = raw.toLowerCase();
  if (v === '1/2' || v.startsWith('mezz')) return 0.5;
  if (v.startsWith('un')) return 1;
  return Number(v.replace(',', '.'));
}

/** The quantity written next to a food and the text left once it is taken out. */
function extractQuantity(text: string): Quantity {
  const weight = WEIGHT_RE.exec(text);
  if (weight) {
    const value = toNumber(weight[1]);
    const unit = weight[2].toLowerCase();
    const factor = unit === 'kg' || unit.startsWith('l') ? 1000 : unit === 'cl' ? 10 : 1;
    return { grams: Math.round(value * factor), label: weight[0].replace(/\s+/g, ' ').trim(), rest: text.replace(weight[0], ' ') };
  }
  const count = COUNT_RE.exec(text);
  if (count) {
    const written = count[1] ?? count[2];
    const value = toNumber(written);
    const rest = text.replace(count[0], ' ');
    const measure = MEASURES.find((m) => m.re.test(rest));
    if (measure) {
      const word = measure.re.exec(rest)?.[0] ?? '';
      return { grams: Math.round(value * measure.grams), label: `${written} ${word}`.trim(), rest: rest.replace(measure.re, ' ') };
    }
    // A bare count ("2 uova"): the grams come from the food's own piece weight, once the food is known.
    return { grams: -value, label: written, rest };
  }
  return { grams: null, label: null, rest: text };
}

function slug(text: string): string {
  return normalize(text).replace(/ /g, '-') || 'alimento';
}

/** "q.b.", "a piacere", "a volontà": a food eaten freely, with no quantity to count. */
const FREE_RE = /\bq\.?\s?b\.?(?![a-z])|\ba (?:piacere|volont[aà])\b|\bliber[oa]\b/i;

function parseItem(raw: string): PlanMealItem | null {
  const bulletless = raw.replace(BULLET_RE, '').trim();
  const free = FREE_RE.test(bulletless);
  const cleaned = bulletless.replace(FREE_RE, ' ').trim();
  if (!cleaned) return null;
  const quantity = extractQuantity(cleaned);
  const name = quantity.rest
    .replace(/[:;()|]+/g, ' ')
    .replace(/\s+-\s+|\s+-$|^-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || !/[a-zàèéìòù]/i.test(name)) return null;
  const display = name.charAt(0).toUpperCase() + name.slice(1);
  const food = matchCatalogFood(name);

  let grams: number | null = quantity.grams;
  let label = quantity.label ?? '';
  if (grams != null && grams < 0) {
    // counted in pieces
    const pieces = -grams;
    const unit = food ? UNITS[food.name] : undefined;
    grams = unit ? Math.round(pieces * unit.grams) : null;
    label = unit ? `${quantity.label} ${pieces === 1 ? unit.one : unit.many}` : (quantity.label ?? '');
  }
  if (grams == null && !label) {
    const unit = food ? UNITS[food.name] : undefined;
    if (unit) {
      grams = unit.grams;
      label = `1 ${unit.one}`;
    }
  }
  const known = food != null && grams != null && grams > 0;
  return {
    name: display,
    grams: grams != null && grams > 0 ? grams : 0,
    kcal: known ? Math.round((food.kcal * grams!) / 100) : 0,
    foodId: food?.id ?? `custom-${slug(name)}`,
    quantityLabel: label || 'q.b.',
    // Eaten freely: it has no numbers by choice, so it does not make the meal's total incomplete.
    ...(free && !known ? { role: 'extra' as const } : {}),
  };
}

/** Calories and macros of the foods the catalog knows; `complete` is false as soon as one food has no numbers. */
function mealNumbers(items: PlanMealItem[]): { kcal: number; macros: Macros; complete: boolean } {
  let kcal = 0;
  const macros: Macros = { protein: 0, carbs: 0, fats: 0 };
  let complete = items.length > 0;
  for (const item of items) {
    const food = fitlabById(item.foodId);
    if (item.role === 'extra') continue;
    if (!food || item.grams <= 0) {
      complete = false;
      continue;
    }
    kcal += item.kcal;
    macros.protein += (food.p * item.grams) / 100;
    macros.carbs += (food.c * item.grams) / 100;
    macros.fats += (food.f * item.grams) / 100;
  }
  return { kcal, macros: { protein: Math.round(macros.protein), carbs: Math.round(macros.carbs), fats: Math.round(macros.fats) }, complete };
}

type MealHeader = { kind: 'colazione' | 'pranzo' | 'cena' | 'spuntino'; hint: 'mattina' | 'pomeriggio' | 'sera' | null; time: string | null; rest: string };

/** A line that opens a meal ("Colazione", "Spuntino pomeriggio (ore 17)", "Pranzo: riso 80g, pollo 150g"). */
function mealHeader(line: string): MealHeader | null {
  const n = normalize(line);
  const m = /^(prima colazione|colazione|pranzo|cena|spuntino|merenda|break)\b/.exec(n);
  if (!m) return null;
  const kind = m[1].includes('colazione') ? 'colazione' : m[1] === 'pranzo' ? 'pranzo' : m[1] === 'cena' ? 'cena' : 'spuntino';
  // The colon that opens the foods, not the one inside a time ("ore 8:00").
  const colon = line.search(/:(?!\d)/);
  const head = colon >= 0 ? line.slice(0, colon) : line;
  const rest = colon >= 0 ? line.slice(colon + 1).trim() : '';
  // A meal header carries no quantity: "Cena 200g ..." is not one.
  if (rest === '' && WEIGHT_RE.test(line)) return null;
  const headNorm = normalize(head);
  const hint = /mattin/.test(headNorm) ? 'mattina' : /pomerig/.test(headNorm) || m[1] === 'merenda' ? 'pomeriggio' : /ser[ae]|nanna|dopo cena/.test(headNorm) ? 'sera' : null;
  const time = TIME_RE.exec(head);
  return { kind, hint, time: time ? `${time[1].padStart(2, '0')}:${time[2]}` : null, rest };
}

type DayBlock = { weekdayIndex: number | null; meals: PlanMeal[] };

function slotFor(header: MealHeader, used: Set<string>): MealSlot {
  if (header.kind !== 'spuntino') return header.kind;
  if (header.hint === 'mattina') return 'spuntinoMattina';
  if (header.hint === 'pomeriggio') return 'spuntinoPomeriggio';
  if (header.hint === 'sera') return 'spuntinoSera';
  // An unqualified snack takes its place from what came before it.
  if (used.has('cena')) return 'spuntinoSera';
  if (used.has('pranzo')) return 'spuntinoPomeriggio';
  return used.has('spuntinoMattina') ? 'spuntinoPomeriggio' : 'spuntinoMattina';
}

/** Text of a diet → the 7 days of a week (Lun…Dom). */
export function parseCustomDiet(text: string): CustomDietResult {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: 'Incolla o scrivi la tua dieta per continuare.' };

  const warnings: string[] = [];
  const unknown = new Set<string>();
  const days: DayBlock[] = [];
  let day: DayBlock | null = null;
  let meal: PlanMeal | null = null;

  const addItems = (target: PlanMeal, raw: string) => {
    for (const part of raw.split(/,(?!\d)|[;+]|\s+e\s+(?=\d)/)) {
      if (!part.trim()) continue;
      const item = parseItem(part);
      if (!item) {
        warnings.push(`Riga ignorata: “${part.trim()}”`);
        continue;
      }
      if (item.kcal === 0 && item.role !== 'extra') unknown.add(item.name);
      target.items.push(item);
    }
  };

  for (const line of lines) {
    const bare = line.replace(BULLET_RE, '').trim();
    const weekday = WEEKDAY_RE.exec(bare);
    if (weekday && !WEIGHT_RE.test(bare)) {
      day = { weekdayIndex: WEEKDAY_LABELS.findIndex((w) => w.toLowerCase() === weekday[1].slice(0, 3).toLowerCase()), meals: [] };
      days.push(day);
      meal = null;
      // "Lunedì - Colazione: ..." on one line
      const after = bare.slice(weekday[0].length).replace(/^[\s:–\-—.,]+/, '');
      if (!after) continue;
      const inline = mealHeader(after);
      if (!inline) continue;
      meal = openMeal(day, inline);
      if (inline.rest) addItems(meal, inline.rest);
      continue;
    }
    const header = mealHeader(bare);
    if (header) {
      if (!day) {
        day = { weekdayIndex: null, meals: [] };
        days.push(day);
      }
      meal = openMeal(day, header);
      if (header.rest) addItems(meal, header.rest);
      continue;
    }
    if (NOISE_RE.test(bare) && !WEIGHT_RE.test(bare)) continue;
    if (!meal) return { ok: false, error: 'Inizia ogni pasto con il suo nome, ad esempio “Colazione”, e sotto metti gli alimenti.' };
    addItems(meal, bare);
  }

  const filled = days.map((d) => ({ ...d, meals: d.meals.filter((m) => m.items.length > 0) })).filter((d) => d.meals.length > 0);
  if (filled.length === 0) return { ok: false, error: 'Non trovo alimenti. Scrivi un alimento per riga, ad esempio “Riso basmati 80g”.' };

  const week: (PlanMeal[] | null)[] = Array(7).fill(null);
  const dated = filled.filter((d) => d.weekdayIndex != null && d.weekdayIndex >= 0);
  if (dated.length > 0) {
    for (const d of dated) {
      if (week[d.weekdayIndex!]) {
        warnings.push(`${WEEKDAY_LABELS[d.weekdayIndex!]} compare due volte: tengo la prima.`);
        continue;
      }
      week[d.weekdayIndex!] = d.meals;
    }
    const first = dated[0];
    const missing = WEEKDAY_LABELS.filter((_, i) => !week[i]);
    if (missing.length > 0) warnings.push(`${missing.join(', ')}: giorno non indicato, uso il menù di ${WEEKDAY_LABELS[first.weekdayIndex!]}.`);
    for (let i = 0; i < 7; i++) if (!week[i]) week[i] = first.meals;
  } else {
    if (filled.length > 1) warnings.push('Più giornate senza il nome del giorno: uso la prima per tutta la settimana.');
    for (let i = 0; i < 7; i++) week[i] = filled[0].meals;
  }

  const full = week.map((meals, i): DietDayPlan => {
    const dayMeals = (meals ?? []).map((m) => finishMeal(m));
    const complete = dayMeals.every((m) => m.macros != null);
    const total = dayMeals.reduce((sum, m) => sum + m.totalKcal, 0);
    return {
      weekday: WEEKDAY_LABELS[i],
      meals: dayMeals,
      // The day's own numbers only when every food is known: a partial sum would read as a target that is too low.
      ...(complete && total > 0
        ? {
            calorieTarget: total,
            macroTargetsG: dayMeals.reduce<Macros>((acc, m) => ({ protein: acc.protein + m.macros!.protein, carbs: acc.carbs + m.macros!.carbs, fats: acc.fats + m.macros!.fats }), { protein: 0, carbs: 0, fats: 0 }),
          }
        : {}),
    };
  });
  return { ok: true, week: full, warnings, unknownFoods: [...unknown] };
}

function openMeal(day: DayBlock, header: MealHeader): PlanMeal {
  const used = new Set(day.meals.map((m) => m.slotId));
  let slot = slotFor(header, used);
  // The same meal twice in a day (two "Spuntino"): the second takes the next free slot, so slot ids stay unique.
  if (used.has(slot)) slot = MEAL_SLOT_ORDER.find((s) => !used.has(s) && MEAL_SLOT_ORDER.indexOf(s) > MEAL_SLOT_ORDER.indexOf(slot)) ?? slot;
  const existing = day.meals.find((m) => m.slotId === slot);
  if (existing) return existing;
  const meal: PlanMeal = { slotId: slot, label: SLOT_LABEL[slot], time: header.time ?? DEFAULT_TIME[slot], items: [], totalKcal: 0 };
  day.meals.push(meal);
  return meal;
}

function finishMeal(meal: PlanMeal): PlanMeal {
  const numbers = mealNumbers(meal.items);
  return { ...meal, items: meal.items.map((i) => ({ ...i })), totalKcal: numbers.kcal, ...(numbers.complete ? { macros: numbers.macros } : {}) };
}

export type CustomDietBase = {
  generatedAt?: string;
  durationMonths?: number;
  goal: Goal;
  calibration?: DietPlan['calibration'];
  recalibrations?: DietPlan['recalibrations'];
  /** The app's own targets, used for the days whose foods the catalog does not fully know. */
  fallback: { calories: number; macros: Macros };
  /** The training week, so each day knows whether it is a training day. */
  trainingWeek?: TrainingDayPlan[] | null;
};

/** The imported week as a full plan: every month repeats the diet, which the person then follows as written. */
export function buildCustomDietPlan(week: DietDayPlan[], base: CustomDietBase): DietPlan {
  const durationMonths = base.durationMonths ?? 3;
  const counted = week.filter((d) => d.calorieTarget != null);
  const average = (pick: (d: DietDayPlan) => number) => Math.round(counted.reduce((sum, d) => sum + pick(d), 0) / counted.length);
  const calorieTarget = counted.length > 0 ? average((d) => d.calorieTarget!) : base.fallback.calories;
  const macroTargetsG: Macros =
    counted.length > 0
      ? { protein: average((d) => d.macroTargetsG!.protein), carbs: average((d) => d.macroTargetsG!.carbs), fats: average((d) => d.macroTargetsG!.fats) }
      : base.fallback.macros;

  const days = week.map((d, i): DietDayPlan => {
    const trainingDay = base.trainingWeek?.[i];
    return {
      ...d,
      meals: d.meals.map((m) => ({ ...m, items: m.items.map((item) => ({ ...item })) })),
      ...(trainingDay ? { isTrainingDay: trainingDay.type !== 'rest' } : {}),
    };
  });
  const months: DietMonthPlan[] = Array.from({ length: durationMonths }, (_, i) => ({
    monthIndex: i + 1,
    phase: i === 0 ? 'adattamento' : i === durationMonths - 1 ? 'consolidamento' : 'progressione',
    title: `Mese ${i + 1} · La tua dieta`,
    focusNote: 'Dieta inserita da te: l’app la segue così com’è, senza modificarla.',
    calorieTarget,
    macroTargetsG,
    weeklySplit: days.map((d) => ({ ...d, meals: d.meals.map((m) => ({ ...m, items: m.items.map((item) => ({ ...item })) })) })),
  }));
  return {
    generatedAt: base.generatedAt ?? new Date().toISOString(),
    durationMonths,
    goal: base.goal,
    months,
    engine: DIET_ENGINE_VERSION,
    source: 'custom',
    calibration: base.calibration ?? NEUTRAL_CALIBRATION,
    recalibrations: base.recalibrations,
  };
}
