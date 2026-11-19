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
const REST_TIME_RE = /\b(?:rec(?:upero)?\.?|rest|pausa|r)\s*[:=]?\s*(\d{1,3})\s*(min|m|'|’|′|secondi|sec|se|s|"|″)?/i;
/** "Giorno 1 — Gambe", "Day A", "Seduta 2", "Scheda B": a numbered or lettered session. */
const SESSION_HEADER_RE = /^(?:giorno|giornata|day|seduta|sessione|allenamento|workout|scheda|split)\s*(?:n[.°º]?\s*)?(\d{1,2}|[a-g])(?![a-z0-9])/i;
/** The header row of a printed table ("ESERCIZIO | SERIE E RIP | REC | KG"): each one starts a new session. */
const TABLE_HEADER_RE = /^esercizi[oi]\b.*\b(?:serie|rip|ripetizioni)\b/i;
/** Lines on a card that are never exercises: who it is for, dates, slogans, column names. */
const NOISE_RE = /^(?:nome|cognome|data|atleta|cliente|trainer|coach|istruttore|obiettivo|durata|frequenza|note?|kg|carico|serie e rip|work\.?\s*sweat)\b/i;
/** "per gamba", "x braccio": the count is per side. */
const PER_SIDE_RE = /\s*\b(?:per|x)\s+(gamba|braccio|lato)\b/i;
/** "Riscaldamento 5'", "Riscaldamento: 10 min". */
const WARMUP_RE = /^riscaldamento\b[\s:–\-—]*(?:(\d{1,2})\s*(?:min|m|'|’|′)?)?/i;
/** Short forms trainers write, spelled out so the name reads well and matches the exercise library. */
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bman\.?(?=\s|$)/gi, 'manubri'],
  [/\bmp\b/gi, 'multipower'],
  [/\bext\b\.?/gi, 'extension'],
  [/\bmov\.?(?=\s|$)/gi, 'movimento'],
  [/\bdelt\.?\s*post\.?\s*/gi, 'deltoidi posteriori '],
  [/\btbar\b/gi, 'T-bar'],
  [/\bx\s+(?=tricipiti|bicipiti|petto|spalle|dorsali)/gi, 'per '],
];
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
/** "4x10 303", "3010": three or four tempo digits written together (no rep count goes past 99). */
const TEMPO_COMPACT_RE = /(?<![0-9.,x×])([0-9])([0-9])([0-9])([0-9])?(?![0-9°'’′])/;

function extractTempo(line: string): TempoMatch | null {
  const compact = TEMPO_COMPACT_RE.exec(line);
  const m = TEMPO_LABELED_RE.exec(line) ?? TEMPO_BARE_RE.exec(line) ?? (compact && Number(compact[0]) >= 100 ? compact : null);
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
    for (const [i, c] of candidates.entries()) {
      if (!c) continue;
      // Same words as another exercise's keyword: the one actually named so wins ("Lat machine" over "Trazioni").
      const own = i === 0 ? 0.5 : 0;
      const score = n === c ? 1000 + c.length + own : c.length >= 6 && ` ${n} `.includes(` ${c} `) ? c.length + own : 0;
      if (score > 0 && (!best || score > best.score)) best = { def, score };
    }
  }
  return best?.def ?? null;
}

function restSeconds(line: string): { sec: number | null; rest: string } {
  const m = REST_TIME_RE.exec(line);
  if (!m) return { sec: null, rest: line };
  return { sec: toSeconds(Number(m[1]), m[2]), rest: line.replace(m[0], ' ') };
}

/** A rest written with or without a unit: minutes when it says so, or when it is a bare 1–5 ("rec 2", REC column "1"). */
function toSeconds(value: number, unit: string | undefined): number {
  const u = (unit ?? '').toLowerCase();
  const sec = ['min', 'm', "'", '’', '′'].includes(u) ? value * 60 : u ? value : value <= 5 ? value * 60 : value;
  return Math.min(600, Math.max(5, sec));
}

/** A table row read as text ends with its REC column: "Squat 2x20 10 8 8 12 1", "Leg curl 10 8 8 15 45se". */
const TABLE_REST_RE = /\s(\d{1,3})\s*(secondi|sec|se|s|"|″|min|'|’|′)?\s*$/i;

type Scheme = { sets: number; reps: string; text: string };

/**
 * The series of a line, in the ways cards write them:
 * "4x8", "3x10-12", "4x10+10+max" (drop set), "2x20, 10, 8, 8, 12" (two sets of 20 then a pyramid),
 * "10, 8, 8, 15" (one set per number).
 */
function extractScheme(input: string): Scheme | null {
  const line = input.replace(/[\s–—\-:;,.]+$/, '');
  const nxm = /(\d{1,2})\s*[x×*]\s*(\d{1,3}(?:\s*[-–/+]\s*(?:\d{1,3}|max))*(?:\s*(?:sec|s|"|″)(?![a-z]))?|max)((?:\s*[,;]?\s+\d{1,3}(?![\d°'’′x×]))*)/i.exec(line);
  if (nxm) {
    const first = Math.min(12, Math.max(1, Number(nxm[1])));
    const reps = nxm[2].replace(/\s+/g, '').replace(/″/g, '"');
    const more = (nxm[3].match(/\d{1,3}/g) ?? []).map(Number);
    if (more.length === 0) return { sets: first, reps, text: line.replace(nxm[0], ' ') };
    const list = [...Array<string>(first).fill(reps), ...more.map(String)];
    return { sets: Math.min(12, list.length), reps: list.join('/'), text: line.replace(nxm[0], ' ') };
  }
  // Only numbers after the name ("Leg curl: 10, 8, 8, 15"): one set each.
  const list = /(?:^|[\s:–—-])(\d{1,3}(?:\s*[,;/]?\s+\d{1,3}|\s*[,;/]\s*\d{1,3}){1,9})\s*$/.exec(line);
  if (list) {
    const reps = list[1].match(/\d{1,3}/g)!.map(Number);
    if (reps.every((r) => r >= 1 && r <= 50)) return { sets: Math.min(12, reps.length), reps: reps.join('/'), text: line.slice(0, list.index) + ' ' };
  }
  return null;
}

function cleanName(text: string): string {
  let name = text
    .replace(/[:;,()–—|]+/g, ' ')
    .replace(/\s+-\s+|\s+-$|^-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, to] of ABBREVIATIONS) name = name.replace(re, to);
  name = name.replace(/\s+/g, ' ').trim();
  // "SQUAT BULGARO" → "Squat bulgaro"
  if (name === name.toUpperCase() && /[A-Z]{3}/.test(name)) name = name.toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function parseExerciseLine(raw: string, defaultTempo: string, fromTable = false): { entry: TrainingExerciseEntry; guessed: boolean } | null {
  let cleaned = raw.replace(BULLET_RE, '').replace(/×/g, 'x').trim();
  const warmup = WARMUP_RE.exec(cleaned);
  if (warmup) {
    return {
      entry: { id: 'custom-riscaldamento', name: 'Riscaldamento', sets: 1, reps: warmup[1] ? `${warmup[1]} min` : '5 min', restSec: 0, suggestedKg: null, tempo: defaultTempo },
      guessed: false,
    };
  }
  let { sec, rest: withoutRest } = restSeconds(cleaned);
  if (sec == null && fromTable) {
    const col = TABLE_REST_RE.exec(withoutRest);
    if (col && (col[2] || Number(col[1]) <= 5)) {
      sec = toSeconds(Number(col[1]), col[2]);
      withoutRest = withoutRest.slice(0, col.index);
    }
  }
  const side = PER_SIDE_RE.exec(withoutRest);
  if (side) withoutRest = withoutRest.replace(side[0], ' ');
  const tempoMatch = extractTempo(withoutRest);
  cleaned = tempoMatch ? tempoMatch.text : withoutRest;
  const scheme = extractScheme(cleaned);
  const name = cleanName(scheme ? scheme.text : cleaned);
  if (name.length < 2 || !/[a-zàèéìòù]/i.test(name)) return null;
  const known = matchLibraryExercise(name);
  return {
    entry: {
      id: known?.id ?? `custom-${slug(name)}`,
      name: side ? `${name} (per ${side[1].toLowerCase()})` : name,
      sets: scheme?.sets ?? 3,
      reps: scheme?.reps ?? '10',
      restSec: sec ?? DEFAULT_REST_SEC,
      suggestedKg: null,
      tempo: tempoMatch?.tempo ?? defaultTempo,
    },
    guessed: !scheme,
  };
}

type Block = { weekdayIndex: number | null; title: string; lines: string[]; tempo?: string; /** Opened by a printed table's header row. */ table?: boolean };

function dayFromBlock(weekday: string, block: Block, globalTempo: string, warnings: string[], guessedNames: Set<string>): TrainingDayPlan {
  const title = block.title;
  const exercises: TrainingExerciseEntry[] = [];
  const seenIds = new Map<string, number>();
  for (const line of block.lines) {
    const parsed = parseExerciseLine(line, block.tempo ?? globalTempo, block.table);
    if (!parsed) {
      warnings.push(`Riga ignorata (${weekday}): “${line.trim()}”`);
      continue;
    }
    const { entry } = parsed;
    if (parsed.guessed) guessedNames.add(entry.name);
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

/** "GAMBE" → "Gambe": headers printed in capitals read as a normal title. */
function sentenceCase(text: string): string {
  if (!text || text !== text.toUpperCase() || !/[A-Z]{2}/.test(text)) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Without any session header, a known exercise with no series ("Addome", "Plank") is still an exercise, not a new day. */
function looksLikeExercise(line: string): boolean {
  return /^(?:addom|addominali|core|plank|crunch|riscaldamento|defaticamento|stretching)/i.test(line) || (matchLibraryExercise(line) != null && !REST_RE.test(line) && !CARDIO_RE.test(line));
}

/** Text of a card → the 7 days of a week (Lun…Dom). */
export function parseCustomWorkout(text: string): CustomParseResult {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: 'Incolla o scrivi la tua scheda per continuare.' };

  const hasWeekdays = lines.some((l) => WEEKDAY_RE.test(l.replace(BULLET_RE, '')) && !SCHEME_RE.test(l));
  // Cards that name their sessions ("Giorno 1 — Gambe", a table per day): only those lines open a session,
  // so "Addome" or "Leg curl: 10, 8, 8, 15" stay exercises even without an "NxM".
  const hasSessionHeaders = lines.some((l) => {
    const bare = l.replace(BULLET_RE, '').trim();
    return (SESSION_HEADER_RE.test(bare) || TABLE_HEADER_RE.test(bare)) && !SCHEME_RE.test(bare);
  });
  const blocks: Block[] = [];
  const warnings: string[] = [];

  let globalTempo = DEFAULT_TEMPO;
  let tables = 0;

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
    const hasScheme = SCHEME_RE.test(bare);
    if (TABLE_HEADER_RE.test(bare) && !hasScheme) {
      // A table's header row: the next table is the next session; the column names are not exercises.
      tables += 1;
      blocks.push({ weekdayIndex: null, title: '', lines: [], table: true });
      continue;
    }
    if (NOISE_RE.test(bare) && !hasScheme) continue;
    const dayMatch = WEEKDAY_RE.exec(bare);
    const sessionMatch = dayMatch ? null : SESSION_HEADER_RE.exec(bare);
    const isHeader = hasWeekdays
      ? dayMatch != null && !hasScheme
      : hasSessionHeaders
        ? sessionMatch != null && !hasScheme
        : !hasScheme && extractScheme(bare.replace(/×/g, 'x')) == null && !looksLikeExercise(bare);
    if (isHeader) {
      const match = dayMatch ?? sessionMatch;
      const title = (match ? bare.slice(match[0].length) : bare).replace(/^[\s:–\-—.,]+/, '').replace(/[\s:–\-—]+$/, '');
      blocks.push({
        weekdayIndex: dayMatch ? WEEKDAY_LABELS.findIndex((w) => w.toLowerCase() === dayMatch[1].slice(0, 3).toLowerCase()) : null,
        title: sentenceCase(title),
        lines: [],
      });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].lines.push(line);
    } else if (hasWeekdays || hasSessionHeaders) {
      // Before the first day: the card's own heading (gym name, title). Not an exercise.
      continue;
    } else {
      return { ok: false, error: 'Inizia ogni giorno con il suo nome, ad esempio “Lunedì – Petto”, e sotto metti gli esercizi.' };
    }
  }
  // Untitled sessions (a table per day) take a letter: Allenamento A, B, C…
  let letter = 0;
  for (const b of blocks) if (!b.title && b.lines.length > 0) b.title = `Allenamento ${String.fromCharCode(65 + letter++)}`;
  if (tables > 0) warnings.push('Scheda a tabelle: ogni tabella è un allenamento; la colonna REC è letta in minuti se non c’è l’unità.');

  const sessions = blocks.filter((b) => !(b.lines.length === 0 && REST_RE.test(b.title)));
  if (blocks.length === 0 || blocks.every((b) => b.lines.length === 0 && !CARDIO_RE.test(b.title))) {
    return { ok: false, error: 'Non trovo esercizi. Scrivi ogni esercizio su una riga, ad esempio “Panca piana 4x8”.' };
  }
  if (!hasWeekdays && sessions.length > 7) return { ok: false, error: 'Una settimana può avere al massimo 7 allenamenti.' };

  const week: (TrainingDayPlan | null)[] = Array(7).fill(null);
  const guessedNames = new Set<string>();
  if (hasWeekdays) {
    for (const block of blocks) {
      const index = block.weekdayIndex ?? -1;
      if (index < 0) continue;
      if (week[index]) {
        warnings.push(`${WEEKDAY_LABELS[index]} compare due volte: tengo la prima.`);
        continue;
      }
      week[index] = dayFromBlock(WEEKDAY_LABELS[index], block, globalTempo, warnings, guessedNames);
    }
  } else {
    const slots = WEEKDAY_PATTERN[sessions.length] ?? [];
    sessions.forEach((block, i) => {
      week[slots[i]] = dayFromBlock(WEEKDAY_LABELS[slots[i]], block, globalTempo, warnings, guessedNames);
    });
  }

  if (guessedNames.size > 0) warnings.push(`Serie non indicate per ${[...guessedNames].join(', ')}: uso 3×10, puoi scriverle nel testo.`);
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
