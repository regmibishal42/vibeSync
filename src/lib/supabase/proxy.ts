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
  // later reconstruction of the response below.
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

  // Deliberately does NOT forward the verified id on a custom header. That
  // was tried as an auth fast-path, but reading a non-standard header makes
  // every downstream route dynamic, which blocks the instant static shell —
  // and caching made the saving irrelevant anyway (see getCurrentUser()).
  const response = NextResponse.next({ request });
  refreshedCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
