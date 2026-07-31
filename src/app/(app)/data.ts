import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/profile";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type DashboardSummary = {
  income: number;
  expense: number;
  byCategory: { label: string; amount: number }[];
  byAccount: { label: string; amount: number }[];
  byJob: { label: string; amount: number }[];
};

// 'use cache: private' on every fetcher below — cached only in this
// browser's own memory (never persisted server-side), so tab-switching
// between Home/Work/Wallet/Loans and coming back within the 30s
// `cacheLife('seconds')` window is instant, with zero cross-user leak risk.
// Every mutating Server Action calls `updateTag` for exactly the tags it
// touches (not a blanket `revalidatePath`) — see wallet/data.ts and
// lib/cache-tags.ts for the full rationale.
export const getDashboardAccountsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.dashboardAccounts);
  cacheLife("seconds");

  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const { data: accounts } = await supabase.from("accounts").select("*");

  return { profile, accounts: accounts ?? [] };
});

// Aggregated in Postgres rather than by shipping the raw ledger to the
// client and reducing it here. That mattered less when the dashboard only
// ever looked back 90 days; with ranges now reaching a full year it would
// mean downloading thousands of rows to render about eight numbers.
//
// Bounds are ISO instants computed in the viewer's own timezone (see
// resolveRange in lib/dashboard.ts) so boundary-day transactions land in the
// bucket the user expects.
export const getDashboardSummary = cache(
  async (fromISO: string, toISO: string): Promise<DashboardSummary> => {
    "use cache: private";
    cacheTag(CACHE_TAGS.dashboardTransactions);
    cacheLife("seconds");

    const supabase = await createClient();
    const { data } = await supabase.rpc("dashboard_summary", {
      p_from: fromISO,
      p_to: toISO,
    });

    return (
      (data as DashboardSummary | null) ?? {
        income: 0,
        expense: 0,
        byCategory: [],
        byAccount: [],
        byJob: [],
      }
    );
  }
);

// Scoped to `user_id = user.id` explicitly. RLS already enforces this, but
// stating it here keeps the intent obvious at the call site.
export const getDashboardRecurringData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.dashboardRecurring);
  cacheLife("seconds");

  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  if (!user) return [];

  const { data } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("next_due_date", { ascending: true });

  return data ?? [];
});

export const getDashboardLoanBalancesData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.dashboardLoans);
  cacheLife("seconds");

  const supabase = await createClient();
  const { data } = await supabase.from("loan_balances").select("*");
  return data ?? [];
});
