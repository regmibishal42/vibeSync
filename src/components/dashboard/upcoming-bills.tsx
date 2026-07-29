"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markRecurringTransactionPaid } from "@/app/(app)/wallet/recurring-actions";
import { formatCurrency, todayLocalISO } from "@/lib/format";
import { CATEGORY_META } from "@/lib/wallet/categories";
import type { ExpenseCategory, RecurringDirection } from "@/lib/types/database.types";

export type UpcomingBill = {
  id: string;
  label: string;
  category: ExpenseCategory | null;
  direction: RecurringDirection;
  amount: number;
  next_due_date: string;
  accountName: string;
};

function urgency(daysUntil: number): {
  label: string;
  variant: "destructive" | "warning" | "outline";
} {
  if (daysUntil < 0) {
    return { label: `Overdue by ${Math.abs(daysUntil)}d`, variant: "destructive" };
  }
  if (daysUntil === 0) {
    return { label: "Due today", variant: "warning" };
  }
  if (daysUntil <= 3) {
    return { label: `Due in ${daysUntil}d`, variant: "warning" };
  }
  return { label: `Due in ${daysUntil}d`, variant: "outline" };
}

export function UpcomingBillsWidget({
  bills,
  currency,
}: {
  bills: UpcomingBill[];
  currency: string;
}) {
  if (bills.length === 0) return null;

  const today = new Date(`${todayLocalISO()}T00:00:00`);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Upcoming</h2>
      <div className="flex flex-col gap-2">
        {bills.map((bill) => {
          const isIncome = bill.direction === "INCOME";
          const Icon = bill.category ? CATEGORY_META[bill.category].icon : TrendingUp;
          const daysUntil = differenceInCalendarDays(
            new Date(`${bill.next_due_date}T00:00:00`),
            today
          );
          const { label, variant } = urgency(daysUntil);

          return (
            <Card key={bill.id} className="flex-row items-center gap-3 px-4 py-3">
              <span
                className={
                  isIncome
                    ? "bg-shift/15 text-shift flex size-9 shrink-0 items-center justify-center rounded-lg"
                    : "bg-warning/15 text-warning flex size-9 shrink-0 items-center justify-center rounded-lg"
                }
              >
                <Icon className="size-4" />
              </span>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate font-medium">{bill.label}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {bill.accountName} · {isIncome ? "+" : "−"}
                  {formatCurrency(bill.amount, currency)}
                </span>
              </div>
              <Badge variant={variant}>{label}</Badge>
              <MarkPaidButton billId={bill.id} />
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function MarkPaidButton({ billId }: { billId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await markRecurringTransactionPaid(billId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marked paid");
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={handleClick}>
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Mark paid"}
    </Button>
  );
}
