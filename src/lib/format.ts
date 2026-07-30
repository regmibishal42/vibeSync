// `date.toISOString().slice(0, 10)` reads the UTC calendar date, not the
// browser's local one — for a user ahead of UTC (e.g. Australia,
// UTC+10/+11), anything logged before local mid-morning silently dates
// itself "yesterday". This composes the date from local getters instead.
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayLocalISO(): string {
  return toLocalDateKey(new Date());
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

// NPR groups digits lakh/crore-style (12,34,567 — thousands, then every 2
// digits), not the Western every-3-digits grouping (1,234,567) every other
// currency here uses. Same plain 0-9 digits either way (not Devanagari) —
// only the locale's grouping rule changes, so `en-IN` is the right choice
// over `ne-NP` (which would also switch the numerals themselves).
function localeForCurrency(currency: string): string {
  return currency === "NPR" ? "en-IN" : "en-US";
}

export function formatCurrency(amount: number, currency: string): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(localeForCurrency(currency), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
