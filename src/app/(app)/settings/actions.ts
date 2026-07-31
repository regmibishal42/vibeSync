"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/supabase/verify-password";

type ActionResult = { error?: string; success?: boolean };

// Supabase's own default floor is 6; 8 is a small, free improvement given
// these are long-lived personal accounts with no MFA behind them.
const MIN_PASSWORD_LENGTH = 8;

const ownPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The two new passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "That's already your current password",
    path: ["newPassword"],
  });

// Changing your own password. Re-authenticates first: a Supabase session
// stays valid for a long time, so without this anyone with a borrowed
// unlocked phone could silently take over the account.
export async function changeOwnPassword(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Not signed in." };
  }

  const parsed = ownPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!(await verifyPassword(user.email, parsed.data.currentPassword))) {
    return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

const partnerPasswordSchema = z
  .object({
    targetUserId: z.string().uuid(),
    ownPassword: z.string().min(1, "Confirm with your own password"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The two new passwords don't match",
    path: ["confirmPassword"],
  });

// The OWNER's single cross-user capability. Everything else about the
// PARTNER's data is unreachable to them (see 0013_strict_isolation.sql) —
// this deliberately is not, because someone has to be able to recover a
// locked-out account without a mail server.
//
// Three checks before the service-role key is touched at all:
//   1. there is a session
//   2. that session's profile really is role = OWNER, read server-side —
//      never trusted from the client
//   3. the OWNER re-enters their own password, so a borrowed unlocked phone
//      can't reset the other account
// The target is then confirmed to be a real, non-OWNER profile, so this
// can't be pointed at an arbitrary uuid.
export async function changePartnerPassword(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Not signed in." };
  }

  const parsed = partnerPasswordSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    ownPassword: formData.get("ownPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (actor?.role !== "OWNER") {
    return { error: "Only the owner can reset another account's password." };
  }

  if (parsed.data.targetUserId === user.id) {
    return { error: "Use the form above to change your own password." };
  }

  if (!(await verifyPassword(user.email, parsed.data.ownPassword))) {
    return { error: "Your own password is incorrect." };
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", parsed.data.targetUserId)
    .single();

  if (!target || target.role === "OWNER") {
    return { error: "That account can't be reset from here." };
  }

  const { error } = await admin.auth.admin.updateUserById(parsed.data.targetUserId, {
    password: parsed.data.newPassword,
  });
  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
