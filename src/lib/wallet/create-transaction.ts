import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountType, Database, ExpenseCategory } from "@/lib/types/database.types";

// Shared by createTransaction (wallet/actions.ts, the full dialog's Server
// Action) and the /api/wallet/quick-add route (the amount-first quick-add
// flow, which needs a plain fetchable endpoint so the offline queue in
// lib/offline-queue.ts can replay it later) — one place for the "attribute
// to the account's actual owner, sign by type" rule so the two entry points
// can never drift.
export async function getAccountOwner(
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

export async function insertSignedTransaction(
  supabase: SupabaseClient<Database>,
  input: {
    accountId: string;
    type: "EXPENSE" | "DEPOSIT";
    amount: number;
    category?: ExpenseCategory | null;
    merchantOrItem?: string | null;
    transactionDate?: string;
  }
): Promise<{ error?: string }> {
  const ownerId = await getAccountOwner(supabase, input.accountId);
  if (!ownerId) {
    return { error: "Could not resolve account ownership." };
  }

  const signedAmount =
    input.type === "EXPENSE" ? -Math.abs(input.amount) : Math.abs(input.amount);

  const { error } = await supabase.from("transactions").insert({
    account_id: input.accountId,
    user_id: ownerId,
    amount: signedAmount,
    type: input.type,
    category: input.category ?? null,
    merchant_or_item: input.merchantOrItem ?? null,
    transaction_date: input.transactionDate ?? new Date().toISOString(),
  });

  return error ? { error: error.message } : {};
}

// Shared by createTransaction's TRANSFER branch (server) and TransferForm's
// optimistic rows (client) so a BANK->CASH or CASH->BANK move — an ATM
// withdrawal or a cash deposit — reads like a real bank statement line
// instead of generic "Transfer out"/"Transfer in" on both legs.
export function transferLabels(
  sourceType: AccountType,
  destinationType: AccountType
): { out: string; in: string } {
  if (sourceType === "BANK" && destinationType === "CASH") {
    return { out: "Cash Withdrawal", in: "Cash Withdrawal" };
  }
  if (sourceType === "CASH" && destinationType === "BANK") {
    return { out: "Cash Deposit", in: "Cash Deposit" };
  }
  return { out: "Transfer out", in: "Transfer in" };
}
