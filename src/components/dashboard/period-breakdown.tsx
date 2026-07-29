"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { RankedBarChart } from "@/components/dashboard/ranked-bar-chart";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/dashboard";

export type PeriodStats = {
  income: number;
  expense: number;
  categoryData: { label: string; amount: number }[];
  bankData: { label: string; amount: number }[];
  jobData: { label: string; amount: number }[];
};

// Both periods are pre-computed server-side (cheap array filtering) and
// handed to this one client component — the toggle just switches which
// already-fetched dataset feeds the charts, no network round trip.
export function PeriodBreakdown({
  week,
  month,
  currency,
}: {
  week: PeriodStats;
  month: PeriodStats;
  currency: string;
}) {
  const [period, setPeriod] = useState<Period>("month");
  const data = period === "week" ? week : month;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted mx-auto grid w-full max-w-xs grid-cols-2 gap-1 rounded-full p-1">
        {(["week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-full py-2 text-sm font-medium capitalize transition-colors",
              period === p ? "bg-card shadow-sm" : "text-muted-foreground"
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={`${period === "week" ? "Week" : "Month"} in`}
          value={formatCurrency(data.income, currency)}
          icon={<TrendingUp className="size-4" />}
          accent="finance"
        />
        <StatCard
          label={`${period === "week" ? "Week" : "Month"} out`}
          value={formatCurrency(data.expense, currency)}
          icon={<TrendingDown className="size-4" />}
          accent="warning"
        />
      </div>

      <div className="border-border/60 bg-card rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">Top spending</h2>
        <RankedBarChart
          data={data.categoryData}
          color="var(--finance)"
          valueLabel="Spent"
          emptyMessage="No expenses logged in this period yet."
        />
      </div>

      <div className="border-border/60 bg-card rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">By bank / account</h2>
        <RankedBarChart
          data={data.bankData}
          color="var(--shift)"
          valueLabel="Net flow"
          emptyMessage="No activity on any account in this period yet."
        />
      </div>

      {data.jobData.length > 0 ? (
        <div className="border-border/60 bg-card rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-medium">By job</h2>
          <RankedBarChart
            data={data.jobData}
            color="var(--fitness)"
            valueLabel="Earned"
            emptyMessage="No job income in this period yet."
          />
        </div>
      ) : null}
    </div>
  );
}
