import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Small helper used by every server-rendered route in the (app) group to
// resolve "who is this and what should they see". Proxy already guarantees
// a session exists past this point, so a missing profile here means the
// two seed accounts haven't been provisioned yet rather than a normal
// unauthenticated state.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}
