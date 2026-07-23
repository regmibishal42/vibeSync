"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_ORDER } from "@/lib/wallet/categories";
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
  // submitted the form — lets the ADMIN set up a recurring bill against the
  // PARTNER's account without it vanishing from her own RLS-filtered view.
  const ownerId = await getAccountOwner(supabase, parsed.data.accountId);
  if (!ownerId) {
    return { error: "Could not resolve account ownership." };
  }

  const { error } = await supabase.from("recurring_bills").insert({
    user_id: ownerId,
    account_id: parsed.data.accountId,
    label: parsed.data.label,
    category: parsed.data.category,
    amount: parsed.data.amount,
    frequency: parsed.data.frequency,
    next_due_date: parsed.data.nextDueDate,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}

export async function markRecurringBillPaid(billId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase.rpc("mark_recurring_bill_paid", {
    p_bill_id: billId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}

export async function deactivateRecurringBill(billId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("recurring_bills")
    .update({ is_active: false })
    .eq("id", billId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}
