import { AlertTriangle, Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export function NetWorthCard({
  netWorth,
  currency,
  upcomingBillsTotal,
}: {
  netWorth: number;
  currency: string;
  upcomingBillsTotal: number;
}) {
  const projected = netWorth - upcomingBillsTotal;
  const isLow = upcomingBillsTotal > 0 && projected < netWorth * 0.15;

  return (
    <Card className="glow-finance gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Net worth</p>
        <span className="bg-finance/15 text-finance flex size-8 items-center justify-center rounded-lg">
          <Wallet className="size-4" />
        </span>
      </div>
      <p className="text-finance text-3xl font-semibold">
        {formatCurrency(netWorth, currency)}
      </p>

      {upcomingBillsTotal > 0 ? (
        <div
          className={
            isLow
              ? "bg-warning/15 text-warning flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
              : "text-muted-foreground flex items-center gap-2 text-xs"
          }
        >
          {isLow ? <AlertTriangle className="size-3.5 shrink-0" /> : null}
          <span>
            {formatCurrency(upcomingBillsTotal, currency)} in bills due in the
            next 14 days — projected balance after: {formatCurrency(projected, currency)}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
