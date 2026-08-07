// Assertion self-check for the pure logic that decides what money is shown
// and where it lands. No test framework on purpose — this runs with the tsx
// already used by the other scripts (`npm run check`).
//
// Only covers logic that is (a) pure and (b) genuinely gets things wrong if
// broken: period bucketing, LIKE escaping, currency grouping, pay rounding,
// and transfer labelling. Database behavior (triggers, RPCs, RLS) is not
// mocked here — it's verified against a real Supabase project instead.
import assert from "node:assert/strict";

import { resolveRange } from "../src/lib/dashboard";
import { escapeLikePattern } from "../src/lib/wallet/search";
import { formatCurrency } from "../src/lib/format";
import { calculateShiftPay, roundCurrency } from "../src/lib/calculations/job-pay";
import { transferLabels } from "../src/lib/wallet/create-transaction";
import {
  transactionCursorSchema,
  transactionFiltersSchema,
} from "../src/lib/wallet/transaction-query";

let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`  ✓ ${name}`);
}

console.log("\nresolveRange — weeks run Monday..Sunday, months are calendar months");

// Guard the fixtures themselves: if these stop being the weekdays the cases
// below assume, fail loudly rather than pass for the wrong reason.
const sunday = new Date("2026-08-02T12:00:00");
const nextMonday = new Date("2026-08-03T12:00:00");
const lateJuly = new Date("2026-07-30T12:00:00");
assert.equal(sunday.getDay(), 0, "fixture 2026-08-02 should be a Sunday");
assert.equal(nextMonday.getDay(), 1, "fixture 2026-08-03 should be a Monday");

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

check("Sunday still belongs to the week that began the preceding Monday", () => {
  // The classic off-by-one: a naive getDay() week-start rolls over on Sunday
  // and orphans Mon-Sat from their own week.
  assert.equal(ymd(resolveRange("week", sunday).from), "2026-07-27");
});

check("a new week starts on Monday", () => {
  assert.equal(ymd(resolveRange("week", nextMonday).from), "2026-08-03");
});

check("month starts on the 1st, not 30 days back", () => {
  assert.equal(ymd(resolveRange("month", lateJuly).from), "2026-07-01");
});

check("6 months spans five whole months plus the current one", () => {
  assert.equal(ymd(resolveRange("6months", lateJuly).from), "2026-02-01");
});

check("year starts on Jan 1 of the current year", () => {
  assert.equal(ymd(resolveRange("year", lateJuly).from), "2026-01-01");
});

check("ranges end at the very end of the closing day", () => {
  const to = resolveRange("month", lateJuly).to;
  assert.equal(ymd(to), "2026-07-30");
  assert.equal(to.getHours(), 23);
  assert.equal(to.getMinutes(), 59);
});

check("custom bounds are honoured, and reversed bounds are swapped", () => {
  const normal = resolveRange("custom", lateJuly, "2026-03-05", "2026-04-10");
  assert.equal(ymd(normal.from), "2026-03-05");
  assert.equal(ymd(normal.to), "2026-04-10");

  const reversed = resolveRange("custom", lateJuly, "2026-04-10", "2026-03-05");
  assert.equal(ymd(reversed.from), "2026-03-05");
  assert.equal(ymd(reversed.to), "2026-04-10");
});

check("a broken custom range falls back to the current month, never empty", () => {
  assert.equal(ymd(resolveRange("custom", lateJuly, "nonsense", "").from), "2026-07-01");
  assert.equal(ymd(resolveRange("custom", lateJuly).from), "2026-07-01");
});

console.log("\nescapeLikePattern — search input is data, not wildcards");

check("LIKE wildcards are escaped so they match literally", () => {
  assert.equal(escapeLikePattern("50%"), "50\\%");
  assert.equal(escapeLikePattern("Shop_A"), "Shop\\_A");
});

check("backslash is escaped first so it can't eat the other escapes", () => {
  assert.equal(escapeLikePattern("a\\b"), "a\\\\b");
  assert.equal(escapeLikePattern("\\%"), "\\\\\\%");
});

check("ordinary text is untouched", () => {
  assert.equal(escapeLikePattern("Coffee"), "Coffee");
});

console.log("\nformatCurrency — NPR groups lakh/crore, others stay Western");

// Intl separates the NPR symbol from the amount with U+00A0 (a non-breaking
// space), not a plain one — deliberate, so "Rs" can never wrap onto a
// different line from the number. Spelled out here because the difference is
// invisible in a diff and would otherwise look like a mystery failure.
const NBSP = " ";

check("NPR uses 2-digit grouping above the thousand", () => {
  assert.equal(formatCurrency(1234567.5, "NPR"), `Rs${NBSP}12,34,567.50`);
});

check("non-NPR currencies keep 3-digit grouping", () => {
  assert.equal(formatCurrency(1234567.5, "AUD"), "$1,234,567.50");
});

check("both always show exactly two decimal places", () => {
  assert.equal(formatCurrency(0, "NPR"), `Rs${NBSP}0.00`);
  assert.equal(formatCurrency(5, "AUD"), "$5.00");
});

check("negatives keep the sign outside the symbol", () => {
  assert.equal(formatCurrency(-1500, "NPR"), `-Rs${NBSP}1,500.00`);
});

console.log("\ncalculateShiftPay — mirrors the DB trigger's rounding");

check("pay rounds to whole cents", () => {
  assert.equal(calculateShiftPay(3, 25), 75);
  // 2.35 * 33.33 = 78.3255 -> must not leak float noise into a money value
  assert.equal(calculateShiftPay(2.35, 33.33), 78.33);
});

check("roundCurrency never returns more than 2dp", () => {
  assert.equal(roundCurrency(0.1 + 0.2), 0.3);
});

console.log("\ntransferLabels — bank/cash moves read as withdrawal or deposit");

check("BANK -> CASH is a withdrawal, CASH -> BANK is a deposit", () => {
  assert.equal(transferLabels("BANK", "CASH").out, "Cash Withdrawal");
  assert.equal(transferLabels("CASH", "BANK").out, "Cash Deposit");
});

check("everything else stays a plain transfer", () => {
  assert.equal(transferLabels("BANK", "BANK").out, "Transfer out");
  assert.equal(transferLabels("DIGITAL_WALLET", "BANK").in, "Transfer in");
});


console.log("\ntransaction filters/cursor — client input is validated, not trusted");

check("a crafted cursor that breaks out of the filter string is rejected", () => {
  // Server Action arguments are attacker-controlled; these land inside an
  // interpolated PostgREST `.or(...)` predicate.
  assert.equal(
    transactionCursorSchema.safeParse({
      date: '2026-01-01T00:00:00Z",id.gt."0',
      id: "00000000-0000-0000-0000-000000000000",
    }).success,
    false
  );
  assert.equal(
    transactionCursorSchema.safeParse({
      date: "2026-01-01T00:00:00Z",
      id: "not-a-uuid",
    }).success,
    false
  );
});

check("a well-formed cursor still passes", () => {
  assert.equal(
    transactionCursorSchema.safeParse({
      date: "2026-07-30T04:32:56.570584+00:00",
      id: "d4f55656-9f39-492d-9134-8157ab00f501",
    }).success,
    true
  );
});

check("filters reject unknown keys and non-numeric amounts", () => {
  assert.equal(transactionFiltersSchema.safeParse({ bogus: 1 }).success, false);
  assert.equal(transactionFiltersSchema.safeParse({ min: "5 or 1=1" }).success, false);
  assert.equal(transactionFiltersSchema.safeParse({ category: "DROP" }).success, false);
  assert.equal(transactionFiltersSchema.safeParse({ min: 5, q: "coffee" }).success, true);
});

console.log(`\n${checks} checks passed.\n`);
