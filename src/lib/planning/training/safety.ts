/**
 * Safety engine: checks a built plan against the person's constraints. The
 * planner is designed not to produce these problems; this is the independent
 * last line (and what the test harness asserts on). It never diagnoses: on
 * reported pain it removes load from the area and suggests a professional.
 */
import type { UserContext } from '@/domain/user-context';

import type { TrainingPlan } from '../types';
import { CATALOG_BY_ID } from './catalog';
import { buildProgramProfile } from './profile';

export type SafetyIssue = { code: string; month: number; message: string };

const MAX_WEEKLY_PER_GROUP = { beginner: 14, intermediate: 22, advanced: 26 } as const;

export function validateTrainingPlan(plan: TrainingPlan, ctx: UserContext): SafetyIssue[] {
  if (!ctx.training) return [];
  const issues: SafetyIssue[] = [];
  const calib = plan.calibration?.training ?? null;
  for (const m of plan.months) {
    const active = calib && m.monthIndex >= (calib.fromMonth ?? 1) ? calib : null;
    const p = buildProgramProfile(ctx, active);
    for (const d of m.weeklySplit) {
      if (d.type !== 'workout') continue;
      for (const x of d.exercises ?? []) {
        const def = CATALOG_BY_ID.get(x.id);
        if (!def) continue;
        const missing = def.equipment.filter((e) => !p.equipment.has(e));
        if (missing.length) issues.push({ code: 'S1', month: m.monthIndex, message: `${x.name}: richiede attrezzatura non disponibile (${missing.join(', ')}).` });
        const hit = def.areas.filter((a) => p.exclusions.areas.has(a));
        if (hit.length) issues.push({ code: 'S2', month: m.monthIndex, message: `${x.name}: carica una zona indicata come dolorante.` });
        if (x.rir === 0 && (p.level === 'beginner' || p.isMinor || def.kind === 'compound')) issues.push({ code: 'S3', month: m.monthIndex, message: `${x.name}: cedimento non adatto a questo esercizio o livello.` });
        if (x.sets < 1 || x.sets > 6) issues.push({ code: 'S4', month: m.monthIndex, message: `${x.name}: ${x.sets} serie.` });
      }
      if (d.estimatedMinutes && d.estimatedMinutes > p.sessionMinutes + 10) issues.push({ code: 'S5', month: m.monthIndex, message: `${d.weekday}: seduta stimata ${d.estimatedMinutes} minuti, oltre il tempo disponibile.` });
    }
    for (const v of m.weeklyVolume ?? []) {
      if (v.direct > MAX_WEEKLY_PER_GROUP[p.level]) issues.push({ code: 'S6', month: m.monthIndex, message: `${v.label}: ${v.direct} serie dirette a settimana, troppe per il livello.` });
    }
  }
  return issues;
}
