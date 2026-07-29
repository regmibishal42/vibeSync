import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Database } from "@/lib/types/database.types";

type LoanBalance = Database["public"]["Views"]["loan_balances"]["Row"];

// Per-counterparty net position across every loan with them — positive
// means they owe you net, negative means you owe them net (see the
// loan_balances view in 0011_loans.sql).
export function CounterpartySummary({
  balances,
  currency,
}: {
  balances: LoanBalance[];
  currency: string;
}) {
  const open = balances
    .filter((b) => Math.abs(b.net_outstanding) > 0.01)
    .sort((a, b) => Math.abs(b.net_outstanding) - Math.abs(a.net_outstanding));

  if (open.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {open.map((b) => (
        <Card key={b.counterparty_name} className="gap-1 py-3">
          <div className="flex items-center justify-between px-4">
            <span className="text-sm font-medium">{b.counterparty_name}</span>
            <span className={b.net_outstanding > 0 ? "text-shift text-sm font-semibold" : "text-warning text-sm font-semibold"}>
              {formatCurrency(Math.abs(b.net_outstanding), currency)}
            </span>
          </div>
          <p className="text-muted-foreground px-4 text-xs">
            {b.net_outstanding > 0 ? "owes you" : "you owe"}
          </p>
        </Card>
      ))}
    </div>
  );
}
