import type { Metadata } from "next";
import { Suspense } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { getLoansData } from "@/app/(app)/loans/data";
import { getCurrentUser } from "@/lib/supabase/profile";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { LoanForm } from "@/components/loans/loan-form";
import { LoanCard, LoanEmptyState } from "@/components/loans/loan-card";
import { CounterpartySummary } from "@/components/loans/counterparty-summary";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Loans" };

export default function LoansPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Loans</h1>
        <p className="text-muted-foreground text-sm">
          Money lent to friends, and money borrowed from them.
        </p>
      </div>

      <Suspense fallback={<LoansSummarySkeleton />}>
        <LoansSummary />
      </Suspense>
    </div>
  );
}

async function LoansSummary() {
  const [{ profile, loans, repayments, balances, accounts }, user] = await Promise.all([
    getLoansData(),
    getCurrentUser(),
  ]);
  const currency = profile?.currency_preference ?? "AUD";

  const repaidByLoan = new Map<string, number>();
  for (const r of repayments) {
    repaidByLoan.set(r.loan_id, (repaidByLoan.get(r.loan_id) ?? 0) + r.amount);
  }

  const owedToYou = balances
    .filter((b) => b.net_outstanding > 0)
    .reduce((sum, b) => sum + b.net_outstanding, 0);
  const youOwe = balances
    .filter((b) => b.net_outstanding < 0)
    .reduce((sum, b) => sum + Math.abs(b.net_outstanding), 0);

  const myLoans = loans.filter((l) => l.user_id === user?.id);
  const otherLoans = loans.filter((l) => l.user_id !== user?.id);
  const myAccounts = accounts.filter((a) => a.user_id === user?.id);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Owed to you"
          value={formatCurrency(owedToYou, currency)}
          icon={<TrendingUp className="size-4" />}
          accent="shift"
        />
        <StatCard
          label="You owe"
          value={formatCurrency(youOwe, currency)}
          icon={<TrendingDown className="size-4" />}
          accent="warning"
        />
      </div>

      <CounterpartySummary balances={balances} currency={currency} />

      <LoanForm accounts={myAccounts} />

      {myLoans.length === 0 && otherLoans.length === 0 ? (
        <LoanEmptyState />
      ) : (
        <>
          {myLoans.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium">Your loans</h2>
              {myLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  repaid={repaidByLoan.get(loan.id) ?? 0}
                  currency={currency}
                  accounts={accounts}
                />
              ))}
            </section>
          ) : null}

          {otherLoans.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium">Partner&apos;s loans</h2>
              {otherLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  repaid={repaidByLoan.get(loan.id) ?? 0}
                  currency={currency}
                  accounts={accounts}
                />
              ))}
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function LoansSummarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatGridSkeleton count={2} columns={2} />
      <ListSkeleton rows={2} />
    </div>
  );
}
