export type RangeKey = "week" | "month" | "6months" | "year" | "custom";

export const RANGE_LABEL: Record<RangeKey, string> = {
  week: "Week",
  month: "Month",
  "6months": "6 months",
  year: "Year",
  custom: "Custom",
};

export const RANGE_ORDER: RangeKey[] = ["week", "month", "6months", "year", "custom"];

export type DateRange = { from: Date; to: Date };

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

// Weeks run Monday..Sunday. Sunday is day 0, so it belongs to the week that
// began six days earlier, not to the one starting the next day — getting
// this backwards is the classic off-by-one that orphans Mon-Sat.
function startOfWeek(d: Date): Date {
  const date = startOfDay(d);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

// All bounds are computed in the *viewer's* local timezone and sent to
// Postgres as absolute instants. Deriving them server-side from a bare date
// would use the database's zone instead and misfile transactions made near
// midnight on the first or last day of the range.
export function resolveRange(
  key: RangeKey,
  now = new Date(),
  customFrom?: string,
  customTo?: string
): DateRange {
  switch (key) {
    case "week":
      return { from: startOfWeek(now), to: endOfDay(now) };
    case "month":
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      };
    case "6months": {
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "year":
      return {
        from: startOfDay(new Date(now.getFullYear(), 0, 1)),
        to: endOfDay(now),
      };
    case "custom": {
      // Fall back to the current month if either bound is missing or
      // unparseable, so a hand-edited URL can't produce an empty dashboard.
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
      const to = customTo ? new Date(`${customTo}T00:00:00`) : null;
      if (!from || !to || Number.isNaN(+from) || Number.isNaN(+to)) {
        return resolveRange("month", now);
      }
      // Tolerate reversed bounds rather than returning nothing.
      return from <= to
        ? { from: startOfDay(from), to: endOfDay(to) }
        : { from: startOfDay(to), to: endOfDay(from) };
    }
  }
}

export function formatRangeLabel(range: DateRange): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}
