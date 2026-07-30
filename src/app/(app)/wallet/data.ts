import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/profile";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { ExpenseCategory } from "@/lib/types/database.types";

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
// Small + fast — accounts and profiles resolve well before the (up to
// 50-row) transactions query, so this is its own fetcher/<Suspense> boundary
// in page.tsx: balances/chart/account-cards/both forms can appear before
// the transaction list streams in.
export const getWalletAccountsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.walletAccounts);
  cacheLife("seconds");

  const [profile, user, supabase] = await Promise.all([
    getCurrentProfile(),
    getCurrentUser(),
    createClient(),
  ]);
  const [{ data: accounts }, { data: profiles }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("profiles").select("id, currency_preference"),
  ]);

  return {
    profile,
    user,
    accounts: accounts ?? [],
    profiles: profiles ?? [],
  };
});

export type TransactionFilters = {
  category?: ExpenseCategory;
  from?: string;
  to?: string;
  q?: string;
};

// Default (no filters) view stays capped at 50 rows, matching the original
// "Recent transactions" behavior. The moment any filter is present, the cap
// lifts (to a generous 500 — safety net, not a real limit at this app's
// scale) — a "search my whole history" filter that silently only searches
// the last 50 rows would be a broken filter, not a real one.
export const getWalletTransactionsData = cache(async (filters: TransactionFilters = {}) => {
  "use cache: private";
  cacheTag(CACHE_TAGS.walletTransactions);
  cacheLife("seconds");

  const supabase = await createClient();
  const hasFilter = Boolean(filters.category || filters.from || filters.to || filters.q);

  let query = supabase
    .from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.from) query = query.gte("transaction_date", filters.from);
  if (filters.to) query = query.lte("transaction_date", filters.to);
  if (filters.q) query = query.ilike("merchant_or_item", `%${filters.q}%`);

  query = query.limit(hasFilter ? 500 : 50);

  const { data } = await query;
  return data ?? [];
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
