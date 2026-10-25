/**
 * Reading a day's calorie balance against its goal.
 *
 * Inputs are the numbers FitLab already computes elsewhere and are never
 * recalculated here: intake is the sum of the day's logged meals, burned is
 * `dayEnergy(...).total` (domain/energy.ts), and the goal is the daily share
 * of the weekly goal (`weeklyGoalKcal / 7`, hooks/use-weekly-energy.ts) —
 * planned intake minus planned expenditure, which already carries the
 * training-day / rest-day difference, since each weekday contributes its own
 * intake target and its own planned session.
 *
 * Sign convention, the same one Home has always used: balance = intake −
 * burned, so a negative balance is a deficit and a negative goal is a
 * deficit goal.
 */

/** Tuning for how a balance is read and drawn. Every threshold lives here. */
export const BALANCE_SCALE = {
  /**
   * Within this many kcal of a value counts as "on" it: of equilibrium (the
   * day reads "in pari") and of a maintenance goal (reached).
   */
  toleranceKcal: 50,
  /** The displayed range is never narrower than ±this, so a maintenance goal still has room to show a drift. */
  minHalfRangeKcal: 600,
  /** …and otherwise extends to this many times the goal, so the goal sits halfway between equilibrium and the end. */
  goalRangeFactor: 2,
  /** The range is rounded up to a multiple of this, so its ends are round numbers. */
  rangeStepKcal: 100,
} as const;

export type BalanceStatus =
  /** No intake logged yet (or no expenditure estimate): any balance would describe an empty day, not a choice. */
  | 'missing'
  | 'deficit'
  | 'surplus'
  /** Within tolerance of zero. */
  | 'even';

export type GoalKind = 'deficit' | 'surplus' | 'maintenance';

export type BalanceReading = {
  balanceKcal: number;
  goalKcal: number;
  status: BalanceStatus;
  goalKind: GoalKind;
  /**
   * How far the day has travelled from equilibrium toward the goal: 0 at
   * equilibrium, 1 at the goal, above 1 past it. Negative when the balance
   * sits on the other side of equilibrium from the goal. For a maintenance
   * goal, 1 inside the tolerance and falling toward 0 at the range's end.
   */
  progress: number;
  /** At or past the goal (within tolerance for maintenance). Never true for a missing day. */
  reached: boolean;
  /** On the goal's side of equilibrium. For maintenance: anything short of a surplus beyond tolerance. */
  towardGoal: boolean;
  /** Symmetric display range around equilibrium, ±kcal. */
  halfRangeKcal: number;
};

export function calorieBalance(eatenKcal: number, burnedKcal: number): number {
  return eatenKcal - burnedKcal;
}

/** The symmetric ±kcal range a balance is displayed over, for a given goal. */
export function balanceHalfRange(goalKcal: number): number {
  const { minHalfRangeKcal, goalRangeFactor, rangeStepKcal } = BALANCE_SCALE;
  const wanted = Math.max(minHalfRangeKcal, Math.abs(goalKcal) * goalRangeFactor);
  return Math.ceil(wanted / rangeStepKcal) * rangeStepKcal;
}

/** Which side of equilibrium a balance falls on, `toleranceKcal` counting as "even". */
export function balanceSide(balanceKcal: number, toleranceKcal: number = BALANCE_SCALE.toleranceKcal): Exclude<BalanceStatus, 'missing'> {
  return Math.abs(balanceKcal) <= toleranceKcal ? 'even' : balanceKcal < 0 ? 'deficit' : 'surplus';
}

export function readBalance({
  eatenKcal,
  burnedKcal,
  goalKcal,
  toleranceKcal = BALANCE_SCALE.toleranceKcal,
}: {
  eatenKcal: number;
  burnedKcal: number;
  goalKcal: number;
  /** Override of BALANCE_SCALE.toleranceKcal (the explanatory carousel lets it be tuned); Home never passes it. */
  toleranceKcal?: number;
}): BalanceReading {
  const balanceKcal = calorieBalance(eatenKcal, burnedKcal);
  const halfRangeKcal = balanceHalfRange(goalKcal);
  const goalKind: GoalKind = goalKcal < -toleranceKcal ? 'deficit' : goalKcal > toleranceKcal ? 'surplus' : 'maintenance';
  const missing = eatenKcal <= 0 || burnedKcal <= 0;

  const status: BalanceStatus = missing ? 'missing' : balanceSide(balanceKcal, toleranceKcal);

  let progress: number;
  let towardGoal: boolean;
  let reached: boolean;
  if (goalKind === 'maintenance') {
    // Closeness rather than distance travelled: the goal is equilibrium
    // itself. Drifting into a deficit fades the green; drifting into a
    // surplus is a surplus, and takes the surplus scale like any other.
    const off = Math.abs(balanceKcal - goalKcal);
    progress = off <= toleranceKcal ? 1 : Math.max(0, 1 - off / halfRangeKcal);
    towardGoal = balanceKcal <= goalKcal + toleranceKcal;
    reached = off <= toleranceKcal;
  } else {
    // Equilibrium is 0, the goal is 1 — so a balance of zero is NOT the goal
    // of a deficit plan, only the starting point on the way to it.
    progress = balanceKcal / goalKcal;
    towardGoal = progress >= 0 || Math.abs(balanceKcal) <= toleranceKcal;
    reached = progress >= 1 || Math.abs(balanceKcal - goalKcal) <= toleranceKcal;
  }

  if (missing) return { balanceKcal, goalKcal, status, goalKind, progress: 0, reached: false, towardGoal: true, halfRangeKcal };
  return { balanceKcal, goalKcal, status, goalKind, progress, reached, towardGoal, halfRangeKcal };
}

/**
 * Where a balance sits on the display range, normalised to −1…1, with
 * deficit to the right (+) and surplus to the left (−), equilibrium at 0.
 * `clamped` is true when the real value lies past the end of the range — the
 * marker then rests on the end while the number still shows the real value.
 */
export function balancePosition(balanceKcal: number, halfRangeKcal: number): { position: number; clamped: boolean } {
  const raw = -balanceKcal / halfRangeKcal;
  return { position: Math.max(-1, Math.min(1, raw)), clamped: Math.abs(raw) > 1 };
}

/** The short word under the gauge's number: what the day's reading amounts to. */
export function balanceCaption(reading: BalanceReading): string {
  if (reading.status === 'missing') return 'nessun pasto';
  if (reading.reached && reading.goalKind !== 'maintenance') return 'obiettivo raggiunto';
  if (reading.status === 'even') return 'in pari';
  return reading.status === 'deficit' ? 'in deficit' : 'in surplus';
}

/** The grey word under the gauge's goal: which side of equilibrium the day is on. */
export function balanceSideLabel(reading: BalanceReading): string {
  if (reading.status === 'missing') return 'nessun pasto';
  return reading.status === 'even' ? 'equilibrio' : reading.status;
}
