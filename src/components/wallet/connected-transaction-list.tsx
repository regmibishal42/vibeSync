"use client";

import { TransactionList } from "@/components/wallet/transaction-list";
import { useTransactionsOptimistic } from "@/components/wallet/transactions-provider";
import type { Database } from "@/lib/types/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Thin client wrapper so TransactionList itself stays a pure presentational
// component — this is the only piece that knows about the optimistic
// overlay, merging pending (just-submitted, not-yet-confirmed) entries on
// top of the real server-fetched transactions.
export function ConnectedTransactionList({
  transactions,
  accounts,
  currencyByUserId,
  fallbackCurrency,
}: {
  transactions: Transaction[];
  accounts: Account[];
  currencyByUserId: Map<string, string>;
  fallbackCurrency: string;
}) {
  const { pendingTransactions } = useTransactionsOptimistic();

  return (
    <TransactionList
      transactions={[...pendingTransactions, ...transactions]}
      accounts={accounts}
      currencyByUserId={currencyByUserId}
      fallbackCurrency={fallbackCurrency}
    />
  );
}
