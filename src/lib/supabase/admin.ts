import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Service-role client. This key bypasses Row Level Security completely, so
// it must never reach the browser: the `server-only` import above turns any
// accidental import from a Client Component into a build error rather than
// a silent leak.
//
// Only one thing in the app uses it — the OWNER resetting the PARTNER's
// password (see app/(app)/settings/actions.ts), which needs the Auth admin
// API. Every other data path goes through the ordinary RLS-scoped client.
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — required for password management. " +
        "Set it in .env.local locally, or in the Vercel project's Environment " +
        "Variables for the Production environment, then redeploy."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
