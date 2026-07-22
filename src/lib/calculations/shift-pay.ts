import type { DayOfWeekType, RoomDetail } from "@/lib/types/database.types";

// Mirrors supabase/migrations/0006_hotel_shifts.sql compute_hotel_shift_pay()
// and 0007_secondary_shifts.sql compute_secondary_shift_pay() exactly. These
// exist purely so the UI can show a pay estimate instantly (optimistic
// updates, live "as you type" totals) — the database trigger is the actual
// source of truth and always recomputes on write, so drift here can never
// corrupt stored data, only make the client's estimate stale for a moment.

export function dayOfWeekFromDate(dateISO: string): DayOfWeekType {
  const day = new Date(`${dateISO}T00:00:00`).getDay();
  if (day === 0) return "SUNDAY";
  if (day === 6) return "SATURDAY";
  return "WEEKDAY";
}

export function hotelBaseRate(dayOfWeek: DayOfWeekType): number {
  switch (dayOfWeek) {
    case "SUNDAY":
      return 38.0;
    case "SATURDAY":
      return 32.0;
    default:
      return 25.0;
  }
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateHotelShiftPay(dateISO: string, totalCredits: number) {
  const dayOfWeek = dayOfWeekFromDate(dateISO);
  const baseHourlyRate = hotelBaseRate(dayOfWeek);
  const calculatedPay = roundCurrency((totalCredits / 2) * baseHourlyRate);
  return { dayOfWeek, baseHourlyRate, calculatedPay };
}

export function sumRoomCredits(rooms: RoomDetail[]): number {
  return roundCurrency(rooms.reduce((total, room) => total + room.credits, 0));
}

export const SECONDARY_SHIFT_DEFAULT_HOURS = 2.0;
export const SECONDARY_SHIFT_DEFAULT_RATE = 25.0;

export function calculateSecondaryShiftPay(
  hoursWorked: number,
  hourlyRate: number
) {
  return roundCurrency(hoursWorked * hourlyRate);
}
