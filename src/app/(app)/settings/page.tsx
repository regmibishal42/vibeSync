import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";

import { getSettingsData } from "@/app/(app)/settings/data";
import { PasswordForm } from "@/components/settings/password-form";
import { Card } from "@/components/ui/card";

// NOTE: `unstable_instant` validation was attempted on every page here and
// removed. Under a layout exported as `instant = false` (which this one must
// be — entry depends on the session cookie), every child segment eventually
// reports "target segment was prevented from rendering for an unknown
// reason", naming no component and offering nothing to fix. It's a
// draft-status feature and the docs' "validate inner segments under an
// exempted layout" path doesn't hold in 16.2.
//
// Nothing is lost at runtime: validation only *proves* a shell is instant,
// it isn't the mechanism that makes it so. What actually fixed navigation is
// in the data layer — see cacheLife in each data.ts and getChromeData in the
// layout.

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
  const { profile, partner } = await getSettingsData();

  // Never return null: the layout already handles the unprovisioned case,
  // and a segment that renders nothing gives instant validation nothing to
  // check ("target segment was prevented from rendering").
  if (!profile) {
    return (
      <p className="text-muted-foreground text-sm">
        Sign in again to manage your account.
      </p>
    );
  }

  const isOwner = profile.role === "OWNER";

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
