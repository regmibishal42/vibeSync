// Mirrors supabase/migrations/0006_jobs.sql compute_job_shift_pay() exactly.
// Exists purely so the UI can show a pay estimate instantly (optimistic
// updates, live "as you type" totals) — the database trigger is the actual
// source of truth and always recomputes on write, so drift here can never
// corrupt stored data, only make the client's estimate stale for a moment.

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateShiftPay(hoursWorked: number, hourlyRate: number): number {
  return roundCurrency(hoursWorked * hourlyRate);
}
