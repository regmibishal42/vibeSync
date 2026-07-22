// The `!` non-null assertions previously used at each call site only satisfy
// TypeScript — at runtime, an undefined URL/key still reaches
// `createServerClient`/`createBrowserClient`, which throw a generic message
// that doesn't say which env var is missing or where to set it. Every
// request goes through `proxy.ts`, so a missing var there crashes the whole
// site rather than just the page that needed the value.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set them in .env.local for local dev, or in the Vercel project's " +
        "Environment Variables (Settings → Environment Variables) for the " +
        "Production environment specifically, then redeploy."
    );
  }

  return { url, anonKey };
}
