"use client";

import dynamic from "next/dynamic";
import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";
import { formatCurrency } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";
import type { Database, ExpenseCategory } from "@/lib/types/database.types";

const CategorySpendChart = dynamic(
  () =>
    import("@/components/wallet/category-spend-chart").then(
      (m) => m.CategorySpendChart
    ),
  { loading: () => <ChartSkeleton /> }
);

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

// "This month" means the viewer's month. Doing this on the server froze the
// result into the prerendered shell and evaluated it in the server's
// timezone, so on the first or last day of a month the totals could belong
// to the wrong one for anyone off UTC.
//
// Net worth is passed in already computed — it's a balance, not a
// time-window question, so it has no such problem and can render instantly.
export function MonthSummary({
  netWorth,
  transactions,
  accountIds,
  currency,
}: {
  netWorth: number;
  transactions: Transaction[];
  accountIds: string[];
  currency: string;
}) {
  const isClient = useIsClient();

  const stats = (() => {
    if (!isClient) return null;
    const now = new Date();
    const owned = new Set(accountIds);
    const scoped = transactions.filter((t) => {
      if (!owned.has(t.account_id)) return false;
      const d = new Date(t.transaction_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const totals = new Map<ExpenseCategory, number>();
    for (const t of scoped) {
      if (t.type === "EXPENSE" && t.category) {
        totals.set(t.category, (totals.get(t.category) ?? 0) + Math.abs(t.amount));
      }
    }

    return {
      income: scoped.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      expense: scoped
        .filter((t) => t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0),
      categories: CATEGORY_ORDER.map((c) => ({
        label: CATEGORY_META[c].label,
        amount: totals.get(c) ?? 0,
      }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    };
  })();

  const money = (v: number | undefined) =>
    v === undefined ? "—" : formatCurrency(v, currency);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Net worth"
          value={formatCurrency(netWorth, currency)}
          icon={<Wallet className="size-4" />}
          accent="finance"
        />
        <StatCard
          label="Month in"
          value={money(stats?.income)}
          icon={<TrendingUp className="size-4" />}
          accent="finance"
        />
        <StatCard
          label="Month out"
          value={money(stats?.expense)}
          icon={<TrendingDown className="size-4" />}
          accent="warning"
        />
      </div>

      {stats && stats.categories.length > 0 ? (
        <div className="border-border/60 bg-card rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-medium">Spending by category</h2>
          <CategorySpendChart data={stats.categories} />
        </div>
      ) : null}
    </>
  );
}
