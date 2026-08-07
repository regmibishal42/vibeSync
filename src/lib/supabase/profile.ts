import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// `auth.getUser()` is a real round trip to Supabase's Auth server — it
// validates the JWT rather than just decoding it, which is the reason to
// prefer it over getSession().
//
// An earlier version skipped that round trip by having proxy.ts stamp the
// verified id onto a custom request header. That was removed deliberately:
// reading a non-standard header made every route dynamic, which blocked the
// instant static shell (Next's instant validation rejects it outright), and
// the cost it saved has since evaporated — every caller now sits inside a
// `'use cache: private'` scope with a multi-minute life, so this runs on a
// cache miss rather than on every navigation. Fewer moving parts, no bespoke
// trust channel, and faster in the way that actually matters.
export const getCurrentUser = cache(async (): Promise<{ id: string } | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
});

// Resolves "who is this and what should they see". Proxy already guarantees
// a session exists past this point, so a missing profile here means the two
// accounts haven't been provisioned yet rather than a normal unauthenticated
// state.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});
