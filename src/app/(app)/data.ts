import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/supabase/profile";

// cache()-wrapped so HomeHero and HomeStats (two sibling <Suspense>
// boundaries in page.tsx that both need "my own accounts") share one
// Supabase round trip instead of double-querying — React's cache() dedupes
// by function identity per request, not just the already-cache()-wrapped
// getCurrentProfile/getCurrentUser calls inside it.
export const getHomeAccountsData = cache(async () => {
  const [profile, user, supabase] = await Promise.all([
    getCurrentProfile(),
    getCurrentUser(),
    createClient(),
  ]);
  const { data: accounts } = await supabase.from("accounts").select("*");

  return { profile, user, accounts: accounts ?? [] };
});

// Explicitly scoped to `user_id = user.id`, NOT the raw is_admin()-bypassed
// fetch used elsewhere — the ADMIN's home page must show only his own
// upcoming bills, never the PARTNER's rent mixed into his own view.
export const getHomeUpcomingBillsData = cache(async () => {
  const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  if (!user) return [];

  const { data } = await supabase
    .from("recurring_bills")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("next_due_date", { ascending: true })
    .limit(3);

  return data ?? [];
});

export const getHomeActivityData = cache(async () => {
  const supabase = await createClient();
  const [{ data: hotelShifts }, { data: secondaryShifts }, { data: gymLogs }] =
    await Promise.all([
      supabase.from("hotel_shifts").select("*"),
      supabase.from("secondary_shifts").select("*"),
      supabase.from("gym_logs").select("*"),
    ]);

  return {
    hotelShifts: hotelShifts ?? [],
    secondaryShifts: secondaryShifts ?? [],
    gymLogs: gymLogs ?? [],
  };
});
