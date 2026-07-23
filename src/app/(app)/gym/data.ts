import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// Small catalog table, needed by the quick-add form's dropdown — split from
// the (larger, up to 100-row) gym_logs query so the form can render as soon
// as this resolves, without waiting on the log history/chart data too.
export const getGymExercisesData = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("gym_exercises").select("*").order("name");
  return data ?? [];
});

export const getGymLogsData = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_logs")
    .select("*")
    .order("logged_at", { ascending: false })
    .limit(100);
  return data ?? [];
});
