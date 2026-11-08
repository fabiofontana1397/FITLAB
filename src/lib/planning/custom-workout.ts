/**
 * A workout card the person already has (from a trainer, a book, another app),
 * typed or pasted as text, turned into a TrainingPlan the app treats like its
 * own: same weekly split shape, same Allenamento tab, same session screen.
 *
 * Accepted shapes (one exercise per line, "serie x ripetizioni" is what marks it):
 *
 *   Lunedì - Petto e tricipiti        Giorno A - Gambe
 *   Panca piana 4x8 rec 90s           Squat 4x6 recupero 2 min
 *   Croci ai cavi 3x12                Leg press 3x10-12
 *   Martedì - Riposo                  Giorno B - Schiena
 *   Giovedì - Corsa 40 min            Trazioni 4x8
 *
 * With weekday headers each session lands on that weekday. With generic
 * headers ("Giorno A", "Scheda 2", …) the sessions are spread over the week.
 */
import { GYM_EXERCISES, HOME_EXERCISES, WEEKDAY_LABELS, WEEKDAY_PATTERN, type ExerciseDef } from './exercise-library';
import { NEUTRAL_CALIBRATION } from '@/domain/recalibration';
import { TRAINING_ENGINE_VERSION } from './training-planner';
import type { TrainingDayPlan, TrainingExerciseEntry, TrainingMonthPlan, TrainingPlan } from './types';

export type CustomParseResult =
  | { ok: true; week: TrainingDayPlan[]; warnings: string[] }
  | { ok: false; error: string };

const WEEKDAY_RE = /^(lun(?:ed[iì])?|mar(?:ted[iì])?|mer(?:coled[iì])?|gio(?:ved[iì])?|ven(?:erd[iì])?|sab(?:ato)?|dom(?:enica)?)(?![a-zàèéìòù])/i;
const REST_RE = /\b(riposo|rest|off|recupero attivo|libero)\b/i;
const CARDIO_RE = /\b(corsa|corri|running|run|cardio|camminata|bici|bicicletta|nuoto|ellittica|hiit)\b/i;
/** "4x8", "4 x 10-12", "3×12", "5x5/3/1", "3x30s". */
const SCHEME_RE = /(\d{1,2})\s*[x×*]\s*(\d{1,3}(?:\s*[-–/]\s*\d{1,3})*\s*(?:s|sec|")?)/i;
const REST_TIME_RE = /\b(?:rec(?:upero)?\.?|rest|pausa|r)\s*[:=]?\s*(\d{1,3})\s*(min|m|'|’|s|sec|")?/i;
const BULLET_RE = /^\s*(?:[-–•*·▪]|\d+[.)])\s+/;
const DEFAULT_REST_SEC = 90;
const DEFAULT_TEMPO = '2-0-2';
/** "tempo 3-1-1", "TUT 3010", "cadenza: 3/0/1" — a label plus 3 or 4 digits (x = as fast as possible). */
const TEMPO_LABELED_RE = /\b(?:tempo|tut|cadenza|t\.)\s*[:=]?\s*([0-9x])\s*[-–/.\s]?\s*([0-9x])\s*[-–/.\s]?\s*([0-9x])(?:\s*[-–/.\s]?\s*([0-9x]))?(?![0-9])/i;
/** A bare "3-1-1" or "3-0-1-0" next to an exercise (never part of a rep scheme like "10-8-6"). */
const TEMPO_BARE_RE = /(?<![0-9x])([0-9x])\s*[-–/]\s*([0-9x])\s*[-–/]\s*([0-9x])(?:\s*[-–/]\s*([0-9x]))?(?![0-9x])/i;
/** A line that only states the tempo: "Tempo: 3-1-1 per tutti gli esercizi". */
const TEMPO_ONLY_RE = /^\s*(?:tempo|tut|cadenza)\b[^0-9x]*[0-9x]\s*[-–/.\s]?\s*[0-9x]\s*[-–/.\s]?\s*[0-9x]/i;

type TempoMatch = { tempo: string; text: string };

/** Eccentric-pause-concentric seconds ("x" counts as a 1-second explosive rep). A 4th number (pause at the top) is dropped. */
function extractTempo(line: string): TempoMatch | null {
  const m = TEMPO_LABELED_RE.exec(line) ?? TEMPO_BARE_RE.exec(line);
  if (!m) return null;
  const part = (v: string) => (v.toLowerCase() === 'x' ? '1' : v);
  return { tempo: `${part(m[1])}-${part(m[2])}-${part(m[3])}`, text: line.replace(m[0], ' ') };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(text: string): string {
  return normalize(text).replace(/ /g, '-') || 'esercizio';
}

const LIBRARY: ExerciseDef[] = (() => {
  const seen = new Map<string, ExerciseDef>();
  for (const list of [...Object.values(GYM_EXERCISES), ...Object.values(HOME_EXERCISES)]) {
    for (const def of list) if (!seen.has(def.id)) seen.set(def.id, def);
  }
  return [...seen.values()];
})();

/** The library exercise a typed name refers to (so it gets the GIF and the instructions), or null. */
export function matchLibraryExercise(name: string): ExerciseDef | null {
  const n = normalize(name);
  if (!n) return null;
  let best: { def: ExerciseDef; score: number } | null = null;
  for (const def of LIBRARY) {
    const candidates = [def.name, ...def.keywords].map(normalize);
    for (const c of candidates) {
      if (!c) continue;
      const score = n === c ? 1000 + c.length : c.length >= 6 && ` ${n} `.includes(` ${c} `) ? c.length : 0;
      if (score > 0 && (!best || score > best.score)) best = { def, score };
    }
  }
  return best?.def ?? null;
}

function restSeconds(line: string): { sec: number | null; rest: string } {
  const m = REST_TIME_RE.exec(line);
  if (!m) return { sec: null, rest: line };
  const value = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  const sec = unit === 'min' || unit === 'm' || unit === "'" || unit === '’' ? value * 60 : unit ? value : value <= 5 ? value * 60 : value;
  return { sec: Math.min(600, Math.max(5, sec)), rest: line.replace(m[0], ' ') };
}

function parseExerciseLine(raw: string, defaultTempo: string): TrainingExerciseEntry | null {
  const cleaned = raw.replace(BULLET_RE, '').trim();
  const { sec, rest: withoutRest } = restSeconds(cleaned);
  const scheme = SCHEME_RE.exec(withoutRest);
  const withoutScheme = scheme ? withoutRest.replace(scheme[0], ' ') : withoutRest;
  const tempoMatch = extractTempo(withoutScheme);
  const name = (tempoMatch ? tempoMatch.text : withoutScheme)
    .replace(/[:;,()–|]+/g, ' ')
    .replace(/\s+-\s+|\s+-$|^-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || !/[a-zàèéìòù]/i.test(name)) return null;
  const sets = scheme ? Math.min(12, Math.max(1, Number(scheme[1]))) : 3;
  const reps = scheme ? scheme[2].replace(/\s+/g, '') : '10';
  const display = name.charAt(0).toUpperCase() + name.slice(1);
  const known = matchLibraryExercise(name);
  return {
    id: known?.id ?? `custom-${slug(name)}`,
    name: display,
    sets,
    reps,
    restSec: sec ?? DEFAULT_REST_SEC,
    suggestedKg: null,
    tempo: tempoMatch?.tempo ?? defaultTempo,
  };
}

type Block = { weekdayIndex: number | null; title: string; lines: string[]; tempo?: string };

function dayFromBlock(weekday: string, block: Block, globalTempo: string, warnings: string[]): TrainingDayPlan {
  const title = block.title;
  const exercises: TrainingExerciseEntry[] = [];
  const seenIds = new Map<string, number>();
  for (const line of block.lines) {
    const entry = parseExerciseLine(line, block.tempo ?? globalTempo);
    if (!entry) {
      warnings.push(`Riga ignorata (${weekday}): “${line.trim()}”`);
      continue;
    }
    // Same exercise twice in a day (e.g. two squat blocks): ids must stay unique, they key the session's progress.
    const count = (seenIds.get(entry.id) ?? 0) + 1;
    seenIds.set(entry.id, count);
    exercises.push(count > 1 ? { ...entry, id: `${entry.id}-${count}` } : entry);
  }

  if (REST_RE.test(title) && exercises.length === 0) return { weekday, type: 'rest', title: 'Riposo' };
  if (exercises.length === 0) {
    if (CARDIO_RE.test(title)) return { weekday, type: 'cardio', title: 'Cardio', note: title };
    if (block.lines.length === 0) return { weekday, type: 'rest', title: 'Riposo' };
  }
  return { weekday, type: 'workout', title: title || 'Allenamento', exercises };
}

/** Text of a card → the 7 days of a week (Lun…Dom). */
export function parseCustomWorkout(text: string): CustomParseResult {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: 'Incolla o scrivi la tua scheda per continuare.' };

  const hasWeekdays = lines.some((l) => WEEKDAY_RE.test(l.replace(BULLET_RE, '')));
  const blocks: Block[] = [];
  const warnings: string[] = [];

  let globalTempo = DEFAULT_TEMPO;

  for (const line of lines) {
    if (TEMPO_ONLY_RE.test(line) && !SCHEME_RE.test(line)) {
      // "Tempo: 3-1-1" on its own: for the whole card before any day, for that day's exercises after one.
      const t = extractTempo(line)?.tempo;
      if (t) {
        if (blocks.length === 0) globalTempo = t;
        else blocks[blocks.length - 1].tempo = t;
        continue;
      }
    }
    const bare = line.replace(BULLET_RE, '').trim();
    const dayMatch = WEEKDAY_RE.exec(bare);
    const hasScheme = SCHEME_RE.test(bare);
    // With weekdays: a line starting with one opens that day (unless it clearly is an exercise with a scheme, like "Dom...").
    // Without: any line lacking a "serie x ripetizioni" opens a session.
    const isHeader = hasWeekdays ? dayMatch != null && !hasScheme : !hasScheme;
    if (isHeader) {
      const title = (dayMatch ? bare.slice(dayMatch[0].length) : bare).replace(/^[\s:–\-—.,]+/, '').replace(/[\s:–\-—]+$/, '');
      blocks.push({
        weekdayIndex: dayMatch ? WEEKDAY_LABELS.findIndex((w) => w.toLowerCase() === dayMatch[1].slice(0, 3).toLowerCase()) : null,
        title,
        lines: [],
      });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].lines.push(line);
    } else {
      return { ok: false, error: 'Inizia ogni giorno con il suo nome, ad esempio “Lunedì – Petto”, e sotto metti gli esercizi.' };
    }
  }

  const sessions = blocks.filter((b) => !(b.lines.length === 0 && REST_RE.test(b.title)));
  if (blocks.length === 0 || blocks.every((b) => b.lines.length === 0 && !CARDIO_RE.test(b.title))) {
    return { ok: false, error: 'Non trovo esercizi. Scrivi ogni esercizio su una riga, ad esempio “Panca piana 4x8”.' };
  }
  if (!hasWeekdays && sessions.length > 7) return { ok: false, error: 'Una settimana può avere al massimo 7 allenamenti.' };

  const week: (TrainingDayPlan | null)[] = Array(7).fill(null);
  if (hasWeekdays) {
    for (const block of blocks) {
      const index = block.weekdayIndex ?? -1;
      if (index < 0) continue;
      if (week[index]) {
        warnings.push(`${WEEKDAY_LABELS[index]} compare due volte: tengo la prima.`);
        continue;
      }
      week[index] = dayFromBlock(WEEKDAY_LABELS[index], block, globalTempo, warnings);
    }
  } else {
    const slots = WEEKDAY_PATTERN[sessions.length] ?? [];
    sessions.forEach((block, i) => {
      week[slots[i]] = dayFromBlock(WEEKDAY_LABELS[slots[i]], block, globalTempo, warnings);
    });
  }

  const full = week.map((d, i): TrainingDayPlan => d ?? { weekday: WEEKDAY_LABELS[i], type: 'rest', title: 'Riposo' });
  if (!full.some((d) => d.type === 'workout' && (d.exercises?.length ?? 0) > 0)) {
    return { ok: false, error: 'Non trovo esercizi con serie e ripetizioni, ad esempio “Panca piana 4x8”.' };
  }
  return { ok: true, week: full, warnings };
}

/** The imported week as a full plan: every month repeats the card, which the person then follows as written. */
export function buildCustomTrainingPlan(week: TrainingDayPlan[], base: Pick<TrainingPlan, 'generatedAt' | 'durationMonths' | 'calibration' | 'recalibrations'> | null): TrainingPlan {
  const durationMonths = base?.durationMonths ?? 3;
  const months: TrainingMonthPlan[] = Array.from({ length: durationMonths }, (_, i) => ({
    monthIndex: i + 1,
    phase: i === 0 ? 'adattamento' : i === durationMonths - 1 ? 'consolidamento' : 'progressione',
    title: `Mese ${i + 1} · La tua scheda`,
    focusNote: 'Scheda inserita da te: l’app la segue così com’è e adatta dieta e calorie ai tuoi allenamenti.',
    weeklySplit: week.map((d) => ({ ...d, exercises: d.exercises?.map((e) => ({ ...e })) })),
  }));
  return {
    generatedAt: base?.generatedAt ?? new Date().toISOString(),
    durationMonths,
    months,
    engine: TRAINING_ENGINE_VERSION,
    source: 'custom',
    calibration: base?.calibration ?? NEUTRAL_CALIBRATION,
    recalibrations: base?.recalibrations,
  };
}
