import { TrendingDown, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { RankedBarChart } from "@/components/dashboard/ranked-bar-chart";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_META } from "@/lib/wallet/categories";
import type { DashboardSummary } from "@/app/(app)/data";
import type { ExpenseCategory } from "@/lib/types/database.types";

// The summary arrives pre-aggregated from Postgres (see dashboard_summary in
// 0013_strict_isolation.sql), so this is purely presentational — no reducing
// over a raw ledger, which is what made the year-long ranges affordable.
export function PeriodBreakdown({
  summary,
  currency,
}: {
  summary: DashboardSummary;
  currency: string;
}) {
  // SQL returns the raw enum value; labels/icons stay defined in one place
  // on the client so they can't drift from the rest of the UI.
  const categoryData = summary.byCategory.map((row) => ({
    label: CATEGORY_META[row.label as ExpenseCategory]?.label ?? row.label,
    amount: Number(row.amount),
  }));
  const accountData = summary.byAccount.map((row) => ({
    label: row.label,
    amount: Number(row.amount),
  }));
  const jobData = summary.byJob.map((row) => ({
    label: row.label,
    amount: Number(row.amount),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Money in"
          value={formatCurrency(Number(summary.income), currency)}
          icon={<TrendingUp className="size-4" />}
          accent="finance"
        />
        <StatCard
          label="Money out"
          value={formatCurrency(Number(summary.expense), currency)}
          icon={<TrendingDown className="size-4" />}
          accent="warning"
        />
      </div>

      <div className="border-border/60 bg-card rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">Top spending</h2>
        <RankedBarChart
          data={categoryData}
          color="var(--finance)"
          valueLabel="Spent"
          emptyMessage="No expenses in this range."
        />
      </div>

      <div className="border-border/60 bg-card rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">By bank / account</h2>
        <RankedBarChart
          data={accountData}
          color="var(--shift)"
          valueLabel="Net flow"
          emptyMessage="No account activity in this range."
        />
      </div>

      {jobData.length > 0 ? (
        <div className="border-border/60 bg-card rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-medium">By job</h2>
          <RankedBarChart
            data={jobData}
            color="var(--fitness)"
            valueLabel="Earned"
            emptyMessage="No job income in this range."
          />
        </div>
      ) : null}
    </div>
  );
}
