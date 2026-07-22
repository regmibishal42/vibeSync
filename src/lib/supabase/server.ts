import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Server Component / Server Action client. Reads the session from cookies;
// writes are best-effort (a Server Component can't set cookies, only a
// Server Action or Proxy can — see lib/supabase/proxy.ts for the refresh path).
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — cookies are read-only there.
          // Session refresh is instead handled by proxy.ts on every request.
        }
      },
    },
  });
}
