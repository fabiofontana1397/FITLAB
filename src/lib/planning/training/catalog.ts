/**
 * Exercise catalog of the training engine (v3).
 *
 * Every entry says WHAT it trains (primary muscle group, secondary groups that
 * count as half a set — the "fractional" set count of Pelland et al. 2024), HOW
 * (movement pattern, kind, stability, which part of the range it loads most),
 * WITH WHAT (equipment, all required) and how it can PROGRESS (load type and
 * smallest realistic increment). Nothing here is invented biomechanics: the
 * fields only record well-documented, uncontroversial facts (a curl is an elbow
 * flexion for the biceps; a Romanian deadlift loads the hamstrings at long
 * muscle lengths; a machine is more stable than a barbell).
 *
 * Ids of exercises that existed before (back-squat, panca-piana, …) are kept, so
 * logged sets, media and progress keep working.
 */
import type { BodyArea } from '../exercise-library';

export type MuscleGroup =
  | 'chest'
  | 'lats'
  | 'upperBack'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs';

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Petto',
  lats: 'Gran dorsale',
  upperBack: 'Parte alta della schiena (trapezio, romboidi)',
  frontDelts: 'Deltoide anteriore',
  sideDelts: 'Deltoide laterale',
  rearDelts: 'Deltoide posteriore',
  quads: 'Quadricipiti',
  hamstrings: 'Femorali',
  glutes: 'Glutei',
  adductors: 'Adduttori',
  calves: 'Polpacci',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Brachiale e avambracci',
  abs: 'Addome e core',
};

/** Short label for chips and block titles. */
export const MUSCLE_SHORT: Record<MuscleGroup, string> = {
  chest: 'Petto',
  lats: 'Dorsali',
  upperBack: 'Alta schiena',
  frontDelts: 'Spalle anteriori',
  sideDelts: 'Spalle laterali',
  rearDelts: 'Spalle posteriori',
  quads: 'Quadricipiti',
  hamstrings: 'Femorali',
  glutes: 'Glutei',
  adductors: 'Adduttori',
  calves: 'Polpacci',
  biceps: 'Bicipiti',
  triceps: 'Tricipiti',
  forearms: 'Avambracci',
  abs: 'Core',
};

export type Equipment = 'barbell' | 'rack' | 'bench' | 'dumbbells' | 'machines' | 'cables' | 'kettlebell' | 'bands' | 'pullupBar' | 'dipBars';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'horizontalPush'
  | 'inclinePush'
  | 'verticalPush'
  | 'horizontalPull'
  | 'verticalPull'
  | 'chestFly'
  | 'lateralRaise'
  | 'rearDeltFly'
  | 'elbowFlexion'
  | 'elbowExtension'
  | 'kneeExtension'
  | 'kneeFlexion'
  | 'hipExtension'
  | 'hipAbduction'
  | 'hipAdduction'
  | 'calfRaise'
  | 'trunkFlexion'
  | 'antiRotation'
  | 'antiExtension';

export type LoadType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'kettlebell' | 'bodyweight' | 'band';

/** Where the target muscle is most loaded: drives tempo (pause in the stretch) and, for hypertrophy, selection preference. */
export type LengthBias = 'lengthened' | 'mid' | 'shortened';

/** How execution should be cued and timed (see prescription.ts → tempoFor). */
export type TempoProfile = 'heavyCompound' | 'compound' | 'stretch' | 'squeeze' | 'machine' | 'bodyweight' | 'isometric';

export type CatalogExercise = {
  id: string;
  name: string;
  primary: MuscleGroup;
  /** Anatomical detail shown to the person (e.g. "porzione clavicolare"). */
  region?: string;
  /** Groups that work as synergists: indirect sets, counted as `indirectShare` of a set each (default 0.5). */
  secondary: MuscleGroup[];
  /** Groups that only stabilise (isometric support, grip): listed for information, never counted as volume. */
  stabilizers?: MuscleGroup[];
  /** Per-group override of the indirect share when a synergist works clearly more or less than half a set. */
  indirectShare?: Partial<Record<MuscleGroup, number>>;
  pattern: MovementPattern;
  kind: 'compound' | 'isolation' | 'core';
  /** 1 = easy to learn (machines), 2 = moderate, 3 = demanding free-weight technique. */
  technique: 1 | 2 | 3;
  stability: 'high' | 'medium' | 'low';
  lengthBias: LengthBias;
  tempo: TempoProfile;
  /** ALL of these are needed. Empty = bodyweight only. */
  equipment: Equipment[];
  loadType: LoadType;
  /** Smallest realistic load jump (kg, total for barbells, per hand for dumbbells). */
  increment: number;
  /** Estimated 1RM as a share of bodyweight for an intermediate man (per hand for dumbbells); null = no external load. */
  e1rmRatio: number | null;
  /** Joints/areas the exercise loads heavily: excluded when the person reports pain there. */
  areas: BodyArea[];
  /** Words (Italian) that identify it in free text ("non riesco a fare lo squat"). */
  keywords: string[];
  /** One or two execution cues. */
  cues: string[];
  /** Bodyweight exercises that progress by reps first. */
  repsBased?: boolean;
  /** Held for time, not reps. */
  timed?: boolean;
};

type Def = Omit<CatalogExercise, 'secondary' | 'areas' | 'keywords' | 'cues'> & Partial<Pick<CatalogExercise, 'secondary' | 'areas' | 'keywords' | 'cues'>>;
const ex = (d: Def): CatalogExercise => ({ secondary: [], areas: [], keywords: [], cues: [], ...d });

export const CATALOG: CatalogExercise[] = [
  // ------------------------------------------------------------------ chest
  ex({ id: 'panca-piana', name: 'Panca piana con bilanciere', primary: 'chest', region: 'porzione sternocostale', secondary: ['triceps', 'frontDelts'], pattern: 'horizontalPush', kind: 'compound', technique: 3, stability: 'medium', lengthBias: 'mid', tempo: 'heavyCompound', equipment: ['barbell', 'bench', 'rack'], loadType: 'barbell', increment: 2.5, e1rmRatio: 1.0, areas: ['shoulder', 'wrist'], keywords: ['panca piana', 'panca', 'bench press', 'distensioni su panca'], cues: ['Scapole addotte e depresse, piedi stabili a terra.', 'Il bilanciere tocca il petto sotto i capezzoli, gomiti a circa 45°.'] }),
  ex({ id: 'panca-manubri', name: 'Panca piana con manubri', primary: 'chest', region: 'porzione sternocostale', secondary: ['triceps', 'frontDelts'], pattern: 'horizontalPush', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'lengthened', tempo: 'compound', equipment: ['dumbbells', 'bench'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.38, areas: ['shoulder', 'wrist'], keywords: ['panca con manubri', 'distensioni con manubri'], cues: ['Scendi finché senti l’allungamento del petto, senza perdere la posizione delle spalle.'] }),
  ex({ id: 'panca-inclinata-manubri', name: 'Panca inclinata con manubri', primary: 'chest', region: 'porzione clavicolare', secondary: ['frontDelts', 'triceps'], pattern: 'inclinePush', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'lengthened', tempo: 'compound', equipment: ['dumbbells', 'bench'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.32, areas: ['shoulder', 'wrist'], keywords: ['panca inclinata', 'inclinata'], cues: ['Panca a 30°: più alta sposta il lavoro sulle spalle.', 'Gomiti sotto i polsi, controlla la discesa.'] }),
  ex({ id: 'panca-inclinata-bilanciere', name: 'Panca inclinata con bilanciere', primary: 'chest', region: 'porzione clavicolare', secondary: ['frontDelts', 'triceps'], pattern: 'inclinePush', kind: 'compound', technique: 3, stability: 'medium', lengthBias: 'mid', tempo: 'heavyCompound', equipment: ['barbell', 'bench', 'rack'], loadType: 'barbell', increment: 2.5, e1rmRatio: 0.85, areas: ['shoulder', 'wrist'], keywords: ['panca inclinata'], cues: ['Panca a 30°, il bilanciere tocca la parte alta del petto.'] }),
  ex({ id: 'chest-press-machine', name: 'Chest press alla macchina', primary: 'chest', secondary: ['triceps', 'frontDelts'], pattern: 'horizontalPush', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'machine', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.8, areas: ['shoulder'], keywords: ['chest press'], cues: ['Regola il sedile: le maniglie all’altezza del centro del petto.'] }),
  ex({ id: 'croci-cavi', name: 'Croci ai cavi', primary: 'chest', secondary: ['frontDelts'], pattern: 'chestFly', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.14, areas: ['shoulder'], keywords: ['croci', 'croci ai cavi', 'cable fly'], cues: ['Gomiti leggermente flessi e fissi: il movimento avviene alla spalla.', 'Pausa breve nel punto di massimo allungamento.'] }),
  ex({ id: 'pec-deck', name: 'Pectoral machine', primary: 'chest', secondary: ['frontDelts'], pattern: 'chestFly', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'machine', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.5, areas: ['shoulder'], keywords: ['pec deck', 'pectoral machine', 'butterfly'], cues: ['Schiena aderente allo schienale, porta le braccia avanti senza spingere con le spalle.'] }),
  ex({ id: 'croci-manubri', name: 'Croci con manubri', primary: 'chest', secondary: ['frontDelts'], pattern: 'chestFly', kind: 'isolation', technique: 2, stability: 'medium', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['dumbbells', 'bench'], loadType: 'dumbbell', increment: 1, e1rmRatio: 0.15, areas: ['shoulder'], keywords: ['croci con manubri', 'croci'], cues: ['Scendi solo fin dove le spalle restano comode.'] }),
  ex({ id: 'push-up', name: 'Push-up', primary: 'chest', secondary: ['triceps', 'frontDelts'], pattern: 'horizontalPush', kind: 'compound', technique: 1, stability: 'medium', lengthBias: 'mid', tempo: 'bodyweight', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'], cues: ['Corpo rigido dalla testa ai talloni, petto vicino a terra.', 'Se è troppo difficile, appoggia le mani su un rialzo.'], repsBased: true }),
  ex({ id: 'dip-parallele', name: 'Dip alle parallele', primary: 'chest', secondary: ['triceps', 'frontDelts'], pattern: 'horizontalPush', kind: 'compound', technique: 2, stability: 'low', lengthBias: 'lengthened', tempo: 'bodyweight', equipment: ['dipBars'], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['shoulder', 'wrist'], keywords: ['dip', 'parallele'], cues: ['Busto leggermente inclinato in avanti, scendi fino a sentire l’allungamento senza dolore alle spalle.'], repsBased: true }),

  // ------------------------------------------------------------------- back
  ex({ id: 'trazioni-sbarra', name: 'Trazioni alla sbarra', primary: 'lats', secondary: ['biceps', 'upperBack'], stabilizers: ['forearms'], pattern: 'verticalPull', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'lengthened', tempo: 'bodyweight', equipment: ['pullupBar'], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['shoulder'], keywords: ['trazioni', 'pull-up', 'pullup'], cues: ['Parti da braccia distese, porta il petto verso la sbarra.'], repsBased: true }),
  ex({ id: 'lat-machine', name: 'Lat machine', primary: 'lats', secondary: ['biceps', 'upperBack'], pattern: 'verticalPull', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'compound', equipment: ['cables'], loadType: 'cable', increment: 5, e1rmRatio: 0.85, areas: [], keywords: ['lat machine', 'lat pulldown'], cues: ['Tira la barra verso lo sterno guidando con i gomiti, senza dondolare.', 'In alto lascia salire le scapole per allungare il dorsale.'] }),
  ex({ id: 'lat-machine-neutra', name: 'Lat machine presa neutra', primary: 'lats', secondary: ['biceps', 'upperBack'], stabilizers: ['forearms'], pattern: 'verticalPull', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'compound', equipment: ['cables'], loadType: 'cable', increment: 5, e1rmRatio: 0.85, areas: [], keywords: ['presa neutra', 'presa stretta'], cues: ['Gomiti vicini al corpo, tira verso la parte alta dell’addome.'] }),
  ex({ id: 'rematore-bilanciere', name: 'Rematore con bilanciere', primary: 'upperBack', secondary: ['lats', 'rearDelts', 'biceps'], pattern: 'horizontalPull', kind: 'compound', technique: 3, stability: 'low', lengthBias: 'mid', tempo: 'compound', equipment: ['barbell'], loadType: 'barbell', increment: 2.5, e1rmRatio: 0.8, areas: ['lowerBack'], keywords: ['rematore'], cues: ['Busto a circa 45°, schiena neutra, tira il bilanciere verso l’ombelico.'] }),
  ex({ id: 'pulley', name: 'Pulley basso', primary: 'upperBack', secondary: ['lats', 'rearDelts', 'biceps'], pattern: 'horizontalPull', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'squeeze', equipment: ['cables'], loadType: 'cable', increment: 5, e1rmRatio: 0.75, areas: [], keywords: ['pulley', 'rematore ai cavi', 'seated row'], cues: ['Busto fermo, porta i gomiti indietro e stringi le scapole un istante.'] }),
  ex({ id: 'rematore-manubrio', name: 'Rematore con manubrio', primary: 'upperBack', secondary: ['lats', 'rearDelts', 'biceps'], pattern: 'horizontalPull', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'lengthened', tempo: 'compound', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.4, areas: ['lowerBack'], keywords: ['rematore con manubrio'], cues: ['Appoggia mano e ginocchio, tira il manubrio verso l’anca.'] }),
  ex({ id: 'chest-supported-row', name: 'Rematore con petto appoggiato', primary: 'upperBack', secondary: ['lats', 'rearDelts', 'biceps'], pattern: 'horizontalPull', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'squeeze', equipment: ['dumbbells', 'bench'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.32, areas: [], keywords: ['rematore su panca', 'petto appoggiato'], cues: ['Petto sulla panca inclinata: niente slancio, la schiena bassa resta scarica.'] }),
  ex({ id: 'rematore-elastico', name: 'Rematore con elastico', primary: 'upperBack', secondary: ['lats', 'rearDelts', 'biceps'], pattern: 'horizontalPull', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['bands'], loadType: 'band', increment: 0, e1rmRatio: null, areas: [], keywords: ['rematore con elastico'], cues: ['Allontanati dall’ancoraggio quanto basta per sentire tensione già all’inizio.'], repsBased: true }),
  ex({ id: 'trazioni-lat-elastico', name: 'Lat pulldown con elastico', primary: 'lats', secondary: ['biceps', 'upperBack'], pattern: 'verticalPull', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'squeeze', equipment: ['bands'], loadType: 'band', increment: 0, e1rmRatio: null, areas: ['shoulder'], keywords: ['trazioni con elastico', 'lat pulldown'], cues: ['Elastico fissato in alto, tira portando i gomiti verso i fianchi.'], repsBased: true }),
  ex({ id: 'rematore-inverso', name: 'Rematore inverso a corpo libero', primary: 'upperBack', secondary: ['lats', 'biceps', 'rearDelts'], pattern: 'horizontalPull', kind: 'compound', technique: 1, stability: 'medium', lengthBias: 'mid', tempo: 'bodyweight', equipment: ['pullupBar'], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: [], keywords: ['rematore inverso', 'australian pull-up'], cues: ['Sotto una sbarra bassa, corpo rigido, porta il petto alla sbarra.', 'Più i piedi sono avanti, più è difficile.'], repsBased: true }),

  ex({ id: 'ytw-prono', name: 'Y-T-W a terra', primary: 'upperBack', region: 'trapezio medio e inferiore, romboidi', secondary: ['rearDelts'], pattern: 'horizontalPull', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: [], keywords: ['ytw', 'y-t-w'], cues: ['A pancia in giù, solleva le braccia formando Y, T e W tenendo le scapole strette per 2 secondi.'], repsBased: true }),

  // -------------------------------------------------------------- shoulders
  ex({ id: 'military-press', name: 'Military press', primary: 'frontDelts', secondary: ['sideDelts', 'triceps'], pattern: 'verticalPush', kind: 'compound', technique: 3, stability: 'low', lengthBias: 'mid', tempo: 'heavyCompound', equipment: ['barbell', 'rack'], loadType: 'barbell', increment: 2.5, e1rmRatio: 0.62, areas: ['shoulder', 'lowerBack'], keywords: ['military press', 'lento avanti', 'shoulder press'], cues: ['Glutei e addome contratti, il bilanciere sale in linea con la testa.'] }),
  ex({ id: 'shoulder-press-manubri', name: 'Shoulder press con manubri', primary: 'frontDelts', secondary: ['sideDelts', 'triceps'], pattern: 'verticalPush', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'mid', tempo: 'compound', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.24, areas: ['shoulder'], keywords: ['shoulder press', 'distensioni manubri'], cues: ['Da seduto con schienale: polsi sopra i gomiti, non battere i manubri in alto.'] }),
  ex({ id: 'shoulder-press-machine', name: 'Shoulder press alla macchina', primary: 'frontDelts', secondary: ['sideDelts', 'triceps'], pattern: 'verticalPush', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'machine', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.55, areas: ['shoulder'], keywords: ['shoulder press macchina'], cues: ['Maniglie all’altezza delle spalle in partenza.'] }),
  ex({ id: 'pike-push-up', name: 'Pike push-up', primary: 'frontDelts', secondary: ['triceps', 'sideDelts'], pattern: 'verticalPush', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'mid', tempo: 'bodyweight', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['shoulder', 'wrist'], keywords: ['pike push-up'], cues: ['Bacino in alto a V rovesciata, porta la testa verso il pavimento tra le mani.'], repsBased: true }),
  ex({ id: 'alzate-laterali', name: 'Alzate laterali con manubri', primary: 'sideDelts', secondary: [], pattern: 'lateralRaise', kind: 'isolation', technique: 1, stability: 'medium', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 1, e1rmRatio: 0.09, areas: ['shoulder'], keywords: ['alzate laterali', 'lateral raise'], cues: ['Gomiti leggermente flessi, sali fino all’altezza delle spalle senza slancio.'] }),
  ex({ id: 'alzate-laterali-cavo', name: 'Alzate laterali al cavo', primary: 'sideDelts', secondary: [], pattern: 'lateralRaise', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.07, areas: ['shoulder'], keywords: ['alzate al cavo'], cues: ['Cavo che passa dietro il corpo: la tensione resta anche in basso.'] }),
  ex({ id: 'alzate-laterali-elastico', name: 'Alzate laterali con elastico', primary: 'sideDelts', secondary: [], pattern: 'lateralRaise', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['bands'], loadType: 'band', increment: 0, e1rmRatio: null, areas: ['shoulder'], keywords: ['alzate laterali con elastico'], cues: ['Piede sull’elastico, sali lento e fermati all’altezza delle spalle.'], repsBased: true }),
  ex({ id: 'face-pull', name: 'Face pull al cavo', primary: 'rearDelts', secondary: ['upperBack'], pattern: 'rearDeltFly', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.3, areas: [], keywords: ['face pull'], cues: ['Corda all’altezza del viso, gomiti alti, ruota le mani all’indietro a fine movimento.'] }),
  ex({ id: 'reverse-fly-machine', name: 'Croci inverse alla macchina', primary: 'rearDelts', secondary: ['upperBack'], pattern: 'rearDeltFly', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'squeeze', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.3, areas: [], keywords: ['croci inverse', 'reverse fly', 'pec deck inverso'], cues: ['Braccia quasi tese, apri senza contrarre il trapezio alto.'] }),
  ex({ id: 'alzate-posteriori-manubri', name: 'Alzate posteriori con manubri', primary: 'rearDelts', secondary: ['upperBack'], pattern: 'rearDeltFly', kind: 'isolation', technique: 1, stability: 'medium', lengthBias: 'mid', tempo: 'squeeze', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 1, e1rmRatio: 0.07, areas: [], keywords: ['alzate posteriori', 'croci inverse con manubri'], cues: ['Busto inclinato in avanti, apri le braccia guidando con i gomiti.'] }),
  ex({ id: 'face-pull-elastico', name: 'Face pull con elastico', primary: 'rearDelts', secondary: ['upperBack'], pattern: 'rearDeltFly', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['bands'], loadType: 'band', increment: 0, e1rmRatio: null, areas: [], keywords: ['face pull'], cues: ['Elastico all’altezza del viso, apri i gomiti verso l’esterno.'], repsBased: true }),

  // ------------------------------------------------------------------- legs
  ex({ id: 'back-squat', name: 'Back squat', primary: 'quads', secondary: ['glutes', 'adductors'], pattern: 'squat', kind: 'compound', technique: 3, stability: 'low', lengthBias: 'lengthened', tempo: 'heavyCompound', equipment: ['barbell', 'rack'], loadType: 'barbell', increment: 2.5, e1rmRatio: 1.25, areas: ['knee', 'hip', 'lowerBack'], keywords: ['squat'], cues: ['Petto alto, ginocchia nella direzione delle punte, scendi almeno al parallelo se la mobilità lo consente.'] }),
  ex({ id: 'hack-squat', name: 'Hack squat', primary: 'quads', secondary: ['glutes'], pattern: 'squat', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'machine', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 1.4, areas: ['knee'], keywords: ['hack squat'], cues: ['Piedi a metà pedana, scendi in profondità mantenendo la schiena appoggiata.'] }),
  ex({ id: 'leg-press', name: 'Leg press', primary: 'quads', secondary: ['glutes', 'adductors'], pattern: 'squat', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'machine', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 2.2, areas: ['knee'], keywords: ['leg press', 'pressa'], cues: ['Il bacino non si stacca dallo schienale in fondo al movimento.'] }),
  ex({ id: 'goblet-squat', name: 'Goblet squat', primary: 'quads', secondary: ['glutes', 'adductors'], pattern: 'squat', kind: 'compound', technique: 1, stability: 'medium', lengthBias: 'lengthened', tempo: 'compound', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.5, areas: ['knee', 'hip'], keywords: ['goblet squat', 'squat con manubrio'], cues: ['Manubrio al petto, gomiti tra le ginocchia in fondo al movimento.'] }),
  ex({ id: 'squat-manubri', name: 'Squat con manubri', primary: 'quads', secondary: ['glutes', 'adductors'], pattern: 'squat', kind: 'compound', technique: 1, stability: 'medium', lengthBias: 'lengthened', tempo: 'compound', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.3, areas: ['knee', 'hip'], keywords: ['squat con manubri'], cues: ['Manubri lungo i fianchi, busto eretto.'] }),
  ex({ id: 'squat-corpo-libero', name: 'Squat a corpo libero', primary: 'quads', secondary: ['glutes'], pattern: 'squat', kind: 'compound', technique: 1, stability: 'medium', lengthBias: 'lengthened', tempo: 'bodyweight', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['knee', 'hip'], keywords: ['squat a corpo libero', 'air squat'], cues: ['Scendi lento in 3 secondi, risali deciso.'], repsBased: true }),
  ex({ id: 'bulgarian-split-squat', name: 'Affondo bulgaro', primary: 'quads', secondary: ['glutes', 'adductors'], pattern: 'lunge', kind: 'compound', technique: 2, stability: 'low', lengthBias: 'lengthened', tempo: 'compound', equipment: ['dumbbells', 'bench'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.28, areas: ['knee', 'hip'], keywords: ['bulgaro', 'split squat'], cues: ['Piede posteriore sulla panca, scendi in verticale finché il ginocchio dietro sfiora terra.'] }),
  ex({ id: 'affondi-manubri', name: 'Affondi con manubri', primary: 'quads', secondary: ['glutes', 'adductors'], pattern: 'lunge', kind: 'compound', technique: 2, stability: 'low', lengthBias: 'lengthened', tempo: 'compound', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.22, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'], cues: ['Passo lungo abbastanza da tenere il ginocchio anteriore sopra il piede.'] }),
  ex({ id: 'affondi', name: 'Affondi a corpo libero', primary: 'quads', secondary: ['glutes', 'adductors'], pattern: 'lunge', kind: 'compound', technique: 1, stability: 'low', lengthBias: 'lengthened', tempo: 'bodyweight', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'], cues: ['Alterna le gambe, busto eretto, scendi controllato.'], repsBased: true }),
  ex({ id: 'leg-extension', name: 'Leg extension', primary: 'quads', region: 'retto femorale', secondary: [], pattern: 'kneeExtension', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.7, areas: ['knee'], keywords: ['leg extension'], cues: ['Schienale un po’ reclinato per allungare il retto femorale, pausa breve in alto.'] }),
  ex({ id: 'romanian-deadlift', name: 'Stacco rumeno con bilanciere', primary: 'hamstrings', secondary: ['glutes'], stabilizers: ['upperBack'], pattern: 'hinge', kind: 'compound', technique: 3, stability: 'medium', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['barbell'], loadType: 'barbell', increment: 2.5, e1rmRatio: 1.1, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno', 'romanian deadlift', 'rdl'], cues: ['Spingi l’anca indietro con ginocchia morbide, scendi finché senti tirare i femorali con la schiena neutra.'] }),
  ex({ id: 'stacco-rumeno-manubri', name: 'Stacco rumeno con manubri', primary: 'hamstrings', secondary: ['glutes'], pattern: 'hinge', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.45, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno'], cues: ['Manubri vicini alle gambe, schiena neutra, risali spingendo l’anca avanti.'] }),
  ex({ id: 'stacco-una-gamba', name: 'Stacco rumeno su una gamba', primary: 'hamstrings', secondary: ['glutes'], pattern: 'hinge', kind: 'compound', technique: 2, stability: 'low', lengthBias: 'lengthened', tempo: 'stretch', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['hip'], keywords: ['stacco su una gamba', 'single leg'], cues: ['Anca indietro mentre la gamba libera sale dietro; appoggiati a un muro se perdi l’equilibrio.'], repsBased: true }),
  ex({ id: 'stacco-da-terra', name: 'Stacco da terra', primary: 'glutes', secondary: ['hamstrings', 'quads'], stabilizers: ['upperBack', 'forearms'], pattern: 'hinge', kind: 'compound', technique: 3, stability: 'medium', lengthBias: 'mid', tempo: 'heavyCompound', equipment: ['barbell'], loadType: 'barbell', increment: 2.5, e1rmRatio: 1.5, areas: ['lowerBack', 'hip', 'knee'], keywords: ['stacco da terra', 'deadlift'], cues: ['Bilanciere sopra metà piede, schiena neutra, spingi il pavimento con le gambe.'] }),
  ex({ id: 'leg-curl-machine', name: 'Leg curl', primary: 'hamstrings', secondary: [], pattern: 'kneeFlexion', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.55, areas: ['knee'], keywords: ['leg curl'], cues: ['Meglio da seduto: anca flessa, femorali in allungamento.', 'Scendi controllato fino all’estensione completa.'] }),
  ex({ id: 'hip-thrust', name: 'Hip thrust', primary: 'glutes', secondary: ['hamstrings'], pattern: 'hipExtension', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['barbell', 'bench'], loadType: 'barbell', increment: 2.5, e1rmRatio: 1.4, areas: ['hip'], keywords: ['hip thrust'], cues: ['Mento verso il petto, spingi con i talloni e fermati un istante in alto con i glutei contratti.'] }),
  ex({ id: 'hip-thrust-corpo-libero', name: 'Ponte glutei', primary: 'glutes', secondary: ['hamstrings'], pattern: 'hipExtension', kind: 'compound', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['hip'], keywords: ['ponte glutei', 'glute bridge', 'hip thrust'], cues: ['Fermati 2 secondi in alto; per renderlo più difficile fallo su una gamba.'], repsBased: true }),
  ex({ id: 'kb-swing', name: 'Kettlebell swing', primary: 'glutes', secondary: ['hamstrings'], stabilizers: ['upperBack'], pattern: 'hinge', kind: 'compound', technique: 2, stability: 'medium', lengthBias: 'mid', tempo: 'compound', equipment: ['kettlebell'], loadType: 'kettlebell', increment: 4, e1rmRatio: 0.3, areas: ['lowerBack', 'hip'], keywords: ['swing', 'kettlebell'], cues: ['Il movimento parte dall’anca, non dalle braccia.'] }),
  ex({ id: 'adductor-machine', name: 'Adductor machine', primary: 'adductors', secondary: [], pattern: 'hipAdduction', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.8, areas: ['hip'], keywords: ['adductor', 'adduttori'], cues: ['Apri fin dove senti l’allungamento, chiudi controllato.'] }),
  ex({ id: 'abductor-machine', name: 'Abductor machine', primary: 'glutes', region: 'gluteo medio', secondary: [], pattern: 'hipAbduction', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 0.8, areas: ['hip'], keywords: ['abductor', 'abduttori'], cues: ['Busto leggermente in avanti per coinvolgere di più il gluteo.'] }),
  ex({ id: 'clamshell-elastico', name: 'Abduzione anca con elastico', primary: 'glutes', region: 'gluteo medio', secondary: [], pattern: 'hipAbduction', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['bands'], loadType: 'band', increment: 0, e1rmRatio: null, areas: ['hip'], keywords: ['clamshell', 'abduzione anca'], cues: ['Elastico sopra le ginocchia, apri lentamente senza ruotare il bacino.'], repsBased: true }),
  ex({ id: 'polpacci-macchina', name: 'Calf raise alla macchina', primary: 'calves', secondary: [], pattern: 'calfRaise', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['machines'], loadType: 'machine', increment: 5, e1rmRatio: 1.0, areas: [], keywords: ['polpacci', 'calf'], cues: ['Pausa di 1-2 secondi in basso, con il tallone sotto la pedana.'] }),
  ex({ id: 'polpacci-piedi', name: 'Calf raise in piedi', primary: 'calves', secondary: [], pattern: 'calfRaise', kind: 'isolation', technique: 1, stability: 'medium', lengthBias: 'lengthened', tempo: 'stretch', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: [], keywords: ['polpacci'], cues: ['Sul bordo di un gradino, scendi con il tallone e fermati in allungamento.', 'Quando diventa facile fallo su una gamba.'], repsBased: true }),

  // ------------------------------------------------------------------- arms
  ex({ id: 'curl-bicipiti', name: 'Curl con bilanciere', primary: 'biceps', secondary: ['forearms'], pattern: 'elbowFlexion', kind: 'isolation', technique: 1, stability: 'medium', lengthBias: 'mid', tempo: 'compound', equipment: ['barbell'], loadType: 'barbell', increment: 2.5, e1rmRatio: 0.4, areas: ['wrist'], keywords: ['curl bicipiti', 'curl con bilanciere'], cues: ['Gomiti fermi ai fianchi, niente slancio con la schiena.'] }),
  ex({ id: 'curl-manubri', name: 'Curl con manubri', primary: 'biceps', secondary: ['forearms'], pattern: 'elbowFlexion', kind: 'isolation', technique: 1, stability: 'medium', lengthBias: 'mid', tempo: 'compound', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 1, e1rmRatio: 0.17, areas: [], keywords: ['curl', 'curl con manubri'], cues: ['Supina il polso salendo, scendi fino all’estensione completa.'] }),
  ex({ id: 'curl-panca-inclinata', name: 'Curl su panca inclinata', primary: 'biceps', secondary: ['forearms'], pattern: 'elbowFlexion', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['dumbbells', 'bench'], loadType: 'dumbbell', increment: 1, e1rmRatio: 0.13, areas: ['shoulder'], keywords: ['curl inclinato'], cues: ['Braccia dietro il busto: il bicipite lavora in allungamento.'] }),
  ex({ id: 'hammer-curl', name: 'Hammer curl', primary: 'forearms', region: 'brachiale e brachioradiale', secondary: ['biceps'], pattern: 'elbowFlexion', kind: 'isolation', technique: 1, stability: 'medium', lengthBias: 'mid', tempo: 'compound', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 1, e1rmRatio: 0.18, areas: [], keywords: ['hammer curl', 'curl a martello'], cues: ['Presa neutra, gomiti fermi.'] }),
  ex({ id: 'curl-cavo', name: 'Curl al cavo', primary: 'biceps', secondary: ['forearms'], pattern: 'elbowFlexion', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'squeeze', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.35, areas: [], keywords: ['curl al cavo'], cues: ['Tensione costante: non appoggiare il peso in basso.'] }),
  ex({ id: 'curl-elastico', name: 'Curl con elastico', primary: 'biceps', secondary: ['forearms'], pattern: 'elbowFlexion', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['bands'], loadType: 'band', increment: 0, e1rmRatio: null, areas: [], keywords: ['curl con elastico'], cues: ['Piedi sull’elastico, sali fino alla contrazione completa.'], repsBased: true }),
  ex({ id: 'pushdown-cavo', name: 'Push down al cavo', primary: 'triceps', secondary: [], pattern: 'elbowExtension', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.4, areas: ['wrist'], keywords: ['push down', 'pushdown', 'tricipiti al cavo'], cues: ['Gomiti ai fianchi, distendi completamente e controlla la risalita.'] }),
  ex({ id: 'french-press-cavo', name: 'Estensioni sopra la testa al cavo', primary: 'triceps', region: 'capo lungo', secondary: [], pattern: 'elbowExtension', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.32, areas: ['shoulder'], keywords: ['french press', 'estensioni sopra la testa', 'overhead'], cues: ['Braccia sopra la testa: il capo lungo lavora in allungamento.'] }),
  ex({ id: 'french-press-manubrio', name: 'Estensioni sopra la testa con manubrio', primary: 'triceps', region: 'capo lungo', secondary: [], pattern: 'elbowExtension', kind: 'isolation', technique: 1, stability: 'medium', lengthBias: 'lengthened', tempo: 'stretch', equipment: ['dumbbells'], loadType: 'dumbbell', increment: 2, e1rmRatio: 0.25, areas: ['shoulder'], keywords: ['french press', 'estensioni tricipiti'], cues: ['Manubrio con due mani dietro la testa, gomiti puntati in alto.'] }),
  ex({ id: 'dip-sedia', name: 'Dip su sedia', primary: 'triceps', secondary: ['chest', 'frontDelts'], pattern: 'elbowExtension', kind: 'compound', technique: 1, stability: 'medium', lengthBias: 'mid', tempo: 'bodyweight', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['shoulder', 'wrist'], keywords: ['dip'], cues: ['Schiena vicina alla sedia, scendi solo fin dove le spalle restano comode.'], repsBased: true }),
  ex({ id: 'estensioni-elastico', name: 'Estensioni tricipiti con elastico', primary: 'triceps', secondary: [], pattern: 'elbowExtension', kind: 'isolation', technique: 1, stability: 'high', lengthBias: 'shortened', tempo: 'squeeze', equipment: ['bands'], loadType: 'band', increment: 0, e1rmRatio: null, areas: [], keywords: ['estensioni con elastico'], cues: ['Elastico fissato in alto, gomiti fermi.'], repsBased: true }),

  // ------------------------------------------------------------------- core
  ex({ id: 'plank', name: 'Plank', primary: 'abs', region: 'stabilizzazione del tronco', secondary: [], pattern: 'antiExtension', kind: 'core', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'isometric', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: [], keywords: ['plank'], cues: ['Glutei e addome contratti, bacino in linea con il busto.'], timed: true }),
  ex({ id: 'crunch-cavo', name: 'Crunch al cavo', primary: 'abs', region: 'retto addominale', secondary: [], pattern: 'trunkFlexion', kind: 'core', technique: 1, stability: 'high', lengthBias: 'lengthened', tempo: 'squeeze', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.45, areas: [], keywords: ['crunch al cavo'], cues: ['In ginocchio, arrotola il busto verso il bacino: le anche restano ferme.'] }),
  ex({ id: 'pallof-press', name: 'Pallof press', primary: 'abs', region: 'obliqui e anti-rotazione', secondary: [], pattern: 'antiRotation', kind: 'core', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'isometric', equipment: ['cables'], loadType: 'cable', increment: 2.5, e1rmRatio: 0.15, areas: [], keywords: ['pallof'], cues: ['Spingi le mani avanti e resisti alla rotazione per 2 secondi.'] }),
  ex({ id: 'dead-bug', name: 'Dead bug', primary: 'abs', region: 'stabilizzazione del tronco', secondary: [], pattern: 'antiExtension', kind: 'core', technique: 1, stability: 'high', lengthBias: 'mid', tempo: 'bodyweight', equipment: [], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: [], keywords: ['dead bug'], cues: ['Zona lombare a contatto con il pavimento mentre estendi braccio e gamba opposti.'], repsBased: true }),
  ex({ id: 'leg-raise', name: 'Sollevamento gambe alla sbarra', primary: 'abs', region: 'retto addominale', secondary: [], pattern: 'trunkFlexion', kind: 'core', technique: 2, stability: 'low', lengthBias: 'mid', tempo: 'bodyweight', equipment: ['pullupBar'], loadType: 'bodyweight', increment: 0, e1rmRatio: null, areas: ['shoulder'], keywords: ['leg raise', 'sollevamento gambe'], cues: ['Porta il bacino verso il petto, non solo le gambe.'], repsBased: true }),
];

export const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

/** Groups the engine programs explicitly (front delts and adductors get indirect work from presses and squats). */
export const PROGRAMMED_GROUPS: MuscleGroup[] = ['chest', 'lats', 'upperBack', 'sideDelts', 'rearDelts', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'abs'];

/** Share of a set a secondary muscle receives (Pelland et al. 2024: "fractional" counting fits best). */
export const INDIRECT_SHARE = 0.5;

/** Share of a set a synergist gets from one set of the exercise (0.5 unless the exercise says otherwise). */
export function indirectShareOf(e: CatalogExercise, g: MuscleGroup): number {
  return e.indirectShare?.[g] ?? 0.5;
}
