"use client";

import { AlertTriangle, Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";

export type UpcomingBillDue = { amount: number; next_due_date: string };

const FORECAST_DAYS = 14;

// "Which bills fall due in the next 14 days" depends on what *today* is for
// the person looking at the screen. Computed on the server this was wrong in
// two ways: it got frozen into the prerendered shell, and it used the
// server's timezone rather than the viewer's, so bills could drop in or out
// of the window a few hours early or late.
//
// The forecast line simply doesn't render until mounted — showing a
// confidently wrong number would be worse than showing it a frame later.
function dueWithinWindow(bills: UpcomingBillDue[]): number {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + FORECAST_DAYS);

  return bills
    .filter((b) => new Date(`${b.next_due_date}T00:00:00`) <= cutoff)
    .reduce((sum, b) => sum + b.amount, 0);
}

export function NetWorthCard({
  netWorth,
  currency,
  upcomingBills,
}: {
  netWorth: number;
  currency: string;
  upcomingBills: UpcomingBillDue[];
}) {
  const isClient = useIsClient();
  const dueSoon = isClient ? dueWithinWindow(upcomingBills) : null;

  const projected = dueSoon === null ? netWorth : netWorth - dueSoon;
  const isLow = dueSoon !== null && dueSoon > 0 && projected < netWorth * 0.15;

  return (
    <Card className="glow-finance gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Net worth</p>
        <span className="bg-finance/15 text-finance flex size-8 items-center justify-center rounded-lg">
          <Wallet className="size-4" />
        </span>
      </div>
      <p className="text-finance text-3xl font-semibold tabular-nums">
        {formatCurrency(netWorth, currency)}
      </p>

      {dueSoon !== null && dueSoon > 0 ? (
        <div
          className={
            isLow
              ? "bg-warning/15 text-warning flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
              : "text-muted-foreground flex items-center gap-2 text-xs"
          }
        >
          {isLow ? <AlertTriangle className="size-3.5 shrink-0" /> : null}
          <span>
            {formatCurrency(dueSoon, currency)} in bills due in the next{" "}
            {FORECAST_DAYS} days — projected balance after:{" "}
            {formatCurrency(projected, currency)}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
