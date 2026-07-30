"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_ORDER } from "@/lib/wallet/categories";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExpenseCategory } from "@/lib/types/database.types";

type ActionResult = { error?: string; success?: boolean };

const categoryEnum = CATEGORY_ORDER as [ExpenseCategory, ...ExpenseCategory[]];

async function getAccountOwner(
  supabase: SupabaseClient<Database>,
  accountId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("accounts")
    .select("user_id")
    .eq("id", accountId)
    .single();
  return data?.user_id ?? null;
}

// Wallet's "add recurring" form only ever creates EXPENSE bills — salary
// (INCOME) rows are created from the Work page alongside their job, since a
// salaried job IS its recurring paycheck (see createJob() in work/actions.ts).
const recurringBillSchema = z.object({
  accountId: z.string().uuid("Pick an account"),
  label: z.string().min(1, "Name is required"),
  category: z.enum(categoryEnum),
  amount: z.coerce.number().positive("Must be greater than 0"),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  nextDueDate: z.string().min(1),
});

export async function createRecurringBill(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const parsed = recurringBillSchema.safeParse({
    accountId: formData.get("accountId"),
    label: formData.get("label"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
    nextDueDate: formData.get("nextDueDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Same attribution rule as createTransaction/createAccount: the bill
  // belongs to whoever owns the chosen account, not necessarily whoever
  // submitted the form — lets the OWNER set up a recurring bill against the
  // PARTNER's account without it vanishing from her own RLS-filtered view.
  const ownerId = await getAccountOwner(supabase, parsed.data.accountId);
  if (!ownerId) {
    return { error: "Could not resolve account ownership." };
  }

  const { error } = await supabase.from("recurring_transactions").insert({
    user_id: ownerId,
    account_id: parsed.data.accountId,
    direction: "EXPENSE",
    label: parsed.data.label,
    category: parsed.data.category,
    amount: parsed.data.amount,
    frequency: parsed.data.frequency,
    next_due_date: parsed.data.nextDueDate,
  });

  if (error) {
    return { error: error.message };
  }

  updateTag(CACHE_TAGS.recurringTransactions);
  updateTag(CACHE_TAGS.dashboardRecurring);
  return { success: true };
}

export async function markRecurringTransactionPaid(
  recurringId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase.rpc("mark_recurring_transaction_paid", {
    p_recurring_id: recurringId,
  });

  if (error) {
    return { error: error.message };
  }

  // Posts a real wallet transaction, so this could be settling either a
  // plain bill or a job-linked salary schedule — tag both surfaces rather
  // than looking up which one this row is, since over-invalidating a tag by
  // one extra (still-precise) name costs nothing but a cache-miss re-fetch.
  updateTag(CACHE_TAGS.walletAccounts);
  updateTag(CACHE_TAGS.walletTransactions);
  updateTag(CACHE_TAGS.recurringTransactions);
  updateTag(CACHE_TAGS.dashboardAccounts);
  updateTag(CACHE_TAGS.dashboardTransactions);
  updateTag(CACHE_TAGS.dashboardRecurring);
  updateTag(CACHE_TAGS.workJobs);
  updateTag(CACHE_TAGS.dashboardJobs);
  return { success: true };
}

export async function deactivateRecurringTransaction(
  recurringId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("recurring_transactions")
    .update({ is_active: false })
    .eq("id", recurringId);

  if (error) {
    return { error: error.message };
  }

  updateTag(CACHE_TAGS.recurringTransactions);
  updateTag(CACHE_TAGS.dashboardRecurring);
  updateTag(CACHE_TAGS.workJobs);
  updateTag(CACHE_TAGS.dashboardJobs);
  return { success: true };
}
