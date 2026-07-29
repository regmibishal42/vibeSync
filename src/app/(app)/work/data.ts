import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

// 'use cache: private' — browser-memory-only, see wallet/data.ts for the
// full rationale (instant tab-switch/back-nav within 30s, zero server-side
// cross-user risk, always cleared instantly by this device's own writes).
//
// jobs + job_shifts + linked salary schedules are always consumed together
// (stat cards, the chart, and every job card need all three) — one fetcher,
// one <Suspense> boundary. payout_batches gets its own boundary below since
// it's only rendered inside the Payouts tab.
export const getJobsData = cache(async () => {
  "use cache: private";
  cacheTag("work-jobs");
  cacheLife("seconds");

  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const [{ data: jobs }, { data: shifts }, { data: salaries }, { data: accounts }] =
    await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: true }),
      supabase
        .from("job_shifts")
        .select("*")
        .order("shift_date", { ascending: false })
        .limit(120),
      supabase.from("recurring_transactions").select("*").eq("direction", "INCOME"),
      supabase.from("accounts").select("id, account_name").order("account_name"),
    ]);

  return {
    profile,
    jobs: jobs ?? [],
    shifts: shifts ?? [],
    salaries: salaries ?? [],
    accounts: accounts ?? [],
  };
});

export const getPayoutBatchesData = cache(async () => {
  "use cache: private";
  cacheTag("work-payout-batches");
  cacheLife("seconds");

  const supabase = await createClient();
  const { data } = await supabase
    .from("payout_batches")
    .select("*")
    .order("paid_at", { ascending: false })
    .limit(20);

  return data ?? [];
});
