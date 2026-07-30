import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/profile";
import { CACHE_TAGS } from "@/lib/cache-tags";

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

  const [profile, user, supabase] = await Promise.all([
    getCurrentProfile(),
    getCurrentUser(),
    createClient(),
  ]);
  const { data: accounts } = await supabase.from("accounts").select("*");

  return { profile, user, accounts: accounts ?? [] };
});

// 90 days is enough headroom for both the "this week"/"this month" toggle
// and the 14-day earnings-style charts without scanning full history on
// every dashboard load.
export const getDashboardTransactionsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.dashboardTransactions);
  cacheLife("seconds");

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data } = await supabase
    .from("transactions")
    .select("*")
    .gte("transaction_date", since.toISOString());

  return data ?? [];
});

export const getDashboardJobsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.dashboardJobs);
  cacheLife("seconds");

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [{ data: jobs }, { data: shifts }] = await Promise.all([
    supabase.from("jobs").select("*"),
    supabase
      .from("job_shifts")
      .select("*")
      .gte("shift_date", since.toISOString().slice(0, 10)),
  ]);

  return { jobs: jobs ?? [], shifts: shifts ?? [] };
});

// Explicitly scoped to `user_id = user.id`, NOT the raw is_owner()-bypassed
// fetch used elsewhere — each person's home page shows only their own
// upcoming bills/salary, never mixed with the other's.
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
