export function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function daysAgoISO(n: number): string {
  return daysAgo(n).toISOString().slice(0, 10);
}

export function formatShortDay(iso: string, locale = 'it-IT'): string {
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short' });
}

export function formatDayMonth(iso: string, locale = 'it-IT'): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function isToday(iso: string): boolean {
  return iso === daysAgoISO(0);
}

/** 0 = Monday ... 6 = Sunday (Italian week convention). */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Same as mondayIndex for an ISO date string ("2026-10-07"). ISO dates parse as UTC midnight, so the weekday is read in UTC —
 * `new Date(iso).getDay()` is wrong by a day for anyone west of Greenwich. */
export function isoMondayIndex(iso: string): number {
  return (new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - mondayIndex(d));
  return d;
}

/** The 7 ISO dates (Mon..Sun) of the week containing `date`. */
export function currentWeekDates(date: Date = new Date()): string[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function weekdayShort(iso: string, locale = 'it-IT'): string {
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
}

export function dayOfMonth(iso: string): number {
  return new Date(iso).getDate();
}

export function addDaysISO(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function formatFullDay(iso: string, locale = 'it-IT'): string {
  return new Date(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function monthShortLabel(year: number, monthIndex0: number, locale = 'it-IT'): string {
  const label = new Date(year, monthIndex0, 1).toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "1-30 settembre" / "29 settembre - 3 ottobre" / "14 settembre" — used by
 * any chart caption that needs to say which day-granularity slice is
 * currently in view. */
export function formatDayRange(startISO: string, endISO: string, locale = 'it-IT'): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const month = (d: Date) => d.toLocaleDateString(locale, { month: 'long' });

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return start.getDate() === end.getDate() ? `${start.getDate()} ${month(start)}` : `${start.getDate()}-${end.getDate()} ${month(start)}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${month(start)} - ${end.getDate()} ${month(end)}`;
  }
  return `${start.getDate()} ${month(start)} ${start.getFullYear()} - ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
}
