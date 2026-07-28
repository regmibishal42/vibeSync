import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

// loans + loan_repayments + loan_balances are always consumed together on
// this page (individual loan cards need repayment totals, the "who owes
// who" rollup needs the view) — one fetcher, one <Suspense> boundary.
export const getLoansData = cache(async () => {
  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const [{ data: loans }, { data: repayments }, { data: balances }, { data: accounts }] =
    await Promise.all([
      supabase.from("loans").select("*").order("loan_date", { ascending: false }),
      supabase.from("loan_repayments").select("*"),
      supabase.from("loan_balances").select("*"),
      supabase.from("accounts").select("id, user_id, account_name").order("account_name"),
    ]);

  return {
    profile,
    loans: loans ?? [],
    repayments: repayments ?? [],
    balances: balances ?? [],
    accounts: accounts ?? [],
  };
});
