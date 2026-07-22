import { redirect } from "next/navigation";

import { AppHeader } from "@/components/nav/app-header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { FabQuickLog } from "@/components/nav/fab-quick-log";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // Proxy guarantees a session exists here — a missing profile means the two
  // seed accounts haven't been provisioned yet (see scripts/seed.ts), not a
  // normal unauthenticated visitor. A plain redirect("/login") would bounce
  // right back here: proxy.ts sends any authenticated session away from
  // /login and back to "/", which loops forever since the profile is still
  // missing. Sign the session out first so the next request is genuinely
  // unauthenticated and the redirect actually lands on /login.
  if (!profile) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col">
      <AppHeader fullName={profile.full_name} role={profile.role} />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <FabQuickLog role={profile.role} />
      <BottomNav role={profile.role} />
    </div>
  );
}
