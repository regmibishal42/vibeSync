import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login"];

// Runs on every request (see proxy.ts at the project root). Refreshes the
// Supabase session cookie and gates every non-public route behind auth —
// there is no public sign-up page, so an unauthenticated visitor can only
// ever land on /login.
export async function updateSession(request: NextRequest) {
  const { url: supabaseUrl, anonKey } = getSupabaseEnv();

  // Collected instead of building a NextResponse on every refresh — exactly
  // one NextResponse.next() is constructed at the end (below), so a
  // mid-flight token-refresh cookie can never be silently dropped by the
  // later reconstruction that adds the x-vibesync-user-id header.
  let refreshedCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        refreshedCookies = cookiesToSet;
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Downstream Server Components/Actions read this instead of re-calling
  // auth.getUser() themselves (see getCurrentUser() in
  // lib/supabase/profile.ts) — cuts a second Supabase Auth network round
  // trip on every single navigation and Server Action call. Safe: it's set
  // here on the request Next forwards to the actual render, immediately
  // after the one real verification above — whatever a client sends under
  // this header name is replaced, never merged, and RLS remains the actual
  // data-access boundary regardless of this value either way.
  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set("x-vibesync-user-id", user.id);
  } else {
    requestHeaders.delete("x-vibesync-user-id");
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  refreshedCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
