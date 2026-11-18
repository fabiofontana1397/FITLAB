/**
 * Monthly adaptation of the training plan.
 *
 * Reads what really happened in the month — sessions done, how the logged
 * performance moved, logged RIR vs planned, energy, recovery, pain, time and
 * explicit requests — and decides a TrainingCalibration for the next months.
 * Principles (from the brief and from the deloading consensus, Bell et al. 2023):
 *  - change as little as needed and always say why;
 *  - low adherence: understand the cause (time? too hard?) and simplify; never add volume;
 *  - fatigue: first check whether it comes from training (performance down,
 *    soreness) or from elsewhere (sleep, low energy with stable performance);
 *    deload only when performance and recovery both say so;
 *  - improving with good recovery: keep going, add volume only where there is room;
 *  - stable performance: check effort (logged RIR) before changing anything;
 *  - pain: stop loading the area, freeze its progression, suggest a professional;
 *  - a request (days, split, intensity) is applied for real.
 * Load progression itself is NOT a percentage here: it happens set by set
 * with double progression on the person's own logs (loads.ts).
 */
import type { BodyArea } from '../exercise-library';
import type { TrainingCalibration, ExercisePerformance } from './types';

export type TrainingCheckin = {
  adherence?: number;
  energy?: 'veryLow' | 'low' | 'normal' | 'high' | 'veryHigh';
  difficulty?: string[];
  wantsChange?: string[];
  /** Follow-up answers. */
  newDays?: number;
  split?: 'fullBody' | 'upperLower' | 'pushPullLegs';
  painAreas?: BodyArea[];
  notes?: string;
  /** Engine v5: perceived recovery between sessions and sleep quality. */
  recovery?: 'good' | 'ok' | 'poor';
  sleep?: 'good' | 'ok' | 'poor';
};

export type TrainingAdaptation = {
  calibration: TrainingCalibration;
  changes: string[];
  reasons: string[];
  performanceTrend: 'improving' | 'stable' | 'declining' | 'unknown';
};

const NOTE_AREAS: [BodyArea, string[]][] = [
  ['knee', ['ginocchio', 'ginocchia', 'rotula', 'menisco']],
  ['shoulder', ['spalla', 'spalle', 'cuffia']],
  ['lowerBack', ['schiena', 'lombare', 'lombari', 'zona lombare', 'ernia']],
  ['wrist', ['polso', 'polsi']],
  ['hip', ['anca', 'anche', 'inguine']],
];
const PAIN_WORDS = ['male', 'dolore', 'fastidio', 'infortun', 'strappo', 'tendin', 'contrattura', 'distorsione', 'fa male'];

/** Painful areas named in the free-text notes ("da due settimane mi fa male la spalla"). */
export function painAreasFromNotes(notes: string | undefined): BodyArea[] {
  const text = (notes ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!PAIN_WORDS.some((w) => text.includes(w))) return [];
  return NOTE_AREAS.filter(([, words]) => words.some((w) => text.includes(w))).map(([a]) => a);
}

/** Days per week mentioned in the notes ("riesco ad allenarmi solo 2 giorni"). */
export function daysFromNotes(notes: string | undefined): number | null {
  const m = (notes ?? '').toLowerCase().match(/(\d)\s*(?:giorni|volte|sedute)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 6 ? n : null;
}

export function performanceTrend(perf: ExercisePerformance[] | undefined): { trend: TrainingAdaptation['performanceTrend']; avgChange: number; avgRir: number | null } {
  const usable = (perf ?? []).filter((p) => p.sessions >= 2 && p.firstE1rm > 0);
  if (usable.length < 2) return { trend: 'unknown', avgChange: 0, avgRir: null };
  const changes = usable.map((p) => p.lastE1rm / p.firstE1rm - 1);
  const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
  const rirs = usable.map((p) => p.avgRir).filter((r): r is number => r != null);
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  return { trend: avg > 0.02 ? 'improving' : avg < -0.03 ? 'declining' : 'stable', avgChange: avg, avgRir };
}

export function adaptTraining(args: {
  monthIndex: number;
  previous: TrainingCalibration | undefined;
  trainingCompletion: number | null;
  checkin: TrainingCheckin;
  performance?: ExercisePerformance[];
  plannedRir: number;
  hasGym: boolean;
  /** Session length bucket from the questionnaire (used when the check-in asks for shorter sessions). */
  sessionBucket: string;
  /** Engine v5: what the month just lived asked of the person (estimated fatigue, double-session days, runs). */
  plannedLoad?: { fatigueStatus?: string; doubles?: number; runs?: number };
}): TrainingAdaptation {
  const { monthIndex, previous, trainingCompletion, checkin, performance, plannedRir, hasGym, sessionBucket, plannedLoad } = args;
  const prev = previous ?? {};
  const changes: string[] = [];
  const reasons: string[] = [];
  // carry over the decisions that are about the person, not about this month
  const cal: TrainingCalibration = {
    availableDays: prev.availableDays,
    sessionBucket: prev.sessionBucket,
    split: prev.split,
    avoidAreas: prev.avoidAreas ? [...prev.avoidAreas] : undefined,
    replaceIds: prev.replaceIds,
    volumeFactor: prev.volumeFactor ?? 1,
    rirShift: 0,
    groupSets: prev.groupSets ? { ...prev.groupSets } : undefined,
    fromMonth: monthIndex + 1,
    runHoldMonths: prev.runHoldMonths,
    recoveryLog: [...(prev.recoveryLog ?? [])],
  };
  const { trend, avgRir } = performanceTrend(performance);
  const tired = checkin.energy === 'low' || checkin.energy === 'veryLow';
  const veryTired = checkin.energy === 'veryLow';
  const sore = checkin.difficulty?.includes('soreness') ?? false;
  const noTime = checkin.difficulty?.includes('trainingTime') ?? false;
  const lowAdherence = (checkin.adherence != null && checkin.adherence <= 2) || (trainingCompletion != null && trainingCompletion < 0.5);

  // ---- explicit requests first: they are applied whatever the rest says
  const notedDays = daysFromNotes(checkin.notes);
  const requestedDays = checkin.newDays ?? (checkin.wantsChange?.includes('trainingDays') ? notedDays : null);
  if (requestedDays != null) {
    cal.availableDays = requestedDays;
    changes.push(`Giorni di allenamento portati a ${requestedDays} a settimana, come hai chiesto: la split viene ricostruita per quei giorni.`);
  } else if (checkin.wantsChange?.includes('trainingDays')) {
    reasons.push('Chiesto di cambiare i giorni ma senza indicare quanti: nessuna modifica (rispondi alla domanda sui giorni nel prossimo check-in).');
  }
  if (checkin.split) {
    cal.split = checkin.split;
    changes.push(`Struttura settimanale cambiata come richiesto (${checkin.split === 'fullBody' ? 'Full Body' : checkin.split === 'upperLower' ? 'Upper/Lower' : 'Push/Pull/Legs'}). Gli esercizi principali restano gli stessi dove possibile.`);
  }
  const pain = [...new Set([...(checkin.painAreas ?? []), ...painAreasFromNotes(checkin.notes)])];
  if (pain.length) {
    cal.avoidAreas = [...new Set([...(cal.avoidAreas ?? []), ...pain])];
    const label = pain.map((a) => ({ knee: 'ginocchio', shoulder: 'spalla', lowerBack: 'zona lombare', wrist: 'polso', hip: 'anca' })[a]).join(', ');
    changes.push(`Dolore segnalato (${label}): dal prossimo mese niente esercizi che caricano la zona e nessun aumento automatico per quegli esercizi. Se il dolore persiste o limita i movimenti, fatti valutare da un medico o da un fisioterapista.`);
  }

  // ---- recovery verdict of the month and its trend (engine v5): decisions look at the trend, not one answer
  const recPoor = checkin.recovery === 'poor' || sore || veryTired || (tired && checkin.sleep === 'poor');
  const verdict: 'good' | 'ok' | 'poor' = recPoor ? 'poor' : tired || checkin.recovery === 'ok' || checkin.sleep === 'poor' ? 'ok' : 'good';
  const prevVerdict = cal.recoveryLog!.length ? cal.recoveryLog![cal.recoveryLog!.length - 1] : null;
  cal.recoveryLog = [...cal.recoveryLog!, verdict].slice(-6);
  const hadRuns = (plannedLoad?.runs ?? 0) > 0;
  // running does not progress in a month after poor recovery or very irregular sessions
  if (hadRuns && (verdict === 'poor' || lowAdherence)) {
    cal.runHoldMonths = (cal.runHoldMonths ?? 0) + 1;
    changes.push(
      (plannedLoad?.doubles ?? 0) > 0
        ? 'Corsa: niente progressione il prossimo mese. Le doppie sedute pesano sul recupero: la corsa abbinata alla forza resta facile e non si allunga.'
        : 'Corsa: niente progressione il prossimo mese (stesse durate e stesse ripetute) finché il recupero non migliora.'
    );
  }

  if (!hasGym) {
    return { calibration: cal, changes, reasons, performanceTrend: trend };
  }

  // ---- adherence
  if (lowAdherence) {
    reasons.push(trainingCompletion != null && trainingCompletion < 0.5 ? `Completato il ${Math.round(trainingCompletion * 100)}% delle sedute.` : 'Aderenza dichiarata bassa.');
    if (noTime) {
      cal.sessionBucket = shorter(prev.sessionBucket ?? sessionBucket);
      changes.push('Poco tempo per allenarti: sedute più corte (meno esercizi accessori, stessi esercizi principali).');
    } else {
      cal.volumeFactor = Math.max(0.7, (cal.volumeFactor ?? 1) * 0.85);
      changes.push('Scheda semplificata: circa il 15% di serie in meno sugli esercizi accessori, gli esercizi principali restano. Il volume non aumenta finché le sedute non tornano regolari.');
    }
    return { calibration: cal, changes, reasons, performanceTrend: trend };
  }
  if (noTime) {
    cal.sessionBucket = shorter(prev.sessionBucket ?? sessionBucket);
    changes.push('Hai segnalato poco tempo per allenarti: sedute più corte, con gli stessi esercizi principali.');
  }

  // ---- recovery and fatigue
  // deload on the TREND: performance down with poor recovery, or poor recovery two check-ins in a row.
  // One bad month on its own (even very tired and sore) lightens the month without a deload.
  const highLoad = plannedLoad?.fatigueStatus === 'high' || plannedLoad?.fatigueStatus === 'excessive';
  if ((trend === 'declining' && (sore || tired || recPoor)) || (recPoor && prevVerdict === 'poor')) {
    cal.deloadFirstWeek = true;
    reasons.push(trend === 'declining' ? 'Prestazioni in calo e recupero difficile: segnali di fatica accumulata.' : 'Recupero scarso per due check-in di fila: la fatica si sta accumulando anche se il volume non è aumentato.');
    changes.push('Prima settimana di scarico (circa 40% di serie in meno, carichi circa −10%, più ripetizioni in riserva), poi si riprende il programma.');
    if (highLoad) {
      cal.volumeFactor = Math.max(0.7, (cal.volumeFactor ?? 1) * 0.9);
      changes.push('Il carico stimato del mese era elevato rispetto alla tua capacità: dopo lo scarico il volume riparte circa il 10% più basso.');
    }
    cal.recoveryNote = 'scarico per fatica accumulata (andamento)';
  } else if (sore || tired || recPoor) {
    if (trend === 'improving') {
      reasons.push('Stanchezza o dolori muscolari ma prestazioni in crescita: la fatica non viene dall’allenamento in sé.');
      cal.rirShift = 1;
      changes.push('Una ripetizione in più in riserva per un mese, volume invariato. Controlla sonno e alimentazione.');
    } else if (!recPoor && !highLoad && (checkin.sleep === 'poor' || !sore)) {
      // a single negative signal (tired, or poor sleep) with stable performance: keep the plan, a little more margin
      cal.rirShift = 1;
      reasons.push(checkin.sleep === 'poor' ? 'Energia bassa con sonno scarso e prestazioni stabili: la causa probabile è il sonno, non il volume.' : 'Energia bassa con prestazioni stabili: un solo segnale negativo.');
      changes.push('Programma mantenuto, con una ripetizione in più in riserva per un mese. Nessuno scarico per un solo segnale.');
      cal.recoveryNote = 'segnale isolato: programma mantenuto';
    } else {
      cal.volumeFactor = Math.max(0.7, (cal.volumeFactor ?? 1) * 0.9);
      cal.rirShift = 1;
      reasons.push(sore ? 'Recupero difficile.' : 'Energia bassa.');
      if (highLoad) reasons.push('Il carico stimato del mese era elevato rispetto alla capacità.');
      changes.push(prevVerdict === 'poor' ? 'Stress ridotto per un mese: circa il 10% di serie in meno e una ripetizione in più in riserva.' : 'Stress ridotto per un mese: circa il 10% di serie in meno e una ripetizione in più in riserva. Se il recupero resta scarso al prossimo check-in, scatta una settimana di scarico.');
      cal.recoveryNote = 'recupero difficile: stress ridotto, scarico solo se continua';
    }
  } else if (trend === 'improving') {
    reasons.push('Prestazioni in crescita con buon recupero.');
    if ((checkin.energy === 'high' || checkin.energy === 'veryHigh') && (cal.volumeFactor ?? 1) < 1.1) {
      cal.volumeFactor = Math.min(1.1, (cal.volumeFactor ?? 1) * 1.05);
      changes.push('Progressione confermata e un po’ di volume in più (circa +5%) dove recuperi bene.');
    } else changes.push('Progressione confermata: carichi in salita con la doppia progressione, volume invariato.');
  } else if (trend === 'stable') {
    if (avgRir != null && avgRir >= plannedRir + 2) {
      cal.rirShift = -1;
      reasons.push(`Prestazioni ferme con RIR registrato medio ${avgRir.toFixed(1)}, più alto del previsto: le serie sono state troppo lontane dal cedimento.`);
      changes.push('Stessi esercizi e stesso volume: porta le serie una ripetizione più vicino al cedimento (RIR −1).');
    } else {
      reasons.push('Prestazioni stabili: tecnica, RIR e recupero sono nella norma, nessun motivo per cambiare esercizi o volume.');
      changes.push('Programma confermato: stessi esercizi principali, continua con la doppia progressione.');
    }
  } else if (trend === 'declining') {
    cal.volumeFactor = Math.max(0.7, (cal.volumeFactor ?? 1) * 0.9);
    reasons.push('Prestazioni in calo senza altri segnali di fatica.');
    changes.push('Circa il 10% di serie in meno per un mese per recuperare le prestazioni.');
  } else {
    changes.push('Progressione normale: registra carichi, ripetizioni e RIR, così il prossimo check-in può valutare le prestazioni.');
  }

  // ---- intensity request
  if (checkin.wantsChange?.includes('trainingIntensity')) {
    if (tired || sore) {
      cal.rirShift = Math.max(cal.rirShift ?? 0, 1);
      changes.push('Richiesta di cambiare intensità con energia bassa: allenamenti meno duri (una ripetizione in più in riserva).');
    } else {
      cal.rirShift = Math.min(cal.rirShift ?? 0, -1);
      changes.push('Richiesta di più intensità: serie una ripetizione più vicine al cedimento sugli esercizi sicuri. Il volume non cambia.');
    }
  }
  return { calibration: cal, changes, reasons, performanceTrend: trend };
}

function shorter(bucket: string | undefined): string {
  const order = ['lt30', '30-45', '45-60', '60-90', 'gt90'];
  const i = order.indexOf(bucket ?? '');
  if (i < 0) return '45-60';
  return order[Math.max(0, i - 1)];
}
