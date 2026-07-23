import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";

// hotel_shifts + secondary_shifts are always consumed together (stat cards,
// the 14-day chart, and both the Hotel/Secondary tabs all need both) — one
// fetcher, one <Suspense> boundary. payout_batches is only rendered inside
// the Payouts tab and gets its own boundary/fetcher below.
export const getWorkShiftsData = cache(async () => {
  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);
  const [{ data: hotelShifts }, { data: secondaryShifts }] = await Promise.all([
    supabase.from("hotel_shifts").select("*").order("shift_date", { ascending: false }).limit(60),
    supabase
      .from("secondary_shifts")
      .select("*")
      .order("shift_date", { ascending: false })
      .limit(60),
  ]);

  return {
    profile,
    hotel: hotelShifts ?? [],
    secondary: secondaryShifts ?? [],
  };
});

export const getPayoutBatchesData = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payout_batches")
    .select("*")
    .order("paid_at", { ascending: false })
    .limit(20);

  return data ?? [];
});
