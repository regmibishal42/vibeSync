import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { CACHE_TAGS } from "@/lib/cache-tags";

// Same cached-fetcher shape as every other route, so the settings page can
// produce an instant shell on tab switch too.
//
// The partner lookup only ever returns a name and id: profiles is the single
// table the OWNER can read across accounts (0013_strict_isolation.sql), and
// it carries no financial data. For the PARTNER this returns null, so the
// reset form never renders for them.
export const getSettingsData = cache(async () => {
  "use cache: private";
  cacheTag(CACHE_TAGS.profile);
  cacheLife("minutes");

  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, partner: null };

  if (profile.role !== "OWNER") {
    return { profile, partner: null };
  }

  const supabase = await createClient();
  const { data: partner } = await supabase
    .from("profiles")
    .select("id, full_name")
    .neq("id", profile.id)
    .maybeSingle();

  return { profile, partner: partner ?? null };
});
