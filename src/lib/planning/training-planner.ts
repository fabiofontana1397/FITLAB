/**
 * Training engine v3 — orchestrator.
 *
 *   profile (level, model, time, equipment, limits)      training/profile.ts
 *   → days and split                                     training-days.ts, training/split.ts
 *   → periodization (block per month, weeks)             training/periodization.ts
 *   → weekly volume per muscle group                     training/volume.ts
 *   → sessions: exercises, blocks, order, time budget    training/session-builder.ts
 *   → sets/reps/RIR/rest/tempo/progression               training/prescription.ts
 *   → initial loads to calibrate                         training/loads.ts
 *   → running sessions                                   training/running.ts
 *   → safety checks                                      training/safety.ts
 *
 * The monthly check-in never edits this file's output by hand: it changes the
 * TrainingCalibration (training/types.ts) and the plan is rebuilt from the next
 * month with it, months already lived untouched.
 */
import type { UserContext } from '@/domain/user-context';

import { WEEKDAY_LABELS } from './exercise-library';
import { arrangeWeek, resolveSchedule } from './training-days';
import { CATALOG, MUSCLE_LABEL, MUSCLE_SHORT, type CatalogExercise, type MuscleGroup } from './training/catalog';
import { initialLoad } from './training/loads';
import { blockSequence, monthBlock } from './training/periodization';
import { BLOCK_LABEL, prescribe, weekPrescription, type Block, type Role } from './training/prescription';
import { buildProgramProfile, LEVEL_LABEL, MODEL_LABEL, type ProgramProfile } from './training/profile';
import { runWeek } from './training/running';
import { validateMonth, validateTrainingPlan } from './training/safety';
import { balanceVolume, buildSession, ensureCoverage, measureCoverage, perSessionTargets, type PlannedSession } from './training/session-builder';
import { chooseSplit, SPLIT_LABEL } from './training/split';
import type { TrainingCalibration } from './training/types';
import { measureVolume, setMinutes, weeklyTargets } from './training/volume';
import type { TrainingStrategy } from './strategy-types';
import type { PlanPhaseKind, TrainingDayPlan, TrainingExerciseEntry, TrainingMonthPlan, TrainingPlan } from './types';
import type { WeekPlan } from './training/periodization';

/** Bump when the prescription logic changes: an older stored plan is rebuilt in place (see isValidTrainingPlan). */
export const TRAINING_ENGINE_VERSION = 'training-4';

export type TrainingPlanInput = {
  ctx: UserContext;
  durationMonths: number;
  strategy?: TrainingStrategy | null;
  /** Monthly recalibration: months before this index are copied verbatim from
   * `existingMonths` (a month already lived through never changes). */
  preserveMonthsBefore?: number;
  existingMonths?: TrainingMonthPlan[];
  /** Recalibration knobs — see domain/recalibration.ts. */
  tuning?: TrainingTuning;
};

/** What the monthly recalibration can change in the next months' training. */
export type TrainingTuning = {
  training?: TrainingCalibration;
  /** Month index from which the tuning applies. */
  fromMonth?: number;
};

const AREA_LABEL: Record<string, string> = { knee: 'ginocchio', shoulder: 'spalla', lowerBack: 'zona lombare', wrist: 'polso', hip: 'anca' };
const PATTERN_TITLE: Record<string, string> = { push: 'Spinta', pull: 'Tirata', knee: 'Dominante di ginocchio', hip: 'Dominante d’anca', core: 'Core' };

function coarsePhase(b: Block): PlanPhaseKind {
  return b === 'adattamento' ? 'adattamento' : b === 'consolidamento' ? 'consolidamento' : 'progressione';
}

function entryFor(pe: PlannedSession['exercises'][number], order: number, p: ProgramProfile, block: Block, monthIndex: number, rirShift: number, lastIsolationId: string | null, weeks: WeekPlan[]): TrainingExerciseEntry {
  const def = pe.def;
  const rx = prescribe({ e: def, role: pe.role, model: p.model, level: p.level, block, sets: pe.sets, rirShift, isMinor: p.isMinor, lastIsolation: def.id === lastIsolationId });
  const load = initialLoad({ e: def, profile: { bodyweightKg: p.bodyweightKg, sex: p.sex, level: p.level, age: p.age }, repsMax: rx.repsMax, rir: rx.rir, monthsIn: monthIndex - 1, calibrating: monthIndex === 1 });
  const restSec = pe.supersetWith ? Math.max(60, Math.round(rx.restSec * 0.75)) : rx.restSec;
  const technique = pe.supersetWith ? { kind: 'antagonistSuperset', label: 'Superset antagonista', how: 'Alterna una serie di questo esercizio e una dell’altro, recuperando tra una coppia e la successiva.' } : (rx.technique ?? undefined);
  // mesocycle → week → session → exercise: every week of the month carries its effective prescription
  const weekRx = weeks.map((w) => weekPrescription({ e: def, role: pe.role, base: { sets: pe.sets, reps: rx.reps, rir: rx.rir, restSec, kg: load.kg, technique: technique ?? null }, week: w }));
  return {
    id: def.id,
    name: def.name,
    sets: pe.sets,
    reps: rx.reps,
    repsMin: rx.repsMin,
    repsMax: rx.repsMax,
    rir: rx.rir,
    rpe: rx.rpe,
    restSec,
    tempo: rx.tempo,
    suggestedKg: load.kg,
    loadStatus: load.status,
    loadNote: load.note,
    loadIncrementKg: def.increment || undefined,
    role: pe.role,
    primaryMuscle: MUSCLE_LABEL[def.primary],
    primaryRegion: def.region,
    secondaryMuscles: def.secondary.map((g) => MUSCLE_SHORT[g]),
    muscleGroup: pe.group,
    sessionBlockId: pe.blockId,
    blockName: pe.blockName,
    blockOrder: pe.blockOrder,
    exerciseOrder: order,
    orderingReason: pe.orderingReason,
    cues: def.cues,
    progression: rx.progression,
    technique,
    supersetWith: pe.supersetWith,
    weeks: weekRx,
  };
}

export function generateTrainingPlan(input: TrainingPlanInput): TrainingPlan | null {
  const { ctx, durationMonths, strategy, preserveMonthsBefore, existingMonths, tuning } = input;
  const t = ctx.training;
  if (!t || (!t.gym && !t.running)) return null;

  const base = buildProgramProfile(ctx, null);
  const blocks = blockSequence(durationMonths, base.level, base.model);
  const months: TrainingMonthPlan[] = [];
  const reasons = new Set<string>([base.levelReason, base.modelReason]);
  const notices = new Set<string>(base.notes);
  let splitLabel = '';
  let prevVolumeFactor: number | null = null;
  let needsManualReview = false;

  for (let monthIndex = 1; monthIndex <= durationMonths; monthIndex++) {
    const block = blocks[monthIndex - 1];
    const calibActive = tuning?.training != null && monthIndex >= (tuning.fromMonth ?? 1);
    const calib: TrainingCalibration = calibActive ? tuning!.training! : {};
    const mb = monthBlock({ block, monthIndex, blocks, level: base.level, deloadFirstWeek: !!calib.deloadFirstWeek && monthIndex === (tuning?.fromMonth ?? 0), prevVolumeFactor });
    prevVolumeFactor = mb.volumeFactor;

    if (preserveMonthsBefore != null && monthIndex < preserveMonthsBefore) {
      const existing = existingMonths?.find((m) => m.monthIndex === monthIndex);
      if (existing) {
        months.push(existing);
        continue;
      }
    }

    const p = calibActive ? buildProgramProfile(ctx, calib) : base;
    const schedule = resolveSchedule(ctx, { availableDays: calib.availableDays });
    if (schedule.conflict) notices.add(schedule.conflict);
    const gymDays = schedule.gymSlots.length;
    const split = gymDays > 0 ? chooseSplit(p, gymDays, t.gym?.splitPreference ?? 'noPreference', calib.split) : null;
    if (split) {
      splitLabel = SPLIT_LABEL[split.kind];
      if (monthIndex === 1 || calibActive) reasons.add(split.reason);
    }

    // volume: base target × block factor × check-in adjustments
    // the time cap is computed on the planned volume; the check-in's volume decision is applied after it, so that a
    // decision to lower the volume can never raise a group the cap had squeezed (and vice versa)
    let targets = weeklyTargets(p, { volumeFactor: mb.volumeFactor, groupSets: calib.groupSets });
    // the time the person has caps the volume: scale every group down together rather than drop groups at random
    let timeCapped = false;
    if (gymDays > 0) {
      const avgRest = p.model === 'strength' ? 170 : p.model === 'muscularEndurance' ? 60 : 105;
      const capacity = gymDays * ((p.sessionMinutes - 8) / (setMinutes(avgRest) + 0.5));
      const needed = targets.reduce((sum, x) => sum + x.sets, 0) * 0.75; // direct sets ≈ ¾ of the fractional total
      if (needed > capacity) {
        const k = capacity / needed;
        timeCapped = true;
        // the large groups keep more of their volume; small groups already get indirect work from the compounds
        const PRIME = new Set(['chest', 'lats', 'upperBack', 'quads', 'hamstrings', 'glutes']);
        const primeSets = targets.filter((x) => PRIME.has(x.group)).reduce((a, x) => a + x.sets, 0);
        const otherSets = targets.reduce((a, x) => a + x.sets, 0) - primeSets;
        const kPrime = Math.min(1, k * 1.2);
        const kOther = otherSets > 0 ? Math.max(0.3, (k * (primeSets + otherSets) - kPrime * primeSets) / otherSets) : k;
        targets = targets.map((x) => {
          const f = PRIME.has(x.group) ? kPrime : kOther;
          return { ...x, sets: Math.max(2, Math.round(x.sets * f)), max: Math.max(3, Math.round(x.max * f)) };
        });
        if (monthIndex === 1) reasons.add(`Volume adattato al tempo disponibile: ${gymDays} sedute da circa ${p.sessionMinutes} minuti.`);
      }
    }
    const checkinVolume = calib.volumeFactor ?? 1;
    if (checkinVolume !== 1) {
      targets = targets.map((x) => {
        const floor = x.group === 'abs' || x.group === 'calves' ? 2 : 3;
        const sets = checkinVolume < 1 ? Math.max(Math.min(floor, x.sets), Math.round(x.sets * checkinVolume)) : timeCapped ? x.sets : Math.round(x.sets * checkinVolume);
        return { ...x, sets, min: Math.max(2, Math.round(sets * 0.7)), max: Math.max(3, Math.round(sets * 1.4)) };
      });
    }
    const rotation = Math.floor((monthIndex - 1) / 3);
    const rirShift = calib.rirShift ?? 0;
    const restFor = (def: CatalogExercise, role: Role) => prescribe({ e: def, role, model: p.model, level: p.level, block, sets: 3, rirShift: 0, isMinor: p.isMinor, lastIsolation: false }).restSec;
    const sessions: PlannedSession[] = [];
    if (split) {
      const perSession = perSessionTargets(split.sessions, targets);
      if (Object.values(calib.groupSets ?? {}).some((v) => (v ?? 0) > 0)) reasons.add('Specializzazione: i gruppi con volume extra aprono le sedute in cui compaiono.');
      const usedByTemplate = new Map<string, Set<string>>();
      // specialisation: groups given extra volume are trained first in the sessions that include them
      const priority = Object.entries(calib.groupSets ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([g]) => g);
      split.sessions.forEach((tpl0, i) => {
        const tpl = priority.length ? { ...tpl0, groups: [...tpl0.groups.filter((g) => priority.includes(g)), ...tpl0.groups.filter((g) => !priority.includes(g))] } : tpl0;
        const avoid = usedByTemplate.get(tpl.key) ?? new Set<string>();
        const s = buildSession({ template: tpl, perSessionTarget: perSession[i].target, perSessionMax: perSession[i].max, p, restFor, replaceIds: new Set(calib.replaceIds ?? []), avoidIds: avoid, rotation, specialized: new Set(priority as MuscleGroup[]) });
        // a template repeated in the week varies its accessories, never its main lift
        const nextAvoid = new Set(avoid);
        for (const x of s.exercises) if (x.role !== 'main') nextAvoid.add(x.def.id);
        usedByTemplate.set(tpl.key, nextAvoid);
        if (s.exercises.length === 0) needsManualReview = true;
        sessions.push(s);
      });
    }
    // ---- week-level passes (engine v4)
    // groups whose every compatible exercise loads a painful area: excluded, never compensated elsewhere
    const avail = (e: CatalogExercise) => e.equipment.every((x) => p.equipment.has(x));
    const programmed = new Set<MuscleGroup>(split ? split.sessions.flatMap((x) => x.groups) : []);
    const frozen = new Set<MuscleGroup>();
    // groups no exercise can train with the equipment the person has (e.g. lats without a bar or a band)
    const noEquipment = new Set<MuscleGroup>([...programmed].filter((g) => !CATALOG.some((e) => e.primary === g && avail(e))));
    const exclusions: NonNullable<TrainingMonthPlan['exclusions']> = [];
    for (const g of programmed) {
      const hit = CATALOG.filter((e) => e.primary === g && avail(e) && e.areas.some((a) => p.exclusions.areas.has(a)));
      if (!hit.length) continue;
      const areas = [...new Set(hit.flatMap((e) => e.areas.filter((a) => p.exclusions.areas.has(a))))].map((a) => AREA_LABEL[a] ?? a);
      const ok = CATALOG.some((e) => e.primary === g && avail(e) && !e.areas.some((a) => p.exclusions.areas.has(a)) && !(calib.replaceIds ?? []).includes(e.id));
      if (!ok) frozen.add(g);
      exclusions.push({ group: MUSCLE_LABEL[g], reason: ok ? `Esclusi gli esercizi che caricano: ${areas.join(', ')}. Restano varianti compatibili.` : `Nessuna variante compatibile con le zone indicate (${areas.join(', ')}): gruppo sospeso, il volume non viene spostato su altri gruppi.`, exercises: hit.map((e) => e.name) });
    }
    if (frozen.size >= 2 || p.exclusions.areas.size >= 2)
      notices.add('Il dolore che hai indicato limita diversi movimenti: fatti valutare da un medico o da un fisioterapista. La scheda non propone esercizi di recupero, non aumenta carichi o volume nelle zone interessate e non sposta il lavoro escluso su altri gruppi.');
    const weekNotes: string[] = [];
    if (sessions.length) {
      weekNotes.push(...ensureCoverage(sessions, p, restFor, new Set(calib.replaceIds ?? [])).notes);
      weekNotes.push(...balanceVolume(sessions, targets, p, restFor, frozen, new Set(calib.replaceIds ?? []), measureVolume).notes);
    }
    const coverage = sessions.length ? measureCoverage(sessions) : [];

    // repeated templates get A/B names when the exercises differ
    const nameCount = new Map<string, number>();
    for (const s of sessions) nameCount.set(s.template.name, (nameCount.get(s.template.name) ?? 0) + 1);
    const nameSeen = new Map<string, number>();

    const runs = t.running ? runWeek({ focus: t.running.focus, sessions: schedule.runSlots.length, monthIndex, consolidation: block === 'consolidamento', beginnerStart: p.level === 'beginner' }) : [];
    const days = [...schedule.gymSlots, ...schedule.runSlots].sort((a, b) => a - b);
    const { gymAt, runAt, compromises } = arrangeWeek(days, sessions.map((s) => ({ legDay: s.template.legDay })), runs);
    if (compromises.length && runs.length && sessions.length)
      notices.add(`Con ${days.length} giorni di allenamento tra forza e corsa non si riesce a evitare ${compromises.join(' e ')}: è la disposizione più sostenibile, con le sedute dure il più lontano possibile tra loro.`);

    const week: TrainingDayPlan[] = WEEKDAY_LABELS.map((weekday) => ({ weekday, type: 'rest', title: 'Riposo' }));
    sessions.forEach((s, i) => {
      const dayIdx = gymAt[i];
      const k = (nameSeen.get(s.template.name) ?? 0) + 1;
      nameSeen.set(s.template.name, k);
      const repeated = (nameCount.get(s.template.name) ?? 1) > 1 && !/ [AB]$/.test(s.template.name);
      const lastIso = [...s.exercises].reverse().find((x) => x.role === 'isolation')?.def.id ?? null;
      const exercises = s.exercises.map((x, order) => entryFor(x, order + 1, p, block, monthIndex, rirShift, lastIso, mb.weeks));
      const blockList = [...new Map(s.exercises.map((x) => [x.blockId, { id: x.blockId, name: x.blockName, order: x.blockOrder }])).values()];
      week[dayIdx] = {
        weekday: WEEKDAY_LABELS[dayIdx],
        type: 'workout',
        title: repeated ? `${s.template.name} ${k === 1 ? '1' : '2'}` : s.template.name,
        exercises,
        focus: s.template.focus,
        muscleGroups: [...new Set(s.exercises.map((x) => MUSCLE_SHORT[x.group]))],
        blocks: blockList,
        estimatedMinutes: s.estimatedMinutes,
        notes: s.notes.length ? s.notes : undefined,
      };
    });
    runs.forEach((r, i) => {
      const dayIdx = runAt[i];
      week[dayIdx] = {
        weekday: WEEKDAY_LABELS[dayIdx],
        type: 'cardio',
        title: r.title,
        note: r.note,
        estimatedMinutes: r.minutes,
        run: {
          kind: r.kind,
          minutes: r.minutes,
          intensity: r.intensity,
          structure: r.structure,
          progression: r.progression,
          weeks: mb.weeks.map((w) => ({ week: w.week, minutes: w.runFactor === 1 ? r.minutes : Math.max(15, Math.round((r.minutes * w.runFactor) / 5) * 5), ...(w.runFactor < 1 ? { note: w.deload ? 'Settimana di scarico: corsa più breve e tutta facile.' : 'Settimana di recupero: durata ridotta, stesso ritmo.' } : {}) })),
        },
      };
    });

    const volume = measureVolume(sessions.map((s) => ({ exercises: s.exercises.map((x) => ({ id: x.def.id, sets: x.sets })) })), targets);
    const monthlyFocus = strategy?.monthlyFocus?.find((m) => m.monthIndex === monthIndex);
    months.push({
      monthIndex,
      phase: coarsePhase(block),
      block,
      title: monthlyFocus?.title ?? `Mese ${monthIndex} · ${BLOCK_LABEL[block]}`,
      focusNote: monthlyFocus?.focusNote ?? mb.goal,
      weeklySplit: week,
      mesocycle: {
        goal: mb.goal,
        progression: timeCapped && (calib.volumeFactor ?? 1) > 1 ? `${mb.progression} Il volume è già al limite del tempo disponibile: l’aumento deciso al check-in non entra nelle sedute.` : mb.progression,
        exitCriteria: mb.exitCriteria,
        weeks: mb.weeks.map((w) => ({
          week: w.week,
          label: w.label,
          rirOffset: w.rirOffset,
          setsFactor: w.setsFactor,
          note: w.note,
          ...(w.deload ? { deload: true } : {}),
          ...(w.conditional ? { conditional: true } : {}),
          sets: week.reduce((sum, d) => sum + (d.exercises ?? []).reduce((a, x) => a + (x.weeks?.find((y) => y.week === w.week)?.sets ?? x.sets), 0), 0),
        })),
      },
      timeCapped: timeCapped || undefined,
      weeklyVolume: volume
        .filter((v) => v.target > 0 || v.direct > 0)
        .map((v) => {
          // over only when the DIRECT work exceeds the target: indirect volume from the compounds is expected
          // (squats train the glutes, presses the triceps) and is shown, not "corrected" by removing those lifts
          const status =
            frozen.has(v.group) || (noEquipment.has(v.group) && v.direct === 0)
              ? 'excluded'
              : v.target > 0 && v.fractional < v.target * 0.75
                ? 'under'
                : v.target > 0 && v.direct > Math.max(v.target * 1.3 + 1, v.target + 2)
                  ? 'over'
                  : 'ok';
          const reason =
            status === 'excluded'
              ? frozen.has(v.group)
                ? 'Escluso per dolore: nessuna variante compatibile.'
                : 'Nessun esercizio possibile con l’attrezzatura indicata.'
              : status === 'under'
                ? timeCapped
                  ? 'Sotto obiettivo: il tempo disponibile non basta.'
                  : 'Sotto obiettivo.'
                : status === 'over'
                  ? 'Serie dirette sopra obiettivo.'
                  : v.target > 0 && v.fractional > v.target * 1.35 + 1
                    ? v.fractional - v.direct > v.direct * 0.5
                      ? 'Sopra obiettivo per il lavoro indiretto dei multiarticolari (serie dirette nella norma).'
                      : 'Appena sopra obiettivo: è il minimo di serie per gli esercizi della settimana.'
                    : undefined;
          return { group: v.group, label: MUSCLE_LABEL[v.group], direct: v.direct, indirect: v.indirect, fractional: Math.round(v.fractional * 10) / 10, frequency: v.frequency, target: v.target, status, ...(reason ? { reason } : {}) };
        }),
      patternCoverage: coverage.map((c) => ({ ...c, ...(c.status !== 'full' ? { note: weekNotes.find((n) => n.startsWith(PATTERN_TITLE[c.pattern])) } : {}) })),
      exclusions: exclusions.length ? exclusions : undefined,
    });
    const built = months[months.length - 1];
    built.validation = validateMonth(built, ctx, { profile: p, splitKind: split?.kind ?? null, hybrid: !!t.running && !!t.gym });
    for (const n of weekNotes) if (/nessun esercizio|solo in modo parziale|non c’è spazio/.test(n)) notices.add(n);
  }

  const plan: TrainingPlan = {
    generatedAt: new Date().toISOString(),
    durationMonths,
    months,
    needsManualReview,
    engine: TRAINING_ENGINE_VERSION,
    rationale: {
      level: `${LEVEL_LABEL[base.level]}`,
      model: MODEL_LABEL[base.model],
      split: splitLabel || (t.running ? 'Solo corsa' : ''),
      reasons: [...reasons],
      notices: [...notices],
    },
  };
  const issues = validateTrainingPlan(plan, ctx);
  if (issues.length) {
    plan.needsManualReview = true;
    plan.rationale!.notices.push(...issues.map((i) => i.message));
  }
  return plan;
}

/** Month 1's week for a context, used to size energy targets before the full plan exists. */
export function provisionalTrainingWeek(ctx: UserContext): TrainingDayPlan[] | null {
  const plan = generateTrainingPlan({ ctx, durationMonths: 4 });
  return plan?.months[0].weeklySplit ?? null;
}
