/**
 * Allenamento veloce: a single workout for one goal (glutes, chest, cross training, HIIT…), outside the weekly plan.
 *
 * Every goal has three proposals for the gym and three for home, shown as a deck the person swipes through; the
 * order rotates with the day, so the first card changes every day. The exercises come from the engine's catalog
 * (same names, cues and GIFs as the plan) plus a few conditioning ones that only have a GIF (burpee, salto della
 * corda…), and follow the same rules: compound first, then isolation, 1–2 reps in reserve, rests sized on the kind
 * of exercise. Starting loads use the plan's load engine (estimated, always to calibrate); later sessions use the
 * person's own logged sets. Duration and calories are estimated from the sets and rests and the activity's MET, the
 * same estimate used when the workout is logged. Plain data, no React Native import.
 */
import { estimateActivityKcal, type ActivityIntensity, type ActivityType } from '@/lib/nutrition/activity-log';

import type { TrainingExerciseEntry } from '../types';
import { CATALOG_BY_ID, MUSCLE_SHORT, type CatalogExercise, type Equipment } from './catalog';
import { initialLoad } from './loads';
import type { Level } from './profile';

export type SpotFocus = 'glutes' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'total' | 'functional' | 'cross' | 'hiit';
export type SpotPlace = 'gym' | 'home';

/** [exercise id (catalog or EXTRA), sets, reps ("8-10", or "40 s" for a timed set), rest in seconds] */
type Item = [string, number, string, number];
type Template = { title: string; note: string; intensity: ActivityIntensity; activity: ActivityType; items: Item[] };

export const SPOT_FOCUS: { value: SpotFocus; label: string; blurb: string }[] = [
  { value: 'glutes', label: 'Glutei', blurb: 'Spinta d’anca e affondi' },
  { value: 'legs', label: 'Gambe', blurb: 'Quadricipiti e femorali' },
  { value: 'chest', label: 'Petto', blurb: 'Spinte e croci' },
  { value: 'back', label: 'Schiena', blurb: 'Trazioni e rematori' },
  { value: 'shoulders', label: 'Spalle', blurb: 'Deltoidi su tre lati' },
  { value: 'arms', label: 'Braccia', blurb: 'Bicipiti e tricipiti' },
  { value: 'core', label: 'Addome', blurb: 'Core e stabilità' },
  { value: 'total', label: 'Total body', blurb: 'Tutto il corpo' },
  { value: 'functional', label: 'Funzionale', blurb: 'Schemi motori, equilibrio e core' },
  { value: 'cross', label: 'Cross training', blurb: 'WOD di forza e condizionamento' },
  { value: 'hiit', label: 'HIIT', blurb: 'Intervalli ad alta intensità' },
];

/**
 * Exercises outside the engine's catalog that still have a GIF (exercise-media-named.ts): conditioning and a few
 * variants. Their load is never estimated (bodyweight, or the person sets it).
 */
const EXTRA: Record<string, { name: string; muscle: string; equipment: string[]; tempo: string }> = {
  burpee: { name: 'Burpee', muscle: 'Corpo intero', equipment: [], tempo: 'esplosivo' },
  'mountain-climber': { name: 'Mountain climber', muscle: 'Core', equipment: [], tempo: 'veloce' },
  'jumping-jack': { name: 'Jumping jack', muscle: 'Cardio', equipment: [], tempo: 'veloce' },
  'salto-corda': { name: 'Salto della corda', muscle: 'Cardio', equipment: ['Corda'], tempo: 'veloce' },
  'battle-rope': { name: 'Battle rope', muscle: 'Cardio', equipment: ['Battle rope'], tempo: 'veloce' },
  'farmer-walk': { name: 'Farmer walk', muscle: 'Presa e core', equipment: ['Manubri'], tempo: 'camminata' },
  'russian-twist': { name: 'Russian twist', muscle: 'Obliqui', equipment: [], tempo: '2-0-1-0' },
  crunch: { name: 'Crunch a terra', muscle: 'Core', equipment: [], tempo: '2-0-1-1' },
  'sit-up': { name: 'Sit-up', muscle: 'Core', equipment: [], tempo: '2-0-1-0' },
  'plank-laterale': { name: 'Plank laterale', muscle: 'Obliqui', equipment: [], tempo: 'isometria' },
  'step-up': { name: 'Step-up con manubri', muscle: 'Quadricipiti', equipment: ['Manubri', 'Panca'], tempo: '2-0-1-0' },
  'stacco-manubri': { name: 'Stacco con manubri', muscle: 'Femorali', equipment: ['Manubri'], tempo: '2-0-1-0' },
  'arnold-press': { name: 'Arnold press', muscle: 'Spalle anteriori', equipment: ['Manubri'], tempo: '2-0-1-0' },
  'alzate-frontali': { name: 'Alzate frontali con manubri', muscle: 'Spalle anteriori', equipment: ['Manubri'], tempo: '2-0-1-1' },
  iperestensioni: { name: 'Iperestensioni', muscle: 'Glutei', equipment: ['Panca'], tempo: '2-0-1-1' },
  'pull-through': { name: 'Pull through al cavo', muscle: 'Glutei', equipment: ['Cavi'], tempo: '2-0-1-1' },
  'croci-cavi-bassi': { name: 'Croci ai cavi dal basso', muscle: 'Petto', equipment: ['Cavi'], tempo: '2-0-1-1' },
  'push-up-inclinati': { name: 'Piegamenti inclinati', muscle: 'Petto', equipment: [], tempo: '3-0-1-0' },
  'push-up-diamante': { name: 'Piegamenti a diamante', muscle: 'Tricipiti', equipment: [], tempo: '3-0-1-0' },
  'panca-presa-stretta': { name: 'Panca presa stretta', muscle: 'Tricipiti', equipment: ['Bilanciere', 'Panca'], tempo: '2-0-1-0' },
};

const g = (title: string, note: string, items: Item[], intensity: ActivityIntensity = 'moderate'): Template => ({ title, note, intensity, activity: 'gym', items });
const f = (title: string, note: string, items: Item[], intensity: ActivityIntensity = 'moderate'): Template => ({ title, note, intensity, activity: 'functional', items });

const LIBRARY: Record<SpotFocus, Record<SpotPlace, Template[]>> = {
  glutes: {
    gym: [
      g('Glutei: forza e forma', 'Hip thrust pesante, poi lavoro in allungamento e gluteo medio.', [['hip-thrust', 4, '8-10', 120], ['bulgarian-split-squat', 3, '10-12', 90], ['stacco-rumeno-manubri', 3, '10-12', 90], ['abductor-machine', 3, '15-20', 60], ['kb-swing', 3, '15', 60]]),
      g('Glutei: volume', 'Più ripetizioni e recuperi brevi per un pump completo.', [['hip-thrust', 4, '12-15', 90], ['stacco-una-gamba', 3, '10-12', 75], ['affondi-manubri', 3, '12', 75], ['leg-curl-machine', 3, '12-15', 60], ['abductor-machine', 3, '20', 45]]),
      g('Glutei: catena posteriore', 'Stacchi e iperestensioni per glutei e femorali.', [['romanian-deadlift', 4, '8-10', 120], ['hip-thrust', 3, '10', 90], ['pull-through', 3, '12-15', 60], ['iperestensioni', 3, '12-15', 60], ['abductor-machine', 3, '20', 45]]),
    ],
    home: [
      g('Glutei a corpo libero', 'Ponte, affondi e gluteo medio: serve solo un elastico.', [['hip-thrust-corpo-libero', 4, '15-20', 60], ['affondi', 3, '12', 60], ['squat-corpo-libero', 3, '15-20', 60], ['clamshell-elastico', 3, '20', 45], ['hip-thrust-corpo-libero', 2, '30 s', 45]]),
      g('Glutei con manubri', 'Manubri e una panca o una sedia stabile.', [['stacco-rumeno-manubri', 4, '10-12', 75], ['goblet-squat', 3, '12-15', 75], ['bulgarian-split-squat', 3, '10', 75], ['hip-thrust-corpo-libero', 3, '20', 45], ['clamshell-elastico', 3, '20', 45]]),
      g('Glutei con elastico', 'Tensione continua: niente pause in alto.', [['hip-thrust-corpo-libero', 4, '20', 45], ['clamshell-elastico', 3, '20', 30], ['affondi', 3, '12', 45], ['squat-corpo-libero', 3, '20', 45], ['hip-thrust-corpo-libero', 2, '40 s', 30]]),
    ],
  },
  legs: {
    gym: [
      g('Gambe complete', 'Spinta, catena posteriore e polpacci.', [['leg-press', 4, '8-10', 120], ['stacco-rumeno-manubri', 3, '8-10', 120], ['bulgarian-split-squat', 3, '10', 90], ['leg-extension', 3, '12-15', 60], ['leg-curl-machine', 3, '12-15', 60], ['polpacci-piedi', 3, '15', 45]], 'high'),
      g('Quadricipiti in evidenza', 'Accosciate profonde e lavoro isolato.', [['goblet-squat', 4, '10-12', 90], ['leg-press', 3, '12-15', 90], ['affondi-manubri', 3, '12', 75], ['leg-extension', 3, '15', 60], ['polpacci-piedi', 4, '15', 45]], 'high'),
      g('Gambe: forza', 'Squat pesante e pochi esercizi fatti bene.', [['back-squat', 4, '5-6', 150], ['romanian-deadlift', 3, '8', 120], ['leg-press', 3, '10-12', 90], ['leg-curl-machine', 3, '12', 60], ['polpacci-macchina', 4, '12', 45]], 'high'),
    ],
    home: [
      g('Gambe a corpo libero', 'Discesa lenta per sentire il lavoro senza carichi.', [['squat-corpo-libero', 4, '15-20', 60], ['affondi', 3, '12', 60], ['hip-thrust-corpo-libero', 3, '15', 45], ['polpacci-piedi', 3, '20', 30], ['squat-corpo-libero', 2, '40 s', 45]]),
      g('Gambe con manubri', 'Una coppia di manubri basta.', [['goblet-squat', 4, '10-12', 75], ['stacco-rumeno-manubri', 3, '10-12', 75], ['affondi-manubri', 3, '10', 75], ['step-up', 3, '10', 60], ['polpacci-piedi', 3, '20', 30]]),
      g('Gambe e fiato', 'Forza e un po’ di cardio tra un esercizio e l’altro.', [['squat-corpo-libero', 4, '20', 45], ['affondi', 4, '12', 45], ['jumping-jack', 3, '45 s', 30], ['hip-thrust-corpo-libero', 3, '15', 30], ['polpacci-piedi', 3, '20', 30]]),
    ],
  },
  chest: {
    gym: [
      g('Petto: spinta e allungamento', 'Una spinta pesante, una inclinata e croci in allungamento.', [['panca-manubri', 4, '8-10', 120], ['panca-inclinata-manubri', 3, '10-12', 90], ['croci-cavi', 3, '12-15', 60], ['chest-press-machine', 2, '12-15', 60], ['pushdown-cavo', 3, '12-15', 45]]),
      g('Petto alle macchine', 'Macchine e cavi: stabili, facili da spingere a fondo.', [['chest-press-machine', 4, '10-12', 90], ['panca-inclinata-manubri', 3, '10', 90], ['pec-deck', 3, '12-15', 60], ['croci-cavi', 3, '15', 45]]),
      g('Petto: bilanciere', 'Panca piana pesante, poi parallele e croci dal basso.', [['panca-piana', 4, '6-8', 150], ['panca-inclinata-manubri', 3, '10', 90], ['dip-parallele', 3, '8-10', 90], ['croci-cavi-bassi', 3, '12-15', 60]]),
    ],
    home: [
      g('Petto a corpo libero', 'Push-up in tre varianti di difficoltà.', [['push-up', 4, '10-15', 75], ['pike-push-up', 3, '8-10', 75], ['dip-sedia', 3, '10-12', 60], ['push-up', 2, '30 s', 60], ['plank', 2, '40 s', 45]]),
      g('Petto con manubri', 'Manubri e una panca, oppure a terra.', [['panca-manubri', 4, '10-12', 90], ['croci-manubri', 3, '12', 60], ['push-up', 3, '12-15', 60], ['french-press-manubrio', 3, '12', 45]]),
      g('Push-up progressivi', 'Dal più facile al più difficile, sempre a buona tecnica.', [['push-up-inclinati', 3, '15', 45], ['push-up', 4, '10-12', 60], ['push-up-diamante', 3, '8-10', 60], ['pike-push-up', 3, '8', 60]]),
    ],
  },
  back: {
    gym: [
      g('Schiena: ampiezza e spessore', 'Tirate verticali e orizzontali, poi deltoidi posteriori.', [['lat-machine', 4, '8-10', 120], ['pulley', 3, '10-12', 90], ['rematore-manubrio', 3, '10', 90], ['face-pull', 3, '15', 45], ['curl-manubri', 3, '10-12', 45]]),
      g('Schiena ai cavi', 'Tensione costante e scapole che lavorano.', [['lat-machine-neutra', 4, '10-12', 90], ['chest-supported-row', 3, '10-12', 90], ['pulley', 3, '12', 75], ['face-pull', 3, '15-20', 45]]),
      g('Schiena: forza', 'Trazioni e rematore con bilanciere.', [['trazioni-sbarra', 4, '5-8', 120], ['rematore-bilanciere', 4, '8', 120], ['pulley', 3, '12', 75], ['face-pull', 3, '15', 45]]),
    ],
    home: [
      g('Schiena con elastici', 'Un elastico fissato in alto e uno in basso.', [['trazioni-lat-elastico', 4, '12-15', 60], ['rematore-elastico', 4, '12-15', 60], ['ytw-prono', 3, '8', 45], ['face-pull-elastico', 3, '15', 45], ['curl-elastico', 3, '15', 45]]),
      g('Schiena con manubri', 'Rematori su una panca o un appoggio stabile.', [['rematore-manubrio', 4, '10-12', 75], ['chest-supported-row', 3, '12', 75], ['ytw-prono', 3, '8', 45], ['alzate-posteriori-manubri', 3, '15', 45]]),
      g('Schiena e postura', 'Rematore inverso sotto un tavolo robusto o una sbarra bassa.', [['rematore-inverso', 4, '8-12', 75], ['trazioni-lat-elastico', 3, '12', 60], ['ytw-prono', 3, '10', 45], ['face-pull-elastico', 3, '15', 45]]),
    ],
  },
  shoulders: {
    gym: [
      g('Spalle 3D', 'Spinta, alzate laterali e deltoide posteriore.', [['shoulder-press-manubri', 4, '8-10', 120], ['alzate-laterali', 4, '12-15', 60], ['alzate-laterali-cavo', 3, '15', 45], ['reverse-fly-machine', 3, '15', 45], ['face-pull', 3, '15', 45]]),
      g('Spalle alle macchine', 'Più volume sul laterale, dove si vede la spalla.', [['shoulder-press-machine', 3, '10-12', 90], ['alzate-laterali-cavo', 4, '12-15', 45], ['alzate-laterali', 3, '15-20', 45], ['reverse-fly-machine', 3, '15', 45]]),
      g('Spalle: forza', 'Lento in piedi, poi volume sui deltoidi.', [['military-press', 4, '6-8', 150], ['arnold-press', 3, '10', 75], ['alzate-laterali', 4, '12-15', 60], ['face-pull', 3, '15', 45]]),
    ],
    home: [
      g('Spalle con manubri', 'Manubri leggeri e tecnica pulita.', [['shoulder-press-manubri', 4, '10-12', 90], ['alzate-laterali', 4, '15', 45], ['alzate-posteriori-manubri', 3, '15', 45], ['pike-push-up', 3, '8-10', 60]]),
      g('Spalle con elastico', 'Un solo elastico, ripetizioni lente.', [['pike-push-up', 4, '8-10', 75], ['alzate-laterali-elastico', 4, '15-20', 45], ['face-pull-elastico', 3, '15-20', 45], ['ytw-prono', 3, '8', 45]], 'low'),
      g('Spalle complete', 'Tre angoli di lavoro con un paio di manubri.', [['arnold-press', 3, '10', 60], ['alzate-laterali', 4, '15', 45], ['alzate-frontali', 3, '12', 45], ['face-pull-elastico', 3, '15', 45]]),
    ],
  },
  arms: {
    gym: [
      g('Braccia: bicipiti e tricipiti', 'In alternanza, recuperi brevi.', [['curl-manubri', 3, '10-12', 60], ['pushdown-cavo', 3, '10-12', 60], ['curl-panca-inclinata', 3, '10-12', 60], ['french-press-cavo', 3, '12', 60], ['hammer-curl', 3, '12', 45], ['dip-parallele', 2, '8-12', 75]], 'low'),
      g('Braccia ai cavi', 'Tensione costante su tutta l’escursione.', [['curl-cavo', 4, '12', 45], ['pushdown-cavo', 4, '12', 45], ['french-press-cavo', 3, '12-15', 45], ['hammer-curl', 3, '12', 45]], 'low'),
      g('Braccia: bilanciere', 'Carichi più alti sui due esercizi base.', [['curl-bicipiti', 4, '8-10', 75], ['panca-presa-stretta', 4, '8', 90], ['curl-panca-inclinata', 3, '12', 60], ['pushdown-cavo', 3, '15', 45]], 'low'),
    ],
    home: [
      g('Braccia con manubri', 'Curl e estensioni sopra la testa.', [['curl-manubri', 4, '10-12', 60], ['french-press-manubrio', 4, '10-12', 60], ['hammer-curl', 3, '12', 45], ['dip-sedia', 3, '12-15', 45]], 'low'),
      g('Braccia con elastico', 'Elastico e una sedia.', [['curl-elastico', 4, '15', 45], ['estensioni-elastico', 4, '15', 45], ['dip-sedia', 3, '12-15', 45], ['push-up', 2, '10', 60]], 'low'),
      g('Braccia a corpo libero', 'Tricipiti con il peso del corpo, bicipiti con l’elastico.', [['push-up-diamante', 4, '8-12', 60], ['dip-sedia', 4, '12', 60], ['curl-elastico', 4, '15', 45], ['estensioni-elastico', 3, '15', 45]], 'low'),
    ],
  },
  core: {
    gym: [
      g('Core forte', 'Flessione, anti-estensione e anti-rotazione.', [['crunch-cavo', 4, '12-15', 45], ['leg-raise', 3, '10-12', 60], ['pallof-press', 3, '12', 45], ['plank', 3, '45 s', 45], ['dead-bug', 3, '10', 45]], 'low'),
      g('Addome ai cavi', 'Carico progressivo anche sull’addome.', [['crunch-cavo', 4, '10-12', 45], ['pallof-press', 4, '12', 45], ['leg-raise', 3, '10', 60], ['plank', 2, '60 s', 45]], 'low'),
      g('Addome completo', 'Retto, obliqui e stabilità in un solo giro.', [['leg-raise', 3, '10', 60], ['crunch-cavo', 3, '12', 45], ['russian-twist', 3, '20', 45], ['plank-laterale', 3, '30 s', 30], ['dead-bug', 3, '10', 30]], 'low'),
    ],
    home: [
      g('Addome a corpo libero', 'Dieci minuti di qualità, nessun attrezzo.', [['dead-bug', 3, '10', 30], ['plank', 3, '40 s', 30], ['crunch', 3, '20', 30], ['dead-bug', 2, '12', 30], ['plank', 2, '30 s', 30]], 'low'),
      g('Core e postura', 'Stabilità del tronco e schiena alta.', [['plank', 3, '45 s', 30], ['ytw-prono', 3, '8', 30], ['dead-bug', 3, '12', 30], ['plank-laterale', 3, '30 s', 30]], 'low'),
      g('Addome in 15 minuti', 'Ritmo alto, recuperi brevi.', [['crunch', 3, '20', 30], ['russian-twist', 3, '20', 30], ['mountain-climber', 3, '30 s', 30], ['plank-laterale', 2, '30 s', 30], ['plank', 2, '45 s', 30]], 'low'),
    ],
  },
  total: {
    gym: [
      g('Total body in sala', 'Un esercizio per ogni grande schema motorio.', [['goblet-squat', 3, '10-12', 75], ['panca-manubri', 3, '10', 75], ['lat-machine', 3, '10-12', 75], ['stacco-rumeno-manubri', 3, '10', 75], ['shoulder-press-manubri', 3, '10', 60], ['kb-swing', 3, '15', 45]], 'high'),
      g('Total body forza', 'I fondamentali con il bilanciere.', [['back-squat', 3, '6-8', 120], ['panca-piana', 3, '6-8', 120], ['rematore-bilanciere', 3, '8', 90], ['military-press', 3, '8', 90], ['farmer-walk', 3, '40 s', 60]], 'high'),
      g('Total body alle macchine', 'Sicuro e veloce, anche a fine giornata.', [['leg-press', 3, '12', 75], ['chest-press-machine', 3, '12', 75], ['lat-machine', 3, '12', 75], ['leg-curl-machine', 3, '12', 60], ['shoulder-press-machine', 3, '12', 60], ['plank', 2, '45 s', 45]]),
    ],
    home: [
      g('Total body corpo libero', 'Un giro completo senza attrezzi.', [['squat-corpo-libero', 3, '20', 45], ['push-up', 3, '12', 45], ['rematore-elastico', 3, '15', 45], ['affondi', 3, '12', 45], ['plank', 3, '40 s', 30]]),
      g('Total body con manubri', 'Manubri e poco spazio.', [['goblet-squat', 4, '12', 45], ['panca-manubri', 3, '12', 45], ['rematore-manubrio', 3, '12', 45], ['affondi-manubri', 3, '10', 45], ['dead-bug', 3, '10', 30]]),
      g('Total body con elastici', 'Spinte, tirate e gambe con due elastici.', [['squat-corpo-libero', 3, '20', 45], ['trazioni-lat-elastico', 3, '15', 45], ['push-up', 3, '12', 45], ['rematore-elastico', 3, '15', 45], ['hip-thrust-corpo-libero', 3, '15', 45]]),
    ],
  },
  functional: {
    gym: [
      f('Funzionale: schemi motori', 'Accosciata, cerniera, tirata, trasporto e anti-rotazione.', [['goblet-squat', 3, '12', 60], ['kb-swing', 3, '15', 60], ['rematore-manubrio', 3, '12', 60], ['farmer-walk', 3, '40 s', 60], ['pallof-press', 3, '12', 45], ['plank-laterale', 2, '30 s', 30]], 'low'),
      f('Funzionale: forza unilaterale', 'Un lato alla volta per equilibrio e simmetria.', [['bulgarian-split-squat', 3, '10', 75], ['stacco-una-gamba', 3, '10', 75], ['arnold-press', 3, '10', 60], ['rematore-manubrio', 3, '10', 60], ['farmer-walk', 3, '40 s', 60]], 'low'),
      f('Funzionale: potenza e core', 'Movimenti veloci e controllo del tronco.', [['kb-swing', 4, '12', 60], ['step-up', 3, '10', 60], ['push-up', 3, '12', 60], ['russian-twist', 3, '20', 45], ['dead-bug', 3, '10', 45]], 'low'),
    ],
    home: [
      f('Funzionale a corpo libero', 'Spinte, tirate, gambe e stabilità.', [['squat-corpo-libero', 3, '15', 45], ['affondi', 3, '12', 45], ['push-up', 3, '12', 45], ['rematore-elastico', 3, '15', 45], ['plank-laterale', 3, '30 s', 30], ['dead-bug', 3, '10', 30]], 'low'),
      f('Funzionale con manubri', 'Gli schemi di tutti i giorni, con un po’ di carico.', [['goblet-squat', 3, '12', 60], ['stacco-manubri', 3, '10', 60], ['step-up', 3, '10', 60], ['rematore-manubrio', 3, '12', 60], ['farmer-walk', 3, '40 s', 45]], 'low'),
      g('Mobilità e controllo', 'Ritmo lento, movimenti ampi e controllati.', [['ytw-prono', 3, '8', 30], ['dead-bug', 3, '10', 30], ['hip-thrust-corpo-libero', 3, '15', 30], ['affondi', 3, '10', 30], ['plank-laterale', 3, '30 s', 30]], 'low'),
    ],
  },
  cross: {
    gym: [
      f('WOD: chipper', 'Ritmo costante, 30 secondi tra una serie e l’altra.', [['kb-swing', 4, '15', 30], ['burpee', 4, '10', 30], ['goblet-squat', 4, '12', 30], ['push-up', 4, '12', 30], ['salto-corda', 4, '45 s', 30]], 'high'),
      f('WOD: forza e motore', 'Stacco pesante, poi condizionamento.', [['stacco-da-terra', 5, '5', 120], ['burpee', 3, '12', 45], ['battle-rope', 3, '30 s', 45], ['farmer-walk', 3, '40 s', 60]]),
      f('WOD: ginnico', 'Peso del corpo alla sbarra e alle parallele.', [['trazioni-sbarra', 4, '6-8', 90], ['dip-parallele', 4, '8-10', 90], ['mountain-climber', 4, '40 s', 30], ['plank', 3, '45 s', 30], ['jumping-jack', 3, '60 s', 30]], 'high'),
    ],
    home: [
      f('WOD a casa: chipper', 'Niente attrezzi, recuperi brevi.', [['burpee', 5, '10', 30], ['squat-corpo-libero', 5, '20', 30], ['push-up', 5, '12', 30], ['mountain-climber', 5, '30 s', 30]], 'high'),
      f('WOD con manubri', 'Un paio di manubri e una sedia per lo step-up.', [['stacco-manubri', 4, '10', 45], ['step-up', 4, '10', 45], ['shoulder-press-manubri', 4, '10', 45], ['burpee', 4, '8', 45], ['farmer-walk', 3, '40 s', 45]], 'high'),
      f('WOD corda e corpo libero', 'Corda per saltare e tanto ritmo.', [['salto-corda', 5, '60 s', 30], ['affondi', 4, '12', 30], ['push-up', 4, '10', 30], ['sit-up', 4, '15', 30]], 'high'),
    ],
  },
  hiit: {
    gym: [
      f('HIIT 40/20', '40 secondi di lavoro, 20 di recupero.', [['burpee', 4, '40 s', 20], ['kb-swing', 4, '40 s', 20], ['battle-rope', 4, '40 s', 20], ['mountain-climber', 4, '40 s', 20]], 'high'),
      f('Tabata', '20 secondi a tutta, 10 di recupero, otto volte.', [['jumping-jack', 8, '20 s', 10], ['squat-corpo-libero', 8, '20 s', 10], ['mountain-climber', 8, '20 s', 10]], 'high'),
      f('HIIT con corda', 'Corda, burpee e kettlebell a intervalli.', [['salto-corda', 5, '45 s', 15], ['burpee', 5, '30 s', 30], ['kb-swing', 4, '40 s', 20], ['plank', 3, '30 s', 20]], 'high'),
    ],
    home: [
      f('HIIT 40/20 a casa', '40 secondi di lavoro, 20 di recupero.', [['burpee', 4, '40 s', 20], ['squat-corpo-libero', 4, '40 s', 20], ['mountain-climber', 4, '40 s', 20], ['jumping-jack', 4, '40 s', 20]], 'high'),
      f('Tabata a corpo libero', '20 secondi a tutta, 10 di recupero, otto volte.', [['jumping-jack', 8, '20 s', 10], ['push-up', 8, '20 s', 10], ['squat-corpo-libero', 8, '20 s', 10]], 'high'),
      f('HIIT piramide', 'Intensità che sale, recuperi brevi.', [['burpee', 3, '10', 30], ['affondi', 3, '40 s', 20], ['mountain-climber', 3, '40 s', 20], ['plank', 3, '30 s', 20], ['jumping-jack', 3, '60 s', 20]], 'high'),
    ],
  },
};

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Bilanciere',
  rack: 'Rack',
  bench: 'Panca',
  dumbbells: 'Manubri',
  machines: 'Macchine',
  cables: 'Cavi',
  kettlebell: 'Kettlebell',
  bands: 'Elastici',
  pullupBar: 'Sbarra',
  dipBars: 'Parallele',
};

const TEMPO: Record<CatalogExercise['tempo'], string> = {
  heavyCompound: '2-0-1-0',
  compound: '2-0-1-0',
  stretch: '3-1-1-0',
  squeeze: '2-0-1-1',
  machine: '2-0-1-0',
  bodyweight: '3-0-1-0',
  isometric: 'isometria',
};

export type SpotWorkout = {
  /** Stable: focus, place, proposal. */
  id: string;
  focus: SpotFocus;
  place: SpotPlace;
  focusLabel: string;
  title: string;
  note: string;
  exercises: TrainingExerciseEntry[];
  minutes: number;
  kcal: number;
  activity: ActivityType;
  intensity: ActivityIntensity;
  muscles: string[];
  equipment: string[];
  totalSets: number;
};

export type SpotProfile = { weightKg: number; sex: string; age: number; level: Level };

const isTimed = (reps: string) => /\bs\b/.test(reps);
const topReps = (reps: string) => {
  const m = reps.match(/(\d+)(?:\s*-\s*(\d+))?/);
  return m ? Number(m[2] ?? m[1]) : 10;
};

/** Days since the epoch of an ISO date: the rotation key, so the first proposal changes every day. */
function dayNumber(dateISO: string): number {
  return Math.floor(Date.parse(`${dateISO.slice(0, 10)}T12:00:00Z`) / 86400000);
}

/** Minutes of a session: 5 min warm-up, each set's work (≈3.5 s per rep, or the timed set), the rests between sets, a minute to set up each exercise. */
function minutesOf(items: { sets: number; reps: string; restSec: number }[]): number {
  let sec = 5 * 60;
  for (const it of items) {
    const work = isTimed(it.reps) ? topReps(it.reps) : topReps(it.reps) * 3.5;
    sec += it.sets * work + Math.max(it.sets - 1, 0) * it.restSec + 60;
  }
  return Math.max(10, Math.round(sec / 60 / 5) * 5);
}

function build(focus: SpotFocus, place: SpotPlace, variant: number, t: Template, profile: SpotProfile): SpotWorkout {
  const muscles = new Set<string>();
  const equipment = new Set<string>();

  const exercises: TrainingExerciseEntry[] = t.items.flatMap(([id, sets0, reps, restSec], i): TrainingExerciseEntry[] => {
    const sets = profile.level === 'beginner' ? Math.max(2, sets0 - (sets0 >= 8 ? 2 : 1)) : sets0;
    const timed = isTimed(reps);
    const range = reps.match(/(\d+)\s*-\s*(\d+)/);
    // the same exercise twice in a session (a finisher set) needs its own id
    const entryId = t.items.findIndex(([x]) => x === id) === i ? id : `${id}-${i + 1}`;
    const e = CATALOG_BY_ID.get(id);
    if (e) {
      const rir = e.kind === 'isolation' || e.kind === 'core' ? 1 : 2;
      const load = timed ? { kg: null } : initialLoad({ e, profile: { bodyweightKg: profile.weightKg, sex: profile.sex, level: profile.level, age: profile.age }, repsMax: topReps(reps), rir, monthsIn: 0, calibrating: true });
      muscles.add(MUSCLE_SHORT[e.primary]);
      for (const q of e.equipment) equipment.add(EQUIPMENT_LABEL[q]);
      return [
        {
          id: entryId,
          name: e.name,
          sets,
          reps,
          restSec,
          suggestedKg: load.kg,
          tempo: timed ? 'continuo' : TEMPO[e.tempo],
          repsMin: range ? Number(range[1]) : undefined,
          repsMax: range ? Number(range[2]) : undefined,
          rir,
          rpe: 10 - rir,
          loadStatus: load.kg == null ? 'bodyweight' : 'calibrate',
          primaryMuscle: MUSCLE_SHORT[e.primary],
          cues: e.cues,
        },
      ];
    }
    const x = EXTRA[id];
    if (!x) return [];
    muscles.add(x.muscle);
    for (const q of x.equipment) equipment.add(q);
    return [
      {
        id: entryId,
        name: x.name,
        sets,
        reps,
        restSec,
        suggestedKg: null,
        tempo: timed ? 'continuo' : x.tempo,
        repsMin: range ? Number(range[1]) : undefined,
        repsMax: range ? Number(range[2]) : undefined,
        loadStatus: 'bodyweight',
        primaryMuscle: x.muscle,
      },
    ];
  });

  const minutes = minutesOf(exercises);
  return {
    id: `${focus}-${place}-${variant}`,
    focus,
    place,
    focusLabel: SPOT_FOCUS.find((s) => s.value === focus)!.label,
    title: t.title,
    note: t.note,
    exercises,
    minutes,
    kcal: estimateActivityKcal(t.activity, t.intensity, minutes, profile.weightKg),
    activity: t.activity,
    intensity: t.intensity,
    muscles: [...muscles],
    equipment: equipment.size > 0 ? [...equipment] : ['Corpo libero'],
    totalSets: exercises.reduce((s, ex) => s + ex.sets, 0),
  };
}

/** Every proposal for a goal and a place, sized on the person; the list starts from a different one each day. */
export function spotProposals(focus: SpotFocus, place: SpotPlace, dateISO: string, profile: SpotProfile): SpotWorkout[] {
  const templates = LIBRARY[focus][place];
  const n = templates.length;
  const start = ((dayNumber(dateISO) % n) + n) % n;
  return templates.map((_, k) => {
    const variant = (start + k) % n;
    return build(focus, place, variant, templates[variant], profile);
  });
}
