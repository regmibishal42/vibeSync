import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { PasswordForm } from "@/components/settings/password-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Account and password management.
        </p>
      </div>

      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isOwner = profile.role === "OWNER";

  // Only the OWNER can read another profile row (that single exception is
  // spelled out in 0013_strict_isolation.sql) — and a profile row carries a
  // name and role, never any financial data.
  let partner: { id: string; full_name: string } | null = null;
  if (isOwner) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .neq("id", profile.id)
      .maybeSingle();
    partner = data ?? null;
  }

  return (
    <>
      <Card className="gap-2 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{profile.full_name}</p>
            <p className="text-muted-foreground text-xs">
              {isOwner ? "Owner" : "Partner"} · {profile.currency_preference}
            </p>
          </div>
          <span className="bg-shift/15 text-shift flex size-9 items-center justify-center rounded-lg">
            <ShieldCheck className="size-4" />
          </span>
        </div>
      </Card>

      <PasswordForm mode="self" />

      {isOwner && partner ? (
        <PasswordForm
          mode="partner"
          targetUserId={partner.id}
          targetName={partner.full_name}
        />
      ) : null}

      <p className="text-muted-foreground px-1 text-xs">
        Each account&apos;s money, jobs and loans are visible only to that
        account — enforced by the database, not by this screen.
        {isOwner
          ? " Resetting the other password is the one thing that reaches across accounts."
          : ""}
      </p>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-muted h-20 w-full animate-pulse rounded-xl" />
      <div className="bg-muted h-72 w-full animate-pulse rounded-xl" />
    </div>
  );
}
