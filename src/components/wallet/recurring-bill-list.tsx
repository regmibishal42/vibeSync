"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { deactivateRecurringBill } from "@/app/(app)/wallet/recurring-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_ICON } from "@/lib/wallet/account-type";
import { CATEGORY_META } from "@/lib/wallet/categories";
import type { Database } from "@/lib/types/database.types";

type RecurringBill = Database["public"]["Tables"]["recurring_bills"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

const FREQUENCY_LABEL: Record<RecurringBill["frequency"], string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
};

export function RecurringBillList({
  bills,
  accounts,
  currency,
}: {
  bills: RecurringBill[];
  accounts: Account[];
  currency: string;
}) {
  if (bills.length === 0) return null;

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-2">
      {bills.map((bill) => {
        const account = accountById.get(bill.account_id);
        const CategoryIcon = CATEGORY_META[bill.category].icon;
        const AccountIcon = account ? ACCOUNT_TYPE_ICON[account.account_type] : null;

        return (
          <Card key={bill.id} className="flex-row items-center gap-3 px-4 py-3">
            <span className="bg-finance/15 text-finance flex size-9 shrink-0 items-center justify-center rounded-lg">
              <CategoryIcon className="size-4" />
            </span>
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate font-medium">{bill.label}</span>
              <span className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                {AccountIcon ? <AccountIcon className="size-3 shrink-0" /> : null}
                {account?.account_name ?? "Unknown account"} ·{" "}
                {FREQUENCY_LABEL[bill.frequency]} ·{" "}
                {formatCurrency(bill.amount, currency)}
              </span>
            </div>
            <DeactivateButton billId={bill.id} />
          </Card>
        );
      })}
    </div>
  );
}

function DeactivateButton({ billId }: { billId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await deactivateRecurringBill(billId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recurring bill removed");
      router.refresh();
    });
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-8 shrink-0"
      disabled={isPending}
      onClick={handleClick}
      aria-label="Remove recurring bill"
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </Button>
  );
}
