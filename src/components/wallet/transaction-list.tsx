import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Database } from "@/lib/types/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function TransactionList({
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
  if (transactions.length === 0) {
    return (
      <Card className="items-center justify-center py-10 text-center">
        <Receipt className="text-muted-foreground mx-auto size-8" />
        <p className="text-muted-foreground px-4 text-sm">
          No transactions yet.
        </p>
      </Card>
    );
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-3">
      {transactions.map((tx) => {
        const isInflow = tx.amount >= 0;
        const account = accountById.get(tx.account_id);
        const currency =
          (account && currencyByUserId.get(account.user_id)) ?? fallbackCurrency;

        return (
          <Card key={tx.id} className="gap-1 py-3">
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
                  {tx.merchant_or_item || tx.category || tx.type}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {account?.account_name ?? "Unknown account"}
                  {tx.category ? ` · ${tx.category}` : ""}
                </span>
              </div>
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
            </div>
          </Card>
        );
      })}
    </div>
  );
}
