"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { loadMoreTransactions } from "@/app/(app)/wallet/actions";
import { Button } from "@/components/ui/button";
import { TransactionList } from "@/components/wallet/transaction-list";
import { useTransactionsOptimistic } from "@/components/wallet/transactions-provider";
import type { Database } from "@/lib/types/database.types";
import type {
  TransactionCursor,
  TransactionFilters,
} from "@/lib/wallet/transaction-query";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

// Owns the paginated ledger: the server-rendered first page plus any pages
// the user explicitly loaded, with just-submitted optimistic rows on top.
//
// The parent keys this component on the active filters, so a filter change
// remounts it and paged-in rows from the previous query can't linger — no
// state-syncing effect required.
export function TransactionFeed({
  initialItems,
  initialCursor,
  filters,
  accounts,
  currency,
}: {
  initialItems: Transaction[];
  initialCursor: TransactionCursor | null;
  filters: TransactionFilters;
  accounts: Account[];
  currency: string;
}) {
  const [extraPages, setExtraPages] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<TransactionCursor | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const { pendingTransactions } = useTransactionsOptimistic();

  function handleLoadMore() {
    if (!cursor) return;
    startTransition(async () => {
      const result = await loadMoreTransactions(filters, cursor);
      if (result.error || !result.page) {
        toast.error(result.error ?? "Could not load more transactions.");
        return;
      }
      setExtraPages((prev) => [...prev, ...result.page!.items]);
      setCursor(result.page.nextCursor);
    });
  }

  // A delete can remove a row that lives in an already-paged-in block, and
  // deleting one leg of a transfer removes its sibling too — so rather than
  // guess which ids vanished, drop back to the freshly revalidated first
  // page. Predictable, and the server is the one source of truth.
  function handleDeleted() {
    setExtraPages([]);
    setCursor(initialCursor);
  }

  // An optimistic row can briefly coexist with the real row it became, once
  // the server page includes the saved transaction but the pending entry is
  // still in flight. Deduped by id, first occurrence wins.
  const seen = new Set<string>();
  const transactions = [...pendingTransactions, ...initialItems, ...extraPages].filter(
    (tx) => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    }
  );

  return (
    <div className="flex flex-col gap-3">
      <TransactionList
        transactions={transactions}
        accounts={accounts}
        currency={currency}
        onDeleted={handleDeleted}
      />

      {cursor ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleLoadMore}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ChevronDown className="size-4" />
          )}
          Load older
        </Button>
      ) : transactions.length > 0 ? (
        <p className="text-muted-foreground py-2 text-center text-xs">
          That&apos;s everything.
        </p>
      ) : null}
    </div>
  );
}
