import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  fetchTransactionPage,
  type TransactionFilters,
} from "@/lib/wallet/transaction-query";

// 'use cache: private' — cached only in *this browser's* memory (never
// persisted server-side), so switching Home/Work/Wallet/Loans and coming
// back within the `cacheLife('seconds')` window (30s stale) is instant, with
// zero cross-user leak risk since nothing is ever written to a shared store.
// Every mutating Server Action calls `updateTag` for exactly the tags below
// that it actually touches (not a blanket `revalidatePath`, which currently
// busts every previously-visited page on next nav — see cache-tags.ts), so a
// save on this device is instantly fresh without nuking unrelated tabs' cache.
// A hard reload/new tab always re-executes this against Supabase fresh,
// since private-cache functions are excluded from static-shell prerendering.
//
// Small + fast — accounts resolve well before the transactions query, so
// this is its own fetcher/<Suspense> boundary in page.tsx: balances, charts,
// account cards and the action buttons can all appear before the ledger
// streams in. Every row is RLS-scoped to the signed-in user, so there's no
// per-owner currency map to build any more — one profile, one currency.
export const getWalletAccountsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.walletAccounts);
  cacheLife("seconds");

  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at");

  return { profile, accounts: accounts ?? [] };
});

// Re-exported so pages keep importing filters from one place.
export type { TransactionFilters } from "@/lib/wallet/transaction-query";

// First page of the ledger. Cached like every other fetcher, so returning to
// the wallet tab is instant; subsequent pages come from the load-more Server
// Action (uncached — each page is fetched once, on demand).
export const getWalletTransactionsData = cache(async (filters: TransactionFilters = {}) => {
  "use cache: private";
  cacheTag(CACHE_TAGS.walletTransactions);
  cacheLife("seconds");

  const supabase = await createClient();
  return fetchTransactionPage(supabase, filters);
});

// Unbounded-by-recency, scoped to the current calendar month — used for the
// month stat cards and the category spend chart. The `.limit(50)` "recent
// transactions" query above silently under-counts once monthly volume
// exceeds 50; this one doesn't cap, since dozens/hundreds of rows a month
// is well within this app's actual scale.
export const getWalletMonthTransactionsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.walletTransactions);
  cacheLife("seconds");

  const supabase = await createClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data } = await supabase
    .from("transactions")
    .select("*")
    .gte("transaction_date", firstOfMonth);

  return data ?? [];
});

export const getRecurringTransactionsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.recurringTransactions);
  cacheLife("seconds");

  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("is_active", true)
    .order("next_due_date", { ascending: true });

  return data ?? [];
});
