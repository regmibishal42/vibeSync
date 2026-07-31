"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { changeOwnPassword, changePartnerPassword } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// One component for both flows — they differ only in which password acts as
// the confirmation (your current one vs. the owner's own) and whether a
// target account is being written to.
export function PasswordForm({
  mode,
  targetUserId,
  targetName,
}: {
  mode: "self" | "partner";
  targetUserId?: string;
  targetName?: string;
}) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const isPartner = mode === "partner";

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = isPartner
        ? await changePartnerPassword({}, formData)
        : await changeOwnPassword({}, formData);

      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      toast.success(
        isPartner ? `${targetName}'s password updated` : "Your password was updated"
      );
      // Clearing by hand rather than key-remounting so the success toast
      // isn't torn down with the form.
      const form = document.getElementById(
        isPartner ? "partner-password-form" : "own-password-form"
      ) as HTMLFormElement | null;
      form?.reset();
    });
  }

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
          <KeyRound className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-medium">
            {isPartner ? `Reset ${targetName}'s password` : "Change your password"}
          </h2>
          <p className="text-muted-foreground text-xs">
            {isPartner
              ? "They'll need the new password to sign in. You still can't see their data."
              : "You'll stay signed in on this device."}
          </p>
        </div>
      </div>

      <form
        id={isPartner ? "partner-password-form" : "own-password-form"}
        action={handleSubmit}
        className="flex flex-col gap-3"
      >
        {isPartner ? (
          <input type="hidden" name="targetUserId" value={targetUserId} />
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor={`${mode}-current`}>
            {isPartner ? "Your own password" : "Current password"}
          </Label>
          <Input
            id={`${mode}-current`}
            name={isPartner ? "ownPassword" : "currentPassword"}
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${mode}-new`}>New password</Label>
          <Input
            id={`${mode}-new`}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${mode}-confirm`}>Confirm new password</Label>
          <Input
            id={`${mode}-confirm`}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        {error ? (
          <p className="text-destructive text-sm font-medium">{error}</p>
        ) : null}

        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isPartner ? "Reset password" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}
