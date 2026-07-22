import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Every layout/page/component in the (app) group needs "who is this" at
// least once per request, and `auth.getUser()` is a real network round trip
// to Supabase's Auth server (it validates the JWT server-side rather than
// just decoding it). `cache()` memoizes that round trip per request so
// calling this from the layout, the page, and any nested component costs
// exactly one network call instead of one per caller.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Resolves "who is this and what should they see". Proxy already guarantees
// a session exists past this point, so a missing profile here means the
// two seed accounts haven't been provisioned yet rather than a normal
// unauthenticated state.
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
