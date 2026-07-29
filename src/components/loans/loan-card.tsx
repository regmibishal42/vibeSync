import { HandCoins } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RepayForm } from "@/components/loans/repay-form";
import { formatCurrency, todayLocalISO } from "@/lib/format";
import type { AccountType, Database } from "@/lib/types/database.types";

type Loan = Database["public"]["Tables"]["loans"]["Row"];
type LoanAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_type: AccountType;
};

export function LoanCard({
  loan,
  repaid,
  currency,
  accounts,
}: {
  loan: Loan;
  repaid: number;
  currency: string;
  accounts: LoanAccount[];
}) {
  const remaining = Math.max(loan.principal_amount - repaid, 0);
  const isOverdue =
    !loan.is_settled && !!loan.due_date && loan.due_date < todayLocalISO();

  return (
    <Card className="gap-2 py-4">
      <div className="flex items-start justify-between px-4">
        <div className="flex flex-col">
          <span className="font-medium">{loan.counterparty_name}</span>
          <span className="text-muted-foreground text-xs">
            {loan.direction === "LENT" ? "You lent" : "You borrowed"} ·{" "}
            {new Date(`${loan.loan_date}T00:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {loan.due_date
              ? ` · due ${new Date(`${loan.due_date}T00:00:00`).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}`
              : ""}
          </span>
          {loan.notes ? (
            <span className="text-muted-foreground mt-1 text-xs">{loan.notes}</span>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={loan.direction === "LENT" ? "text-shift font-semibold" : "text-warning font-semibold"}>
            {formatCurrency(loan.principal_amount, currency)}
          </span>
          {loan.is_settled ? (
            <Badge variant="finance">Settled</Badge>
          ) : isOverdue ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : (
            <Badge variant="warning">
              {formatCurrency(remaining, currency)} left
            </Badge>
          )}
        </div>
      </div>

      {!loan.is_settled ? (
        <div className="px-4">
          <RepayForm
            loanId={loan.id}
            remaining={remaining}
            currency={currency}
            defaultAccountId={loan.account_id}
            accounts={accounts.filter((a) => a.user_id === loan.user_id)}
          />
        </div>
      ) : null}
    </Card>
  );
}

export function LoanEmptyState() {
  return (
    <Card className="items-center justify-center py-10 text-center">
      <HandCoins className="text-muted-foreground mx-auto size-8" />
      <p className="text-muted-foreground px-4 text-sm">
        Nothing lent or borrowed yet.
      </p>
    </Card>
  );
}
