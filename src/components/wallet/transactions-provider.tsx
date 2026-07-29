"use client";

import { createContext, useContext, useOptimistic, type ReactNode } from "react";

import type { Database } from "@/lib/types/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type OptimisticTransaction = Transaction & { _pending?: true };

type Action =
  | { type: "add"; tx: OptimisticTransaction }
  | { type: "add-pair"; txs: [OptimisticTransaction, OptimisticTransaction] };

type ContextValue = {
  pendingTransactions: OptimisticTransaction[];
  addOptimistic: (action: Action) => void;
};

const TransactionsContext = createContext<ContextValue | null>(null);

// Deliberately NOT seeded with the real transaction list — this context
// only ever tracks entries added during the current pending transition,
// overlaid on top of whatever real data TransactionList renders (see
// ConnectedTransactionList). That decoupling is what lets it wrap two
// independently-Suspense-streamed siblings (QuickAddSheet/TransferForm and
// the transaction list resolve in separate boundaries, see wallet/page.tsx)
// without needing server data threaded through a client Context at the top
// of the page. Once the enclosing transition settles (the real row has
// streamed in via router.refresh()), React reverts this back to EMPTY on
// its own — no manual "remove" dispatch needed.
const EMPTY: OptimisticTransaction[] = [];

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const [pendingTransactions, addOptimistic] = useOptimistic<OptimisticTransaction[], Action>(
    EMPTY,
    (state, action) =>
      action.type === "add" ? [action.tx, ...state] : [...action.txs, ...state]
  );

  return (
    <TransactionsContext.Provider value={{ pendingTransactions, addOptimistic }}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactionsOptimistic() {
  const ctx = useContext(TransactionsContext);
  if (!ctx) {
    throw new Error("useTransactionsOptimistic must be used within a TransactionsProvider");
  }
  return ctx;
}
