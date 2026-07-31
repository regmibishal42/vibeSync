import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";

// Confirms a password without touching the caller's session.
//
// The obvious approach — calling signInWithPassword on the normal
// cookie-bound server client — succeeds but has a side effect: it writes a
// brand new session into the user's cookies, silently rotating their tokens
// as a side effect of a *validation* check. This uses a throwaway client with
// persistSession disabled, so the check is purely a question and answer.
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const { url, anonKey } = getSupabaseEnv();

  const client = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });

  // Best-effort: drop the session this check just minted server-side rather
  // than leaving it to expire on its own.
  if (!error) await client.auth.signOut();

  return !error;
}
