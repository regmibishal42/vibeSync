import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";

import { signOut } from "@/app/(app)/actions";
import { AppHeader } from "@/components/nav/app-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { FabQuickLog } from "@/components/nav/fab-quick-log";
import { Button } from "@/components/ui/button";
import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { TransactionsProvider } from "@/components/wallet/transactions-provider";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";

// Entry *into* the app shell can't be instant — it depends on the session
// cookie, which is unknowable at build time. Per Next's instant-navigation
// guide this is exactly what `instant = false` on a layout is for: it exempts
// first entry while still allowing each page underneath to be validated for
// instant sibling navigation (see `unstable_instant` in every page.tsx).
export const unstable_instant = false;

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <Suspense fallback={<AppShellSkeleton />}>
        <AppChrome>{children}</AppChrome>
      </Suspense>
    </div>
  );
}

// Header/nav/FAB data. Cached rather than re-queried, because this used to
// run two Supabase round trips on every single entry — the profile lookup
// plus the FAB's account list. React's `cache()` only dedupes within one
// request, so it did nothing across navigations.
//
// Tagged with walletAccounts so adding or renaming an account refreshes the
// FAB's picker immediately, and profiles so a currency change lands.
async function getChromeData() {
  "use cache: private";
  cacheTag(CACHE_TAGS.walletAccounts, CACHE_TAGS.profile);
  cacheLife("minutes");

  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, accounts: [] };

  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, user_id, account_name, account_type")
    .order("account_name");

  return { profile, accounts: accounts ?? [] };
}

async function AppChrome({ children }: { children: React.ReactNode }) {
  const { profile, accounts } = await getChromeData();

  // Proxy guarantees a session exists here — a missing profile means the two
  // seed accounts haven't been provisioned yet (see scripts/seed.ts), not a
  // normal unauthenticated visitor. A plain redirect("/login") would bounce
  // right back here: proxy.ts sends any authenticated session away from
  // /login and back to "/", which loops forever since the profile is still
  // missing. Since Server Components cannot clear cookies (and thus signing
  // out here fails), we render an unprovisioned state with a Server Action
  // sign-out button to avoid an infinite redirect loop.
  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center p-4 text-center">
        <h1 className="text-xl font-bold">Account not provisioned</h1>
        <p className="text-muted-foreground mt-2 mb-6 max-w-sm">
          Your account exists but hasn&apos;t been set up with a profile yet.
          Please run the seed script or contact your administrator.
        </p>
        <form action={signOut}>
          <Button type="submit">Sign Out</Button>
        </form>
      </div>
    );
  }

  return (
    <TransactionsProvider>
      <AppHeader fullName={profile.full_name} role={profile.role} />
      <main className="flex-1 px-4 pt-4 pb-28">{children}</main>
      <FabQuickLog accounts={accounts} currency={profile.currency_preference} />
      <BottomNav />
    </TransactionsProvider>
  );
}
