import { Suspense } from "react";

import { signOut } from "@/app/(app)/actions";
import { AppHeader } from "@/components/nav/app-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { FabQuickLog } from "@/components/nav/fab-quick-log";
import { Button } from "@/components/ui/button";
import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { getCurrentProfile } from "@/lib/supabase/profile";

// This shell is permanently, legitimately dynamic — financial/session data
// can never be prefetched or shown stale across users — so it's exempted
// from Cache Components' instant-navigation static-shell validation rather
// than fighting an unfixable warning on every request.
export const unstable_instant = false;

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next's client-side navigation only re-renders below this shared layout,
  // so this Suspense boundary only ever engages on a genuine first/hard
  // load — header/nav never re-flash or re-fetch when tab-switching between
  // the 4 routes.
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <Suspense fallback={<AppShellSkeleton />}>
        <AppChrome>{children}</AppChrome>
      </Suspense>
    </div>
  );
}

async function AppChrome({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  // Proxy guarantees a session exists here — a missing profile means the two
  // seed accounts haven't been provisioned yet (see scripts/seed.ts), not a
  // normal unauthenticated visitor. A plain redirect("/login") would bounce
  // right back here: proxy.ts sends any authenticated session away from
  // /login and back to "/", which loops forever since the profile is still
  // missing. Since Server Components cannot clear cookies (and thus signing out
  // here fails), we render an unprovisioned state with a Server Action sign out
  // button to avoid an infinite redirect loop.
  if (!profile) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center p-4 text-center">
        <h1 className="text-xl font-bold">Account not provisioned</h1>
        <p className="text-muted-foreground mt-2 mb-6 max-w-sm">
          Your account exists but hasn&apos;t been set up with a profile yet. Please run the seed script or contact your administrator.
        </p>
        <form action={signOut}>
          <Button type="submit">Sign Out</Button>
        </form>
      </div>
    );
  }

  return (
    <>
      <AppHeader fullName={profile.full_name} role={profile.role} />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <FabQuickLog role={profile.role} />
      <BottomNav role={profile.role} />
    </>
  );
}
