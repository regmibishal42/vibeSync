export type Period = "week" | "month";

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Week = current ISO week (Mon-Sun), month = current calendar month — same
// "which bucket is today in" semantics as the rest of the app's `isThisMonth`
// checks (wallet, work), just also offering the shorter bucket.
export function isInPeriod(dateISO: string, period: Period, now = new Date()): boolean {
  const d = new Date(dateISO);
  if (period === "month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return d >= weekStart && d < weekEnd;
}
