"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; success?: boolean };

const loanSchema = z.object({
  accountId: z.string().uuid("Pick an account"),
  counterpartyName: z.string().min(1, "Name is required"),
  direction: z.enum(["LENT", "BORROWED"]),
  principalAmount: z.coerce.number().positive("Must be greater than 0"),
  loanDate: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function createLoan(
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

  const parsed = loanSchema.safeParse({
    accountId: formData.get("accountId"),
    counterpartyName: formData.get("counterpartyName"),
    direction: formData.get("direction"),
    principalAmount: formData.get("principalAmount"),
    loanDate: formData.get("loanDate"),
    dueDate: formData.get("dueDate") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.rpc("create_loan", {
    p_account_id: parsed.data.accountId,
    p_counterparty_name: parsed.data.counterpartyName,
    p_direction: parsed.data.direction,
    p_principal_amount: parsed.data.principalAmount,
    p_loan_date: parsed.data.loanDate,
    p_due_date: parsed.data.dueDate ?? null,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/loans");
  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}

const repaySchema = z.object({
  loanId: z.string().uuid(),
  amount: z.coerce.number().positive("Must be greater than 0"),
  paidDate: z.string().min(1),
  accountId: z.string().uuid().optional(),
});

export async function repayLoan(
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

  const parsed = repaySchema.safeParse({
    loanId: formData.get("loanId"),
    amount: formData.get("amount"),
    paidDate: formData.get("paidDate"),
    accountId: formData.get("accountId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.rpc("repay_loan", {
    p_loan_id: parsed.data.loanId,
    p_amount: parsed.data.amount,
    p_paid_date: parsed.data.paidDate,
    p_account_id: parsed.data.accountId ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/loans");
  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}
