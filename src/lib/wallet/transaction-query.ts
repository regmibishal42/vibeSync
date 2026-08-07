import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { escapeLikePattern } from "@/lib/wallet/search";
import { CATEGORY_ORDER } from "@/lib/wallet/categories";
import type {
  Database,
  ExpenseCategory,
  TransactionType,
} from "@/lib/types/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export type TransactionFilters = {
  category?: ExpenseCategory;
  type?: TransactionType;
  accountId?: string;
  from?: string;
  to?: string;
  q?: string;
  min?: number;
  max?: number;
};

// Keyset cursor. Paging on transaction_date alone isn't stable — several
// transactions routinely share a timestamp (a transfer writes both legs at
// once, and quick-add stamps whole days) — so id is carried as the
// tiebreaker and both are compared together.
export type TransactionCursor = { date: string; id: string };

export type TransactionPage = {
  items: Transaction[];
  nextCursor: TransactionCursor | null;
};

export const TRANSACTIONS_PAGE_SIZE = 25;

// Server Action arguments arrive from the client and TypeScript types are
// erased at runtime, so `filters` and `cursor` are attacker-controlled. Both
// end up inside `.or(...)` filter strings below, which are assembled by
// string interpolation — unvalidated, a crafted cursor could break out of the
// intended predicate and reshape the query. RLS still confines every row to
// the signed-in user, so this was never cross-user exposure, but the query
// itself has to be trustworthy. Anything that doesn't parse is dropped.
const TRANSACTION_TYPES = [
  "EXPENSE",
  "DEPOSIT",
  "TRANSFER",
  "LOAN",
  "REPAYMENT",
] as const;

const isoDate = z.string().max(40).regex(/^[0-9T:.+\-Z ]+$/);

export const transactionFiltersSchema = z
  .object({
    category: z.enum(CATEGORY_ORDER as [ExpenseCategory, ...ExpenseCategory[]]).optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    accountId: z.string().uuid().optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    q: z.string().max(200).optional(),
    min: z.number().finite().nonnegative().optional(),
    max: z.number().finite().nonnegative().optional(),
  })
  .strict();

export const transactionCursorSchema = z
  .object({ date: isoDate, id: z.string().uuid() })
  .strict();

export function hasActiveFilters(f: TransactionFilters): boolean {
  return Boolean(
    f.category || f.type || f.accountId || f.from || f.to || f.q ||
    f.min !== undefined || f.max !== undefined
  );
}

// One page of the ledger, newest first. Used by both the cached first page
// and the load-more Server Action so the two can never disagree about what
// a filter means or how rows are ordered.
//
// Offset paging was the obvious alternative but is wrong here: adding a
// transaction prepends a row, which shifts every later offset by one and
// makes "load more" repeat an entry the user has already seen.
export async function fetchTransactionPage(
  supabase: SupabaseClient<Database>,
  filters: TransactionFilters = {},
  cursor?: TransactionCursor | null
): Promise<TransactionPage> {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: false })
    // One extra row is the "is there another page?" probe — cheaper than a
    // second count query, and exact.
    .limit(TRANSACTIONS_PAGE_SIZE + 1);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.from) query = query.gte("transaction_date", filters.from);
  if (filters.to) query = query.lte("transaction_date", filters.to);
  if (filters.q) {
    query = query.ilike("merchant_or_item", `%${escapeLikePattern(filters.q)}%`);
  }
  // Amount filters read as magnitudes — "over 500" should mean a 500 expense
  // as readily as a 500 deposit, and the ledger stores expenses negative.
  // Number(...) rather than the raw value: these land in an interpolated
  // filter string, so they must be provably numeric even if a caller skipped
  // the schema above.
  if (filters.min !== undefined) {
    const min = Number(filters.min);
    if (Number.isFinite(min)) query = query.or(`amount.gte.${min},amount.lte.${-min}`);
  }
  if (filters.max !== undefined) {
    const max = Number(filters.max);
    if (Number.isFinite(max)) query = query.gte("amount", -max).lte("amount", max);
  }

  if (cursor) {
    // Values are double-quoted: a timestamptz contains '.', ':' and '+',
    // all of which are structural characters inside a PostgREST filter.
    query = query.or(
      `transaction_date.lt."${cursor.date}",` +
        `and(transaction_date.eq."${cursor.date}",id.lt."${cursor.id}")`
    );
  }

  const { data } = await query;
  const rows = data ?? [];

  const hasMore = rows.length > TRANSACTIONS_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, TRANSACTIONS_PAGE_SIZE) : rows;
  const last = items[items.length - 1];

  return {
    items,
    nextCursor:
      hasMore && last ? { date: last.transaction_date, id: last.id } : null,
  };
}
