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

import type { TrainingMonthPlan, TrainingPlan } from '../types';
import { CATALOG_BY_ID } from './catalog';
import { buildProgramProfile, type ProgramProfile } from './profile';
import { nearDuplicate } from './session-builder';

export type SafetyIssue = { code: string; month: number; message: string };
export type Finding = { level: 'blocker' | 'warning' | 'info'; code: string; message: string };

const MAX_WEEKLY_PER_GROUP = { beginner: 14, intermediate: 22, advanced: 26 } as const;

export function validateMonth(m: TrainingMonthPlan, ctx: UserContext, opts: { profile: ProgramProfile; splitKind: string | null; hybrid: boolean }): Finding[] {
  const out: Finding[] = [];
  const p = opts.profile;
  const B = (code: string, message: string) => out.push({ level: 'blocker', code, message });
  const W = (code: string, message: string) => out.push({ level: 'warning', code, message });
  const I = (code: string, message: string) => out.push({ level: 'info', code, message });
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
  for (const v of m.weeklyVolume ?? []) {
    const small = ['Deltoide laterale', 'Deltoide posteriore', 'Bicipiti', 'Tricipiti', 'Polpacci', 'Brachiale e avambracci', 'Addome e core'].includes(v.label);
    if (v.status === 'excluded') I('I1', `${v.label}: ${v.reason ?? 'escluso'} Il volume non viene spostato su altri gruppi.`);
    else if (v.status === 'under' && small && m.timeCapped) I('I6', `${v.label}: ${v.fractional} serie contro ${v.target}: con il tempo disponibile i gruppi piccoli lavorano soprattutto in modo indiretto.`);
    else if (v.status === 'under') W('W1', `${v.label}: ${v.fractional} serie (dirette ${v.direct}, indirette ${v.indirect}) contro un obiettivo di ${v.target}.${v.reason ? ' ' + v.reason : ''}`);
    else if (v.status === 'over') W('W1', `${v.label}: ${v.direct} serie dirette (${v.fractional} con le indirette) contro un obiettivo di ${v.target}.`);
    else if (v.reason) I('I5', `${v.label}: ${v.fractional} serie (dirette ${v.direct}, indirette ${v.indirect}) contro un obiettivo di ${v.target}. ${v.reason}`);
    if (v.direct > MAX_WEEKLY_PER_GROUP[p.level]) B('B8', `${v.label}: ${v.direct} serie dirette a settimana, troppe per il livello.`);
    if (v.target >= 8 && v.frequency === 1 && workouts.length >= 3 && opts.splitKind !== 'pushPullLegs' && opts.splitKind !== 'broSplit') W('W2', `${v.label}: ${v.target} serie in una sola seduta a settimana.`);
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
    for (const [g, n] of da) if (n >= 6 && (db.get(g) ?? 0) >= 6) W('W5', `${a.d.weekday} e ${b.d.weekday}: ${n} e ${db.get(g)} serie dirette per lo stesso gruppo in giorni consecutivi.`);
  }

  // ---- movement patterns
  for (const c of m.patternCoverage ?? []) {
    const label = { push: 'spinta', pull: 'tirata', knee: 'dominante di ginocchio', hip: 'dominante d’anca', core: 'core' }[c.pattern];
    const pain = !!c.note && c.note.includes('zone doloranti');
    if (c.status === 'missing' && pain) I('I4', `Schema ${label} sospeso per le zone doloranti indicate: serve il parere di un professionista.`);
    else if (c.status === 'missing') W('W6', `Schema ${label} assente nella settimana.${c.note ? ' ' + c.note : ''}`);
    else if (c.status === 'partial') I('I2', `Schema ${label} coperto solo in parte (${c.exercises.join(', ')}).${c.note ? ' ' + c.note : ''}`);
  }

  // ---- week layout (strength + running)
  const kinds = m.weeklySplit.map((d) => (d.type === 'workout' ? 'gym' : d.type === 'cardio' ? ((d.run?.kind ?? '') === 'easy' ? 'easy' : d.run?.kind === 'long' ? 'long' : 'quality') : 'rest'));
  if (opts.hybrid) {
    for (let i = 0; i < 7; i++) {
      const a = kinds[i];
      const b = kinds[(i + 1) % 7];
      const da = m.weeklySplit[i].weekday;
      const db = m.weeklySplit[(i + 1) % 7].weekday;
      if (a === 'gym' && b === 'gym') W('W4', `${da} e ${db}: due sedute di forza consecutive.`);
      if (a === 'gym' && (b === 'quality' || b === 'long')) W('W4', `${da}: seduta di forza il giorno prima di ${b === 'long' ? 'un lungo' : 'una seduta di qualità'}.`);
      if ((a === 'quality' && b === 'long') || (a === 'long' && b === 'quality')) W('W4', `${da} e ${db}: ripetute e lungo in giorni consecutivi.`);
    }
  }
  void ctx;
  return out;
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
