/**
 * Which known exercise a free-text name refers to ("Panca piana 4x8", "Croci inclinata", "Scrollate").
 * Searches every exercise that has a GIF: the old library, the training catalog and the extra
 * exercises trainers write on their cards (exercise-media-named.ts). Used when a card is imported
 * and, for plans saved before an exercise was known, when its GIF is looked up.
 */
import { GYM_EXERCISES, HOME_EXERCISES } from '@/lib/planning/exercise-library';
import { CATALOG } from '@/lib/planning/training/catalog';

import { NAMED_MEDIA } from './exercise-media-named';

export type KnownExercise = { id: string; name: string };

/** Each term with its tie-break bonus: the exercise's own name 0.5, an alias 0.25 (so "face pull" means the cable one). */
type Candidate = KnownExercise & { terms: { text: string; bonus: number }[] };

/** Other ways trainers write catalog exercises, beyond the catalog's own keywords. */
const ALIASES: Record<string, string[]> = {
  'panca-piana': ['distensioni su panca piana', 'panca bilanciere', 'bench press'],
  'panca-manubri': ['spinte', 'spinte con manubri', 'spinte su panca piana', 'distensioni manubri panca piana', 'panca piana manubri', 'dumbbell press'],
  'panca-inclinata-manubri': ['spinte a 15', 'spinte a 30', 'spinte a 45', 'spinte inclinate', 'spinte su panca inclinata', 'panca inclinata manubri', 'distensioni panca inclinata manubri'],
  'panca-inclinata-bilanciere': ['panca inclinata', 'panca inclinata bilanciere', 'incline bench'],
  'chest-press-machine': ['chest press', 'distensioni alla macchina'],
  'croci-cavi': ['cavi incrociati', 'croci ai cavi', 'croci al cavo', 'croci cavi', 'cable crossover', 'croci ai cavi alti', 'croci cavo'],
  'pec-deck': ['pec deck', 'peck deck', 'pectoral machine', 'butterfly'],
  'croci-manubri': ['croci manubri', 'croci panca piana', 'croci su panca piana', 'croci'],
  'dip-parallele': ['dip parallele', 'dips', 'parallele'],
  'lat-machine': ['pull down', 'pulldown', 'lat machine', 'lat pulldown', 'lat machine avanti', 'lat machine presa larga'],
  'lat-machine-neutra': ['lat machine con triangolo', 'pull down triangolo', 'lat machine triangolo', 'lat machine presa stretta', 'lat triangolo'],
  crunch: ['addome', 'addominali', 'crunch addome'],
  'croci-inclinata': ['croci a 30', 'croci a 45', 'croci a 15', 'croci inclinate con manubri'],
  'lat-presa-inversa': ['lat machine inversa', 'pull down inverso', 'pull down presa inversa'],
  'face-pull': ['face pull', 'face pull corda', 'face pull al cavo'],
  'french-press-bilanciere': ['french press'],
  pulley: ['pulley', 'pulley basso', 'rematore al cavo basso', 'seated row', 'pulley triangolo'],
  'rematore-manubrio': ['rematore manubrio', 'rematore con manubrio', 'rematore a un braccio', 'rematore monolaterale'],
  'rematore-bilanciere': ['rematore bilanciere', 'rematore con bilanciere', 'barbell row'],
  'military-press': ['lento avanti', 'military', 'lento in piedi'],
  'shoulder-press-manubri': ['lento manubri', 'distensioni manubri sopra la testa', 'spinte manubri', 'lento avanti manubri'],
  'alzate-laterali': ['alzate laterali', 'alzate laterali manubri', 'lateral raise'],
  'alzate-laterali-cavo': ['alzate laterali cavo', 'alzate laterali al cavo'],
  'alzate-posteriori-manubri': ['deltoidi posteriori', 'deltoidi posteriori a 45', 'posteriori a 45', 'alzate posteriori', 'alzate a 90', 'croci inverse manubri'],
  'back-squat': ['squat bilanciere', 'squat con bilanciere', 'back squat'],
  'leg-press': ['leg press 45', 'pressa 45', 'pressa orizzontale'],
  'romanian-deadlift': ['stacchi rumeni', 'stacco rumeno bilanciere', 'stacco a gambe tese', 'stacchi a gambe tese', 'stiff leg'],
  'stacco-da-terra': ['stacco', 'stacchi', 'deadlift', 'stacco da terra'],
  'leg-curl-machine': ['leg curl seduto', 'leg curl'],
  'hip-thrust': ['hip thrust', 'hip thrust bilanciere', 'spinte d anca'],
  'polpacci-macchina': ['calf machine', 'polpacci alla macchina', 'calf seduto', 'calf raise seduto'],
  'polpacci-piedi': ['calf in piedi', 'polpacci in piedi', 'calf raise', 'polpacci'],
  'curl-bicipiti': ['curl bilanciere', 'curl con bilanciere', 'barbell curl'],
  'curl-manubri': ['curl manubri', 'curl alternato', 'curl alternati', 'curl con manubri'],
  'hammer-curl': ['curl a martello', 'hammer'],
  'pushdown-cavo': ['cavi incrociati per tricipiti', 'cavi per tricipiti', 'tricipiti ai cavi', 'push down', 'pushdown', 'push down corda', 'tricipiti al cavo', 'estensioni tricipiti cavo', 'push down al cavo'],
  'french-press-manubrio': ['french press manubrio', 'estensioni sopra la testa manubrio', 'french press seduto'],
  'dip-sedia': ['dip su panca', 'dip alla panca', 'bench dip', 'dip tra panche'],
  plank: ['plank', 'plank frontale', 'plank sui gomiti'],
  'leg-raise': ['leg raise', 'sollevamento gambe', 'knee raise', 'ginocchia al petto alla sbarra'],
  'crunch-cavo': ['crunch al cavo', 'crunch cavo', 'crunch alla corda'],
  'push-up': ['flessioni', 'piegamenti sulle braccia'],
  'trazioni-sbarra': ['trazioni alla sbarra', 'trazioni presa prona', 'pull up'],
  'affondi-manubri': ['affondi con manubri', 'affondi manubri', 'affondi in camminata'],
  'bulgarian-split-squat': ['affondi bulgari', 'bulgarian', 'split squat bulgaro'],
  'hip-thrust-corpo-libero': ['ponte glutei', 'glute bridge a terra', 'ponte per glutei'],
  'abductor-machine': ['abductor', 'abduttori', 'abduzioni alla macchina'],
  'adductor-machine': ['adductor', 'adduttori', 'adduzioni alla macchina'],
};

export function normalizeExerciseName(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let candidates: Candidate[] | null = null;

function allCandidates(): Candidate[] {
  if (candidates) return candidates;
  const byId = new Map<string, Candidate>();
  const add = (id: string, name: string, words: string[], bonus = 0) => {
    const terms = words.map((w) => ({ text: normalizeExerciseName(w), bonus }));
    const known = byId.get(id);
    // Same id named differently by the old library and the catalog: both names are its own.
    if (known) known.terms.push({ text: normalizeExerciseName(name), bonus: 0.5 }, ...terms);
    else byId.set(id, { id, name, terms: [{ text: normalizeExerciseName(name), bonus: 0.5 }, ...terms] });
  };
  for (const list of [...Object.values(GYM_EXERCISES), ...Object.values(HOME_EXERCISES)]) for (const def of list) add(def.id, def.name, def.keywords);
  for (const def of CATALOG) add(def.id, def.name, def.keywords);
  for (const def of NAMED_MEDIA) add(def.id, def.name, def.keywords);
  for (const [id, words] of Object.entries(ALIASES)) if (byId.has(id)) add(id, byId.get(id)!.name, words, 0.25);
  candidates = [...byId.values()];
  return candidates;
}

/** Every name a known exercise goes by (several when the old library and the catalog name it differently). */
export function isOwnName(id: string, name: string): boolean {
  const n = normalizeExerciseName(name);
  return allCandidates().some((c) => c.id === id && c.terms.some((t) => t.text === n));
}

/**
 * The known exercise a typed name refers to, or null. Exact names win; otherwise the longest term the name
 * contains. On a tie the exercise actually named so wins ("Lat machine" over "Trazioni"), then an alias.
 */
export function matchExerciseName(name: string): KnownExercise | null {
  const n = normalizeExerciseName(name);
  if (!n) return null;
  let best: { c: Candidate; score: number } | null = null;
  for (const c of allCandidates()) {
    for (const { text, bonus } of c.terms) {
      if (!text) continue;
      const score = n === text ? 1000 + text.length + bonus : text.length >= 6 && ` ${n} `.includes(` ${text} `) ? text.length + bonus : 0;
      if (score > 0 && (!best || score > best.score)) best = { c, score };
    }
  }
  return best ? { id: best.c.id, name: best.c.name } : null;
}
