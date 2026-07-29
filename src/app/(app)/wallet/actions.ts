"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { CATEGORY_ORDER } from "@/lib/wallet/categories";
import { getAccountOwner, insertSignedTransaction } from "@/lib/wallet/create-transaction";
import type { ExpenseCategory } from "@/lib/types/database.types";

const categoryEnum = CATEGORY_ORDER as [ExpenseCategory, ...ExpenseCategory[]];

type ActionResult = { error?: string; success?: boolean };

const accountSchema = z.object({
  accountName: z.string().min(1, "Name is required"),
  accountType: z.enum(["DIGITAL_WALLET", "BANK", "CASH"]),
  isParentAccount: z.coerce.boolean().default(false),
  startingBalance: z.coerce.number().default(0),
});

export async function createAccount(
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

  const parsed = accountSchema.safeParse({
    accountName: formData.get("accountName"),
    accountType: formData.get("accountType"),
    isParentAccount: formData.get("isParentAccount") === "on",
    startingBalance: formData.get("startingBalance") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    account_name: parsed.data.accountName,
    account_type: parsed.data.accountType,
    is_parent_account: parsed.data.isParentAccount,
    starting_balance: parsed.data.startingBalance,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}

const expenseOrDepositSchema = z.object({
  type: z.enum(["EXPENSE", "DEPOSIT"]),
  accountId: z.string().uuid("Pick an account"),
  amount: z.coerce.number().positive("Must be greater than 0"),
  category: z.enum(categoryEnum).optional(),
  merchantOrItem: z.string().optional(),
  transactionDate: z.string().min(1),
});

const transferSchema = z.object({
  accountId: z.string().uuid("Pick a source account"),
  destinationAccountId: z.string().uuid("Pick a destination account"),
  amount: z.coerce.number().positive("Must be greater than 0"),
  transactionDate: z.string().min(1),
});

export async function createTransaction(
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

  const type = formData.get("type");

  if (type === "TRANSFER") {
    const parsed = transferSchema.safeParse({
      accountId: formData.get("accountId"),
      destinationAccountId: formData.get("destinationAccountId"),
      amount: formData.get("amount"),
      transactionDate: formData.get("transactionDate"),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    if (parsed.data.accountId === parsed.data.destinationAccountId) {
      return { error: "Source and destination must be different accounts." };
    }

    // A transaction is attributed to whoever *owns the account*, not
    // whoever clicked submit — this is what lets the OWNER manage the
    // PARTNER's accounts (spec grants her full CRUD there) without her
    // edits silently becoming invisible on the partner's own filtered view.
    const [sourceOwner, destOwner] = await Promise.all([
      getAccountOwner(supabase, parsed.data.accountId),
      getAccountOwner(supabase, parsed.data.destinationAccountId),
    ]);

    if (!sourceOwner || !destOwner) {
      return { error: "Could not resolve account ownership." };
    }

    const { error } = await supabase.from("transactions").insert([
      {
        account_id: parsed.data.accountId,
        user_id: sourceOwner,
        amount: -Math.abs(parsed.data.amount),
        type: "TRANSFER" as const,
        merchant_or_item: "Transfer out",
        transaction_date: parsed.data.transactionDate,
      },
      {
        account_id: parsed.data.destinationAccountId,
        user_id: destOwner,
        amount: Math.abs(parsed.data.amount),
        type: "TRANSFER" as const,
        merchant_or_item: "Transfer in",
        transaction_date: parsed.data.transactionDate,
      },
    ]);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/wallet");
    revalidatePath("/");
    return { success: true };
  }

  const parsed = expenseOrDepositSchema.safeParse({
    type,
    accountId: formData.get("accountId"),
    amount: formData.get("amount"),
    category: formData.get("category") || undefined,
    merchantOrItem: formData.get("merchantOrItem") || undefined,
    transactionDate: formData.get("transactionDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await insertSignedTransaction(supabase, {
    accountId: parsed.data.accountId,
    type: parsed.data.type,
    amount: parsed.data.amount,
    category: parsed.data.category,
    merchantOrItem: parsed.data.merchantOrItem,
    transactionDate: parsed.data.transactionDate,
  });

  if (error) {
    return { error };
  }

  revalidatePath("/wallet");
  revalidatePath("/");
  return { success: true };
}
