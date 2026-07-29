import "server-only";
import { cache } from "react";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Fast path: proxy.ts's middleware (see updateSession() in
// lib/supabase/proxy.ts) already ran auth.getUser() once for this exact
// request and stamped the verified id onto a request header — every caller
// here would otherwise redundantly repeat that same network round trip to
// Supabase's Auth server on every single navigation and Server Action call.
// Falls back to a real getUser() call if the header is ever missing (e.g. a
// future route excluded from proxy's matcher), so this is never less
// correct, only usually faster. Only `.id` is used anywhere in this app —
// see the grep-verified note below — so the return type is narrowed rather
// than carrying the full (unused) supabase-js User shape.
//
// (No call site anywhere reads anything off the user besides `.id` — if
// that ever changes, this needs to fall back to the full object instead.)
export const getCurrentUser = cache(async (): Promise<{ id: string } | null> => {
  const headerUserId = (await headers()).get("x-vibesync-user-id");
  if (headerUserId) {
    return { id: headerUserId };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
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
