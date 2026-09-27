/**
 * Maps calendar time onto the generated plan's months: the plan's N months
 * are all pre-computed for determinism, but the UI only ever exposes the
 * "current" one as active — the rest stay greyed out/locked, unlocking one
 * at a time as real time passes (see diet-plan.tsx / training-plan.tsx).
 */
export function currentMonthIndex(plan: { generatedAt: string; durationMonths: number }): number {
  const daysSinceStart = (Date.now() - new Date(plan.generatedAt).getTime()) / 86_400_000;
  const idx = 1 + Math.floor(daysSinceStart / 30);
  return Math.min(Math.max(idx, 1), plan.durationMonths);
}

/** How far the user has progressed through the *current* month, so the
 * plan card can show a live "day X of 30" rather than just the month name. */
export function currentMonthProgress(plan: { generatedAt: string; durationMonths: number }): {
  dayInMonth: number;
  fraction: number;
} {
  const daysSinceStart = (Date.now() - new Date(plan.generatedAt).getTime()) / 86_400_000;
  const monthIndex = currentMonthIndex(plan);
  const isFinalMonth = monthIndex === plan.durationMonths;
  const daysIntoMonth = daysSinceStart - (monthIndex - 1) * 30;
  const clampedDays = isFinalMonth ? Math.min(daysIntoMonth, 30) : daysIntoMonth;
  return {
    dayInMonth: Math.min(30, Math.max(1, Math.floor(clampedDays) + 1)),
    fraction: Math.min(1, Math.max(0, clampedDays / 30)),
  };
}

/** Splits the current 30-day month into 4 nominal 7-day weeks (the last one
 * running a couple of days long) so the training/plan cards can show a
 * "Settimana 1..4" timeline with real calendar date ranges, alongside the
 * existing day-granularity progress above. */
export function currentMonthWeeks(plan: {
  generatedAt: string;
  durationMonths: number;
}): { weekNumber: number; startISO: string; endISO: string; isCurrent: boolean }[] {
  const monthIndex = currentMonthIndex(plan);
  const monthStart = new Date(plan.generatedAt);
  monthStart.setHours(12, 0, 0, 0);
  monthStart.setDate(monthStart.getDate() + (monthIndex - 1) * 30);
  const { dayInMonth } = currentMonthProgress(plan);
  const currentWeekNumber = Math.min(4, Math.floor((dayInMonth - 1) / 7) + 1);

  return Array.from({ length: 4 }, (_, i) => {
    const weekNumber = i + 1;
    const start = new Date(monthStart);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + (weekNumber === 4 ? 8 : 6));
    return {
      weekNumber,
      startISO: start.toISOString().slice(0, 10),
      endISO: end.toISOString().slice(0, 10),
      isCurrent: weekNumber === currentWeekNumber,
    };
  });
}

/** Same "day X of 30" progress, but for whichever month the user is
 * currently browsing in the plan detail screens (training-plan.tsx /
 * diet-plan.tsx) rather than always the live current one — already-
 * completed months read as fully done, months not reached yet as untouched. */
export function monthProgress(
  plan: { generatedAt: string; durationMonths: number },
  monthIndex: number
): { dayInMonth: number; fraction: number } {
  const current = currentMonthIndex(plan);
  if (monthIndex < current) return { dayInMonth: 30, fraction: 1 };
  if (monthIndex > current) return { dayInMonth: 0, fraction: 0 };
  return currentMonthProgress(plan);
}
