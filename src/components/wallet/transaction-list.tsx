import { ArrowDownLeft, ArrowUpRight, Loader2, Receipt } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_ICON } from "@/lib/wallet/account-type";
import { CATEGORY_META } from "@/lib/wallet/categories";
import { DeleteTransactionButton } from "@/components/wallet/delete-transaction-button";
import type { Database } from "@/lib/types/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  _pending?: true;
};
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function TransactionList({
  transactions,
  accounts,
  currency,
  onDeleted,
}: {
  transactions: Transaction[];
  accounts: Account[];
  currency: string;
  onDeleted?: () => void;
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        accent="finance"
        title="No transactions yet"
        description="Every expense, deposit and transfer lands here, newest first."
        hint="Tap + at the bottom to add one — amount first, two taps done."
      />
    );
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-3">
      {transactions.map((tx) => {
        const isInflow = tx.amount >= 0;
        const account = accountById.get(tx.account_id);
        const AccountIcon = account ? ACCOUNT_TYPE_ICON[account.account_type] : null;

        return (
          <Card key={tx.id} className={cn("gap-1 py-3", tx._pending && "opacity-60")}>
            <div className="flex items-center gap-3 px-4">
              <span
                className={
                  isInflow
                    ? "bg-finance/15 text-finance flex size-9 shrink-0 items-center justify-center rounded-lg"
                    : "bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
                }
              >
                {isInflow ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </span>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate font-medium">
                  {tx.merchant_or_item || (tx.category ? CATEGORY_META[tx.category].label : tx.type)}
                </span>
                <span className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                  {AccountIcon ? <AccountIcon className="size-3 shrink-0" /> : null}
                  <span className="truncate">
                    {account?.account_name ?? "Unknown account"}
                    {tx.category ? ` · ${CATEGORY_META[tx.category].label}` : ""}
                  </span>
                </span>
              </div>
              {tx._pending ? (
                <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
              ) : (
                <>
                  <span
                    className={
                      isInflow
                        ? "text-finance shrink-0 font-semibold"
                        : "text-foreground shrink-0 font-semibold"
                    }
                  >
                    {isInflow ? "+" : "−"}
                    {formatCurrency(Math.abs(tx.amount), currency)}
                  </span>
                  <DeleteTransactionButton
                    transactionId={tx.id}
                    type={tx.type}
                    amount={tx.amount}
                    label={
                      tx.merchant_or_item ||
                      (tx.category ? CATEGORY_META[tx.category].label : tx.type)
                    }
                    currency={currency}
                    onDeleted={onDeleted}
                  />
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
