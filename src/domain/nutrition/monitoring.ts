/**
 * Module A — Monitoring. Collects and validates every datum of a monthly check-in and turns the free-text
 * notes into structured facts. Nothing collected is dropped: every answer either feeds the analysis or becomes
 * a clarification question. When a note cannot be read reliably the engine asks, it never guesses.
 */
import { foodsNamedIn } from '@/lib/planning/fitlab/pools';

import type { ActivityChange, Energy, Hunger, MonitoringData, NoteFacts, QuantityDirection, SkippedMeals, SpecialCondition, TemporaryEvent } from './types';

/** The check-in as the engine receives it (see `checkinSignals` in lib/planning/month-adherence.ts). */
export type CheckinInput = {
  adherence?: number;
  energy?: Energy;
  hunger?: Hunger;
  difficulty?: string[];
  wantsChange?: string[];
  quantityDirection?: QuantityDirection;
  skippedMeals?: SkippedMeals;
  eatingOutPerWeek?: number;
  preferredTimes?: string;
  foodsToReplace?: string;
  foodsWanted?: string;
  activityChange?: ActivityChange;
  waistCm?: number;
  events?: string[];
  specialConditions?: string[];
  notes?: string;
  /** Structured note reading from an AI agent: merged with the deterministic one, validated the same way. */
  aiNoteFacts?: Partial<NoteFacts>;
};

const norm = (t: string) => t.toLowerCase().replace(/[’‘]/g, "'").normalize('NFD').replace(/[̀-ͯ]/g, '');

const NUMBER_WORDS: Record<string, number> = { una: 1, un: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7 };

const EVENT_PATTERNS: { event: TemporaryEvent; re: RegExp }[] = [
  { event: 'travel', re: /viagg|vacanz|trasfert|in giro per lavoro|fuori citta/ },
  { event: 'illness', re: /malat|influenz|febbre|covid|raffreddor|intossicaz/ },
  { event: 'cycle', re: /ciclo|mestru|ritenzion|gonfi/ },
  { event: 'salty', re: /molto sale|salat|matrimoni|festa|feste|cena di natale|pranzo di famiglia|sushi/ },
  { event: 'intenseTraining', re: /gara|maratona|allenament[oi] (molto |piu )?intens|carichi molto alti/ },
  { event: 'stress', re: /esam|stress|scadenz|trasloc|lavoro intenso|turni|sessione/ },
];

const CONDITION_PATTERNS: { condition: SpecialCondition; re: RegExp }[] = [
  { condition: 'pregnancy', re: /incinta|gravidanz|in attesa di un bambin/ },
  { condition: 'breastfeeding', re: /allatt/ },
  { condition: 'medical', re: /diabet|tiroid|farmac|terapia|patolog|insufficienza|celiachia diagnosticata|pressione alta|il medico mi ha/ },
  { condition: 'eatingDisorder', re: /anoress|bulimi|binge|abbuffat|disturb[oi] (del comportamento )?alimentar|\bdca\b/ },
];

/** Deterministic reading of the notes. Each sentence is either understood or listed as unclear. */
export function parseNotes(text: string | undefined): NoteFacts {
  const facts: NoteFacts = { events: [], specialConditions: [], foodsToReplace: [], foodsWanted: [], unclear: [] };
  if (!text || !text.trim()) return facts;
  const sentences = norm(text).split(/[.;!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  for (const s of sentences) {
    let understood = false;
    const out = s.match(/(cen[ae]|pranz[oi]|pasti)\s+(di lavoro|fuori|al ristorante|aziendal|con client|di rappresentanza)|ristorant|aperitiv|mensa|pizza con/);
    if (out) {
      const slot = /cen/.test(out[0]) ? 'cena' : /pranz|mensa/.test(out[0]) ? 'pranzo' : 'any';
      const count = s.match(/\b(una|un|uno|due|tre|quattro|cinque|sei|sette|[1-7])\b[^,]*?(a settimana|alla settimana|ogni settimana|settimanal)/);
      facts.eatingOut = { slot, perWeek: count ? NUMBER_WORDS[count[1]] ?? null : null };
      understood = true;
    }
    for (const p of EVENT_PATTERNS) if (p.re.test(s) && !facts.events.includes(p.event)) { facts.events.push(p.event); understood = true; }
    for (const p of CONDITION_PATTERNS) if (p.re.test(s) && !facts.specialConditions.includes(p.condition)) { facts.specialConditions.push(p.condition); understood = true; }
    const replace = s.match(/(?:non mi piac\w*|non sopporto|basta|stufo di|stufa di|sostituire|togliere|eliminare|senza)\s+(.+)/);
    if (replace) {
      const ids = [...foodsNamedIn(replace[1])];
      if (ids.length > 0) { facts.foodsToReplace.push(...ids); understood = true; }
    }
    const want = s.match(/(?:vorrei|mi piacerebbe|preferirei|aggiungere|inserire|piu)\s+(.+)/);
    if (want && !replace) {
      const ids = [...foodsNamedIn(want[1])];
      if (ids.length > 0) { facts.foodsWanted.push(...ids); understood = true; }
    }
    // weighing remarks are context for the data-quality check, not something to act on
    if (/pesat|bilancia|pesarmi/.test(s)) understood = true;
    if (!understood && s.length >= 12) facts.unclear.push(s);
  }
  return facts;
}

const SLOT_WORDS: { slot: string; re: RegExp }[] = [
  { slot: 'colazione', re: /colazion/ },
  { slot: 'spuntinoMattina', re: /spuntino (di )?(meta )?mattin|meta mattin/ },
  { slot: 'pranzo', re: /pranz/ },
  { slot: 'spuntinoPomeriggio', re: /merend|spuntino (del )?pomerig/ },
  { slot: 'cena', re: /cen[ae]/ },
  { slot: 'spuntinoSera', re: /pre.?nanna|spuntino (della )?sera/ },
];

/** "pranzo 14:00, cena 21" → { pranzo: '14:00', cena: '21:00' }. Unparseable parts are reported. */
export function parsePreferredTimes(text: string | undefined): { times: Partial<Record<string, string>>; unclear: boolean } {
  const times: Partial<Record<string, string>> = {};
  if (!text || !text.trim()) return { times, unclear: false };
  const parts = norm(text).split(/[,;\n]+|\be\b/).map((p) => p.trim()).filter(Boolean);
  let unclear = false;
  for (const part of parts) {
    const slot = SLOT_WORDS.find((w) => w.re.test(part))?.slot;
    const m = part.match(/\b([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/);
    if (slot && m) times[slot] = `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`;
    else unclear = true;
  }
  return { times, unclear: unclear || Object.keys(times).length === 0 };
}

const ENERGIES: Energy[] = ['veryLow', 'low', 'normal', 'high', 'veryHigh'];
const HUNGERS: Hunger[] = ['never', 'rarely', 'sometimes', 'often', 'always'];

export function monitor(c: CheckinInput): MonitoringData {
  const used: string[] = [];
  const clarifications: string[] = [];
  const mark = (id: string, present: boolean) => { if (present) used.push(id); };

  const adherenceSelf = c.adherence != null && c.adherence >= 1 && c.adherence <= 5 ? Math.round(c.adherence) : null;
  mark('aderenza', adherenceSelf != null);
  const energy = c.energy && ENERGIES.includes(c.energy) ? c.energy : null;
  mark('energia', energy != null);
  const hunger = c.hunger && HUNGERS.includes(c.hunger) ? c.hunger : null;
  mark('fame', hunger != null);
  const difficulties = (c.difficulty ?? []).filter((d) => d !== 'none');
  mark('difficoltà', (c.difficulty ?? []).length > 0);
  const wantsChange = (c.wantsChange ?? []).filter((d) => d !== 'nothing');
  mark('cosa cambiare', (c.wantsChange ?? []).length > 0);

  // notes: deterministic reading, merged with an AI reading when available (lists are unioned, never trusted blindly:
  // food ids must exist in the catalog, conditions and events must be known values)
  const fromText = parseNotes(c.notes);
  const ai = c.aiNoteFacts;
  const notesFacts: NoteFacts = ai
    ? {
      eatingOut: fromText.eatingOut ?? ai.eatingOut,
      events: [...new Set([...fromText.events, ...(ai.events ?? []).filter((e) => EVENT_PATTERNS.some((p) => p.event === e))])],
      specialConditions: [...new Set([...fromText.specialConditions, ...(ai.specialConditions ?? []).filter((x) => CONDITION_PATTERNS.some((p) => p.condition === x))])],
      foodsToReplace: [...new Set([...fromText.foodsToReplace, ...(ai.foodsToReplace ?? [])])],
      foodsWanted: [...new Set([...fromText.foodsWanted, ...(ai.foodsWanted ?? [])])],
      unclear: ai.unclear ?? fromText.unclear,
    }
    : fromText;
  mark('note', !!c.notes?.trim());
  for (const u of notesFacts.unclear) clarifications.push(`Nelle note hai scritto “${u}”: puoi spiegarmi meglio cosa intendi, così ne tengo conto nel piano?`);

  // food quantity: the direction decides the intervention. Explicit answer first; otherwise it is deduced from
  // hunger only when hunger leaves no doubt, and marked as deduced. Otherwise: ask.
  let quantity: MonitoringData['quantity'] = null;
  if (c.quantityDirection) quantity = { direction: c.quantityDirection, inferred: false };
  else if (difficulties.includes('foodQuantity')) {
    if (hunger === 'often' || hunger === 'always') quantity = { direction: 'tooLittle', inferred: true };
    else if (hunger === 'never' || hunger === 'rarely') quantity = { direction: 'tooMuch', inferred: true };
    else {
      quantity = { direction: null, inferred: false };
      clarifications.push('Hai indicato difficoltà con le quantità: le porzioni ti sono sembrate troppo abbondanti o troppo scarse?');
    }
  }
  mark('quantità', quantity != null);

  const skippedMeals = c.skippedMeals ?? null;
  mark('pasti saltati', skippedMeals != null);
  const eatingOutPerWeek = c.eatingOutPerWeek ?? notesFacts.eatingOut?.perWeek ?? null;
  const eatingOutSlot = notesFacts.eatingOut?.slot ?? (c.eatingOutPerWeek ? 'any' : null);
  if (notesFacts.eatingOut && notesFacts.eatingOut.perWeek == null && c.eatingOutPerWeek == null)
    clarifications.push('Nelle note parli di pasti fuori casa: quante volte a settimana, e a pranzo o a cena?');
  mark('pasti fuori', eatingOutPerWeek != null || notesFacts.eatingOut != null);

  const parsedTimes = parsePreferredTimes(c.preferredTimes);
  mark('orari desiderati', !!c.preferredTimes?.trim());
  if (wantsChange.includes('mealTimes') && (parsedTimes.unclear || !c.preferredTimes)) {
    clarifications.push('Vuoi cambiare gli orari dei pasti: a che ora ti è comodo mangiare (es. “pranzo 14:00, cena 21:00”)? Nel frattempo gli orari diventano flessibili.');
  }

  const toReplaceText = c.foodsToReplace?.trim() ? [...foodsNamedIn(norm(c.foodsToReplace))] : [];
  const wantedText = c.foodsWanted?.trim() ? [...foodsNamedIn(norm(c.foodsWanted))] : [];
  if (c.foodsToReplace?.trim() && toReplaceText.length === 0) clarifications.push(`Non ho riconosciuto gli alimenti da sostituire (“${c.foodsToReplace.trim()}”): puoi indicarli con il loro nome?`);
  if (c.foodsWanted?.trim() && wantedText.length === 0) clarifications.push(`Non ho riconosciuto gli alimenti che vorresti (“${c.foodsWanted.trim()}”): puoi indicarli con il loro nome?`);
  mark('alimenti da sostituire', !!c.foodsToReplace?.trim());
  mark('nuove preferenze', !!c.foodsWanted?.trim());

  const activityChange = c.activityChange ?? null;
  mark('attività', activityChange != null);
  const waistCm = c.waistCm != null && c.waistCm > 40 && c.waistCm < 200 ? c.waistCm : null;
  mark('circonferenza vita', waistCm != null);

  const events = [...new Set([...(c.events ?? []).filter((e): e is TemporaryEvent => EVENT_PATTERNS.some((p) => p.event === e)), ...notesFacts.events])];
  mark('eventi del mese', (c.events ?? []).length > 0);
  const specialConditions = [...new Set([...(c.specialConditions ?? []).filter((x): x is SpecialCondition => CONDITION_PATTERNS.some((p) => p.condition === x)), ...notesFacts.specialConditions])];
  mark('situazioni particolari', (c.specialConditions ?? []).length > 0);

  return {
    adherenceSelf,
    energy,
    hunger,
    difficulties,
    wantsChange,
    quantity,
    skippedMeals,
    eatingOutPerWeek,
    eatingOutSlot,
    preferredTimes: parsedTimes.times,
    foodsToReplace: [...new Set([...toReplaceText, ...notesFacts.foodsToReplace])],
    foodsWanted: [...new Set([...wantedText, ...notesFacts.foodsWanted])],
    activityChange,
    waistCm,
    events,
    specialConditions,
    notes: c.notes?.trim() ?? '',
    notesFacts,
    clarifications,
    used,
  };
}
