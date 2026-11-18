/**
 * Plan validator (engine v4). The planner is designed not to produce these problems; this is the
 * independent last line, and it checks what was ACTUALLY prescribed — the exercises of every week —
 * never a flag or a metadata value alone.
 *
 *  - blocker: the plan must not be shown as is (incompatible exercise, missing equipment, a deload that
 *    does not lighten the week, invalid prescriptions, mesocycle and sessions out of step);
 *  - warning: needs attention (volume out of target, frequency, near-duplicate exercises, week layout,
 *    recovery between stimuli, incomplete movement patterns, session too long);
 *  - info: explanations (exclusions, partial coverage the equipment imposes, conditional deloads).
 *
 * It never diagnoses: on reported pain it removes load from the area and suggests a professional.
 */
import type { UserContext } from '@/domain/user-context';

import type { PlanFinding, TrainingMonthPlan, TrainingPlan } from '../types';
import { CATALOG_BY_ID } from './catalog';
import { buildProgramProfile, type ProgramProfile } from './profile';
import { nearDuplicate } from './session-builder';

export type SafetyIssue = { code: string; month: number; message: string };
export type Finding = PlanFinding;

type Meta = { subject?: string; cause?: string; impact?: string; action?: string; key?: string };

/** Category, impact and corrective action of each code (shown with every finding). */
const CODE_META: Record<string, { category: string; impact: string; action?: string }> = {
  B1: { category: 'equipment', impact: 'L’esercizio non si può eseguire.', action: 'Sostituire con un esercizio compatibile con l’attrezzatura.' },
  B2: { category: 'safety', impact: 'Carica una zona dolorante.', action: 'Escludere l’esercizio.' },
  B3: { category: 'deload', impact: 'Lo scarico non riduce davvero la fatica.', action: 'Applicare serie, RIR e carichi della settimana di scarico.' },
  B4: { category: 'prescription', impact: 'Prescrizione non eseguibile.', action: 'Rigenerare l’esercizio.' },
  B5: { category: 'prescription', impact: 'La settimana non ha la sua prescrizione.', action: 'Rigenerare il mese.' },
  B6: { category: 'safety', impact: 'Rischio tecnico e fatica eccessiva.', action: 'Lasciare almeno una ripetizione in riserva.' },
  B7: { category: 'deload', impact: 'Mesociclo e sedute non coincidono.', action: 'Rigenerare il mese.' },
  B8: { category: 'volume', impact: 'Volume diretto oltre la capacità di recupero del livello.', action: 'Ridurre le serie del gruppo.' },
  B9: { category: 'hybrid', impact: 'Due sedute impegnative nello stesso giorno.', action: 'Separare le sedute in giorni diversi.' },
  W1: { category: 'volume', impact: 'Stimolo del gruppo diverso dall’obiettivo.', action: 'Verificare il motivo o riequilibrare le serie.' },
  W2: { category: 'volume', impact: 'Tutto il volume del gruppo in una seduta.', action: 'Distribuire su più sedute.' },
  W3: { category: 'exercises', impact: 'Esercizi ridondanti nella stessa seduta.', action: 'Sostituire una delle due varianti.' },
  W4: { category: 'hybrid', impact: 'Recupero ridotto tra sedute impegnative.', action: 'Spostare una delle sedute o renderla più facile.' },
  W5: { category: 'recovery', impact: 'Lo stesso gruppo lavora molto in giorni consecutivi.', action: 'Distanziare le sedute o ridurre il volume di una.' },
  W6: { category: 'patterns', impact: 'Uno schema motorio fondamentale non è allenato.', action: 'Aggiungere attrezzatura o un esercizio dello schema.' },
  W7: { category: 'schedule', impact: 'La seduta supera il tempo disponibile.', action: 'Ridurre serie o esercizi accessori.' },
  W8: { category: 'fatigue', impact: 'Carico settimanale oltre la capacità stimata.', action: 'Ridurre serie o intensità, o distribuire meglio.' },
  W9: { category: 'fatigue', impact: 'Fatica locale accumulata su sedute vicine.', action: 'Distanziare le sedute o ridurre il volume di una.' },
  W10: { category: 'progression', impact: 'Un esercizio principale cambia senza motivo: si perde lo storico.', action: 'Mantenere l’esercizio principale nel mesociclo.' },
  W11: { category: 'volume', impact: 'Gruppo sotto obiettivo da più mesi senza un motivo dichiarato.', action: 'Rivedere distribuzione e tempo o documentare il limite.' },
  W12: { category: 'hybrid', impact: 'Giornata con doppia seduta molto lunga.', action: 'Accorciare una delle due sedute.' },
  R1: { category: 'conflict', impact: 'Il piano è provvisorio finché non scegli.', action: 'Rispondere alla domanda indicata.' },
  R2: { category: 'safety', impact: 'Serve una valutazione professionale.', action: 'Farsi valutare da un medico o da un fisioterapista.' },
};

const MAX_WEEKLY_PER_GROUP = { beginner: 14, intermediate: 22, advanced: 26 } as const;

export function validateMonth(m: TrainingMonthPlan, ctx: UserContext, opts: { profile: ProgramProfile; splitKind: string | null; hybrid: boolean; availableDays?: number }): Finding[] {
  const out: Finding[] = [];
  const p = opts.profile;
  const unavoidable = new Set(m.compromises ?? []);
  const COMPROMISE_OF: Record<string, string> = {
    'W4:gym-gym': 'due sedute di forza consecutive',
    'W4:legs-before-run': 'una seduta con le gambe il giorno prima di una corsa impegnativa',
    'W4:run-before-legs': 'una corsa impegnativa il giorno prima di una seduta con le gambe',
    'W4:quality-long': 'due corse impegnative consecutive',
    'W4:lower-lower': 'due sedute per le gambe consecutive',
  };
  const push = (level0: Finding['level'], code0: string, message0: string, meta?: Meta) => {
    // a layout problem the available days make unavoidable is a declared compromise, not a warning
    const comp = meta?.key ? (meta.key.startsWith('W9:') ? 'stimoli sullo stesso gruppo in giorni consecutivi' : COMPROMISE_OF[meta.key]) : undefined;
    const isCompromise = level0 === 'warning' && !!comp && unavoidable.has(comp);
    const level = isCompromise ? 'info' : level0;
    const code = isCompromise ? 'I12' : code0;
    const message = isCompromise ? `${message0} Compromesso inevitabile con ${opts.availableDays ?? 'questi'} giorni disponibili: è la disposizione con meno fatica sovrapposta.` : message0;
    const cm = CODE_META[code0];
    out.push({
      level,
      code,
      message,
      category: cm?.category ?? 'info',
      ...(meta?.subject ? { subject: meta.subject } : {}),
      cause: meta?.cause ?? message,
      ...(meta?.impact ?? cm?.impact ? { impact: meta?.impact ?? cm?.impact } : {}),
      ...(meta?.action ?? cm?.action ? { action: meta?.action ?? cm?.action } : {}),
      groupKey: meta?.key ?? `${code}:${meta?.subject ?? message}`,
    });
  };
  const B = (code: string, message: string, meta?: Meta) => push('blocker', code, message, meta);
  const W = (code: string, message: string, meta?: Meta) => push('warning', code, message, meta);
  const I = (code: string, message: string, meta?: Meta) => push('info', code, message, meta);
  const R = (code: string, message: string, meta?: Meta) => push('review', code, message, meta);
  const workouts = m.weeklySplit.map((d, i) => ({ d, i })).filter(({ d }) => d.type === 'workout');

  // ---- per exercise
  for (const { d } of workouts) {
    const ex = d.exercises ?? [];
    for (const x of ex) {
      const def = CATALOG_BY_ID.get(x.id);
      if (!def) continue;
      const missing = def.equipment.filter((e) => !p.equipment.has(e));
      if (missing.length) B('B1', `${d.weekday}, ${x.name}: richiede attrezzatura non disponibile (${missing.join(', ')}).`);
      if (def.areas.some((a) => p.exclusions.areas.has(a))) B('B2', `${d.weekday}, ${x.name}: carica una zona indicata come dolorante.`);
      if (!(x.sets >= 1 && x.sets <= 6) || !x.reps || x.rir == null || x.rir < 0 || x.rir > 5 || !(x.restSec > 0) || !x.tempo) B('B4', `${d.weekday}, ${x.name}: prescrizione mancante o non valida (${x.sets}×${x.reps}, RIR ${x.rir ?? '—'}, recupero ${x.restSec} s).`);
      if (x.rir === 0 && (p.level === 'beginner' || p.isMinor || def.kind === 'compound')) B('B6', `${d.weekday}, ${x.name}: cedimento non adatto a questo esercizio o livello.`);
      if (!x.weeks || x.weeks.length !== (m.mesocycle?.weeks.length ?? 4)) B('B5', `${d.weekday}, ${x.name}: mancano le prescrizioni settimanali del mesociclo.`);
    }
    // near-duplicates in the same session
    for (let a = 0; a < ex.length; a++)
      for (let b = a + 1; b < ex.length; b++) {
        const da = CATALOG_BY_ID.get(ex[a].id);
        const db = CATALOG_BY_ID.get(ex[b].id);
        if (da && db && nearDuplicate(da, db)) W('W3', `${d.weekday}: ${ex[a].name} e ${ex[b].name} sono varianti quasi identiche nella stessa seduta.`);
      }
    if (d.estimatedMinutes && d.estimatedMinutes > p.sessionMinutes + 5) W('W7', `${d.weekday}: seduta stimata ${d.estimatedMinutes} minuti, oltre i ${p.sessionMinutes} disponibili.`);
  }

  // ---- mesocycle → week → exercise: what each week really prescribes
  const weeks = m.mesocycle?.weeks ?? [];
  const weekSets = (w: number) => workouts.reduce((s, { d }) => s + (d.exercises ?? []).reduce((a, x) => a + (x.weeks?.find((y) => y.week === w)?.sets ?? x.sets), 0), 0);
  const ordinary = weeks.find((w) => !w.deload && w.setsFactor === 1);
  const ordinarySets = ordinary ? weekSets(ordinary.week) : weekSets(2);
  for (const w of weeks) {
    const actual = weekSets(w.week);
    if (w.sets != null && w.sets !== actual) B('B7', `Settimana ${w.week}: il mesociclo dichiara ${w.sets} serie, le sedute ne prescrivono ${actual}.`);
    if (!w.deload) continue;
    if (actual >= ordinarySets) B('B3', `Settimana ${w.week} di scarico: ${actual} serie contro ${ordinarySets} della settimana ordinaria, il volume non scende.`);
    for (const { d } of workouts)
      for (const x of d.exercises ?? []) {
        const wk = x.weeks?.find((y) => y.week === w.week);
        if (!wk) continue;
        if (wk.sets >= x.sets && x.sets > 1) B('B3', `Settimana ${w.week} di scarico, ${x.name}: ${wk.sets} serie come nella settimana ordinaria.`);
        if (x.rir != null && (wk.rir ?? 0) <= x.rir && x.rir < 4) B('B3', `Settimana ${w.week} di scarico, ${x.name}: RIR ${wk.rir} non più prudente del ${x.rir} ordinario.`);
        if (wk.technique && wk.technique.kind !== 'antagonistSuperset') B('B3', `Settimana ${w.week} di scarico, ${x.name}: resta la tecnica "${wk.technique.label}".`);
        if (wk.suggestedKg === 0 && (x.suggestedKg ?? 0) > 0) B('B3', `Settimana ${w.week} di scarico, ${x.name}: carico azzerato.`);
        if (x.suggestedKg != null && x.suggestedKg > 0 && wk.suggestedKg != null && wk.suggestedKg > x.suggestedKg) B('B3', `Settimana ${w.week} di scarico, ${x.name}: carico più alto della settimana ordinaria.`);
      }
    I('I3', `Settimana ${w.week}${w.conditional ? ' (solo se serve)' : ''}: scarico con ${actual} serie contro ${ordinarySets} (${Math.round((1 - actual / Math.max(1, ordinarySets)) * 100)}% in meno).`);
  }

  // ---- volume per group: direct, indirect, total, frequency, distribution
  const ex = workouts.flatMap(({ d }) => d.exercises ?? []);
  for (const v of m.weeklyVolume ?? []) {
    const small = ['Deltoide laterale', 'Deltoide posteriore', 'Bicipiti', 'Tricipiti', 'Polpacci', 'Brachiale e avambracci', 'Addome e core'].includes(v.label);
    const vk = { subject: v.label };
    if (v.status === 'excluded' && (v.reason ?? '').includes('dolore')) R('R2', `${v.label}: sospeso per dolore, nessuna variante compatibile. Il volume non viene spostato su altri gruppi; serve una valutazione professionale prima di reintrodurlo.`, { ...vk, key: `R2:${v.group}` });
    else if (v.status === 'excluded') I('I1', `${v.label}: ${v.reason ?? 'escluso'} Il volume non viene spostato su altri gruppi.`, { ...vk, key: `I1:${v.group}` });
    else if (v.status === 'under' && small && m.timeCapped) I('I6', `${v.label}: ${v.fractional} serie contro ${v.target}: con il tempo disponibile i gruppi piccoli lavorano soprattutto in modo indiretto.`, { ...vk, key: `I6:${v.group}`, cause: 'Tempo disponibile' });
    else if (v.status === 'under' && m.timeCapped) I('I13', `${v.label}: ${v.fractional} serie (dirette ${v.direct}, indirette ${v.indirect}) contro un obiettivo di ${v.target}: il tempo disponibile non basta. Compromesso voluto, il volume non viene forzato.`, { ...vk, key: `W1-under:${v.group}`, cause: 'Tempo disponibile', impact: 'Stimolo diretto ridotto rispetto all’obiettivo.', action: 'Sedute più lunghe o un giorno in più, se possibile.' });
    else if (v.status === 'under') W('W1', `${v.label}: ${v.fractional} serie (dirette ${v.direct}, indirette ${v.indirect}) contro un obiettivo di ${v.target}.${v.reason ? ' ' + v.reason : ''}`, { ...vk, key: `W1-under:${v.group}`, cause: v.reason ?? 'Sotto obiettivo' });
    else if (v.status === 'over' && opts.profile.model === 'strength' && ex.some((x) => x.role === 'main' && CATALOG_BY_ID.get(x.id)?.primary === v.group))
      I('I14', `${v.label}: ${v.direct} serie dirette contro un obiettivo di ${v.target}: sono le serie dell’alzata principale, che in un programma di forza si allena spesso.`, { ...vk, key: `W1-over:${v.group}`, cause: 'Pratica dei fondamentali (forza)' });
    else if (v.status === 'over') W('W1', `${v.label}: ${v.direct} serie dirette (${v.fractional} con le indirette) contro un obiettivo di ${v.target}.`, { ...vk, key: `W1-over:${v.group}`, cause: 'Serie dirette sopra obiettivo' });
    else if (v.reason) I('I5', `${v.label}: ${v.fractional} serie (dirette ${v.direct}, indirette ${v.indirect}) contro un obiettivo di ${v.target}. ${v.reason}`, { ...vk, key: `I5:${v.group}`, cause: v.reason });
    if (v.direct > MAX_WEEKLY_PER_GROUP[p.level]) B('B8', `${v.label}: ${v.direct} serie dirette a settimana, troppe per il livello.`);
    if (v.target >= 8 && v.frequency === 1 && workouts.length >= 3 && opts.splitKind !== 'pushPullLegs' && opts.splitKind !== 'broSplit') W('W2', `${v.label}: ${v.target} serie in una sola seduta a settimana.`, { subject: v.label, key: `W2:${v.group}` });
  }
  // per-session ceiling and recovery between stimuli of the same group
  const directBy = (d: (typeof workouts)[number]['d']) => {
    const mp = new Map<string, number>();
    for (const x of d.exercises ?? []) {
      const def = CATALOG_BY_ID.get(x.id);
      if (def) mp.set(def.primary, (mp.get(def.primary) ?? 0) + x.sets);
    }
    return mp;
  };
  for (let k = 0; k < workouts.length; k++) {
    const a = workouts[k];
    const b = workouts[(k + 1) % workouts.length];
    if (workouts.length < 2 || (b.i - a.i + 7) % 7 !== 1) continue;
    const da = directBy(a.d);
    const db = directBy(b.d);
    for (const [g, n] of da) if (n >= 6 && (db.get(g) ?? 0) >= 6) W('W5', `${a.d.weekday} e ${b.d.weekday}: ${n} e ${db.get(g)} serie dirette per lo stesso gruppo in giorni consecutivi.`, { subject: g, key: `W5:${g}` });
  }

  // ---- movement patterns
  for (const c of m.patternCoverage ?? []) {
    const label = { push: 'spinta', pull: 'tirata', knee: 'dominante di ginocchio', hip: 'dominante d’anca', core: 'core' }[c.pattern];
    const pain = !!c.note && c.note.includes('zone doloranti');
    if (c.status === 'missing' && pain) I('I4', `Schema ${label} sospeso per le zone doloranti indicate: serve il parere di un professionista.`, { subject: label, key: `I4:${c.pattern}` });
    else if (c.status === 'missing') W('W6', `Schema ${label} assente nella settimana.${c.note ? ' ' + c.note : ''}`, { subject: label, key: `W6:${c.pattern}` });
    else if (c.status === 'partial') I('I2', `Schema ${label} coperto solo in parte (${c.exercises.join(', ')}).${c.note ? ' ' + c.note : ''}`, { subject: label, key: `I2:${c.pattern}` });
  }

  // ---- week layout (strength + running), daily duration, double sessions
  const legLoad = (d: (typeof m.weeklySplit)[number]) =>
    (d.exercises ?? []).reduce((a, x) => a + (['quads', 'hamstrings', 'glutes'].includes(CATALOG_BY_ID.get(x.id)?.primary ?? '') ? x.sets : 0), 0);
  const kinds = m.weeklySplit.map((d) =>
    d.type === 'workout' ? (legLoad(d) >= 6 ? 'lower' : 'gym') : d.type === 'cardio' ? (d.run?.kind === 'easy' ? 'easy' : d.run?.kind === 'long' ? 'long' : 'quality') : 'rest'
  );
  for (let i = 0; i < 7; i++) {
    const a = kinds[i];
    const b = kinds[(i + 1) % 7];
    const da = m.weeklySplit[i].weekday;
    const db = m.weeklySplit[(i + 1) % 7].weekday;
    const key = { subject: `${da}→${db}` };
    if (a === 'lower' && b === 'lower') W('W4', `${da} e ${db}: due sedute impegnative per le gambe consecutive.`, { ...key, key: 'W4:lower-lower', cause: 'Recupero locale delle gambe insufficiente' });
    if (opts.hybrid) {
      if ((a === 'gym' || a === 'lower') && (b === 'gym' || b === 'lower') && !(a === 'lower' && b === 'lower')) W('W4', `${da} e ${db}: due sedute di forza consecutive.`, { ...key, key: 'W4:gym-gym' });
      if (a === 'lower' && (b === 'quality' || b === 'long')) W('W4', `${da}: seduta di forza per le gambe il giorno prima di ${b === 'long' ? 'un lungo' : 'una corsa intensa'}.`, { ...key, key: 'W4:legs-before-run' });
      if (a === 'quality' && b === 'lower') W('W4', `${da}: corsa intensa il giorno prima di una seduta pesante per le gambe: fatica residua sulle gambe.`, { ...key, key: 'W4:run-before-legs' });
      if ((a === 'quality' && b === 'long') || (a === 'long' && b === 'quality')) W('W4', `${da} e ${db}: ripetute e lungo in giorni consecutivi.`, { ...key, key: 'W4:quality-long' });
    }
  }
  for (const { d } of workouts) {
    if (!d.extraRun) continue;
    if (d.extraRun.kind !== 'easy') B('B9', `${d.weekday}: corsa ${d.extraRun.title.toLowerCase()} nello stesso giorno di una seduta di forza.`, { subject: d.weekday });
    const total = (d.estimatedMinutes ?? 0) + d.extraRun.minutes;
    if (total > p.sessionMinutes + 50) W('W12', `${d.weekday}: doppia seduta di ${total} minuti in totale.`, { subject: d.weekday, key: 'W12' });
    else I('I7', `${d.weekday}: doppia seduta, ${d.estimatedMinutes} minuti di forza e ${d.extraRun.minutes} di corsa facile (${d.extraRun.order === 'runFirst' ? 'prima la corsa' : 'prima la forza'}, a ${d.extraRun.gapHours} ore di distanza).`, { subject: d.weekday, key: 'I7' });
  }

  // ---- fatigue (engine v5)
  const f = m.fatigue;
  if (f) {
    if (f.status === 'excessive') W('W8', `Carico settimanale stimato ${f.weekly} serie effettive, ${Math.round(f.ratio * 100)}% della capacità stimata (${f.capacity}).`, { subject: 'settimana', key: 'W8' });
    else if (f.status === 'high') I('I8', `Carico settimanale elevato: ${Math.round(f.ratio * 100)}% della capacità stimata. Sostenibile se il recupero resta buono: il check-in lo verifica.`, { subject: 'settimana', key: 'I8' });
    for (const g of f.groups) if (g.closeStimuli.length) W('W9', `${g.label}: stimoli impegnativi in giorni consecutivi (${g.closeStimuli.join(', ')}).`, { subject: g.label, key: `W9:${g.group}` });
    if (f.action) I('I9', f.action, { subject: 'settimana', key: 'I9' });
  }

  // ---- traceability: exercise changes
  for (const c of m.exerciseChanges ?? []) {
    if (c.reason) continue;
    const what = `${c.session}: ${c.from ?? '—'} → ${c.to ?? 'tolto'}`;
    if (c.role === 'main') W('W10', `${what}, esercizio principale cambiato senza un motivo.`, { subject: c.session, key: `W10:${c.from}` });
    else I('I10', `${what}: variazione di un accessorio senza un motivo specifico (equilibrio della seduta).`, { subject: c.session, key: `I10:${c.session}` });
  }
  void ctx;
  return out;
}

/** Plan-level findings, across months (engine v5): groups under target for months, conflicts to confirm. */
export function validatePlanHistory(plan: TrainingPlan, generatedFrom: number): void {
  const gen = plan.months.filter((m) => m.monthIndex >= generatedFrom && m.validation);
  // a group under target for 2+ consecutive months: intentional (time, pain, equipment) or a programming limit
  const streak = new Map<string, number>();
  for (const m of plan.months) {
    for (const v of m.weeklyVolume ?? []) {
      const under = v.status === 'under';
      const n = under ? (streak.get(v.group) ?? 0) + 1 : 0;
      streak.set(v.group, n);
      if (n < 2 || !m.validation || m.monthIndex < generatedFrom) continue;
      const intentional = /tempo/.test(v.reason ?? '') || m.timeCapped;
      // same problem as this month's under-target finding: annotate it instead of adding a duplicate
      const same = m.validation.find((f) => f.groupKey === `W1-under:${v.group}`);
      if (same) {
        if (!same.message.includes('mesi')) {
          same.message += intentional ? ` Sotto obiettivo da ${n} mesi: limite voluto del tempo disponibile.` : ` Sotto obiettivo da ${n} mesi senza un motivo dichiarato: limite della programmazione da rivedere.`;
          same.cause = `${same.cause ?? ''} (da ${n} mesi)`.trim();
        }
        continue;
      }
      m.validation.push({
        level: intentional ? 'info' : 'warning',
        code: intentional ? 'I11' : 'W11',
        category: 'volume',
        subject: v.label,
        message: `${v.label}: sotto obiettivo da ${n} mesi (${v.fractional} su ${v.target}).${intentional ? ' Limite voluto: il tempo disponibile non basta, il gruppo lavora soprattutto in modo indiretto.' : ' Nessun motivo dichiarato: è un limite della programmazione da rivedere.'}`,
        cause: intentional ? 'Tempo disponibile' : 'Distribuzione del volume',
        impact: intentional ? 'Stimolo diretto ridotto, scelto per rispettare il tempo.' : 'Gruppo sottoallenato in modo continuativo.',
        action: intentional ? 'Nessuna, salvo più tempo disponibile.' : 'Rivedere distribuzione e sedute.',
        groupKey: `W1-under:${v.group}`,
      });
    }
  }
  // conflicts that need the person's choice: a review finding in each month they apply to (same key = one problem)
  for (const m of gen)
    for (const c of m.conflicts ?? [])
      if (c.needsConfirmation)
        m.validation!.push({
          level: 'review',
          code: c.id === 'pain' ? 'R2' : 'R1',
          category: c.id === 'pain' ? 'safety' : 'conflict',
          subject: c.title,
          message: `${c.title}: ${c.decision} Alternative: ${c.alternatives.join(' / ')}`,
          cause: c.description,
          impact: c.id === 'pain' ? 'Serve una valutazione professionale.' : 'Il piano è provvisorio finché non scegli.',
          action: c.id === 'pain' ? 'Farsi valutare da un medico o da un fisioterapista.' : 'Scegli nel profilo la precedenza o se puoi fare due sedute nello stesso giorno.',
          groupKey: `conflict:${c.id}`,
        });
}

export function validateTrainingPlan(plan: TrainingPlan, ctx: UserContext): SafetyIssue[] {
  if (!ctx.training) return [];
  const issues: SafetyIssue[] = [];
  const calib = plan.calibration?.training ?? null;
  for (const m of plan.months) {
    const active = calib && m.monthIndex >= (calib.fromMonth ?? 1) ? calib : null;
    const p = buildProgramProfile(ctx, active);
    // months stored by an older engine have no validation: check the essentials
    const findings = m.validation ?? validateMonth(m, ctx, { profile: p, splitKind: null, hybrid: false });
    for (const f of findings) if (f.level === 'blocker') issues.push({ code: f.code, month: m.monthIndex, message: f.message });
  }
  return issues;
}
