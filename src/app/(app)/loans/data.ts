import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { CACHE_TAGS } from "@/lib/cache-tags";

// 'use cache: private' — browser-memory-only, see wallet/data.ts for the
// full rationale (instant tab-switch/back-nav within 30s, zero server-side
// cross-user risk, always cleared instantly by this device's own writes).
//
// loans + loan_repayments + loan_balances are always consumed together on
// this page (individual loan cards need repayment totals, the "who owes
// who" rollup needs the view) — one fetcher, one <Suspense> boundary.
export const getLoansData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.loans);
  cacheLife("minutes");

  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const [{ data: loans }, { data: repayments }, { data: balances }, { data: accounts }] =
    await Promise.all([
      supabase.from("loans").select("*").order("loan_date", { ascending: false }),
      supabase.from("loan_repayments").select("*"),
      supabase.from("loan_balances").select("*"),
      supabase
        .from("accounts")
        .select("id, user_id, account_name, account_type")
        .order("account_name"),
    ]);

  return {
    profile,
    loans: loans ?? [],
    repayments: repayments ?? [],
    balances: balances ?? [],
    accounts: accounts ?? [],
  };
});
