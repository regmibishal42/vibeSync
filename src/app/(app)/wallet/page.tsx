import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Wallet, TrendingDown, TrendingUp } from "lucide-react";
import { Suspense } from "react";

import {
  getWalletAccountsData,
  getWalletTransactionsData,
  getWalletMonthTransactionsData,
  getRecurringBillsData,
  type TransactionFilters as TransactionFiltersType,
} from "@/app/(app)/wallet/data";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { AccountCard } from "@/components/wallet/account-card";
import { AccountForm } from "@/components/wallet/account-form";
import { TransactionForm } from "@/components/wallet/transaction-form";
import { ConnectedTransactionList } from "@/components/wallet/connected-transaction-list";
import { TransactionsProvider } from "@/components/wallet/transactions-provider";
import { TransactionFilters } from "@/components/wallet/transaction-filters";
import { RecurringBillForm } from "@/components/wallet/recurring-bill-form";
import { RecurringBillList } from "@/components/wallet/recurring-bill-list";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";
import { formatCurrency } from "@/lib/format";
import type { ExpenseCategory } from "@/lib/types/database.types";

const BalanceChart = dynamic(
  () => import("@/components/wallet/balance-chart").then((m) => m.BalanceChart),
  { loading: () => <ChartSkeleton /> }
);
const CategorySpendChart = dynamic(
  () =>
    import("@/components/wallet/category-spend-chart").then((m) => m.CategorySpendChart),
  { loading: () => <ChartSkeleton /> }
);

export const metadata: Metadata = { title: "Wallet" };

type WalletSearchParams = {
  quick?: string;
  category?: string;
  from?: string;
  to?: string;
  q?: string;
};

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function WalletPage({
  searchParams,
}: {
  searchParams: Promise<WalletSearchParams>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="text-muted-foreground text-sm">
          Every account, one real-time ledger.
        </p>
      </div>

      <TransactionsProvider>
        <Suspense fallback={<WalletSummarySkeleton />}>
          <WalletSummary searchParams={searchParams} />
        </Suspense>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Recurring bills</h2>
          <Suspense fallback={<ListSkeleton rows={2} />}>
            <WalletRecurringBills />
          </Suspense>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Recent transactions</h2>
          <TransactionFilters />
          <Suspense fallback={<ListSkeleton />}>
            <WalletTransactions searchParams={searchParams} />
          </Suspense>
        </section>
      </TransactionsProvider>
    </div>
  );
}

async function WalletSummary({
  searchParams,
}: {
  searchParams: Promise<WalletSearchParams>;
}) {
  const { quick } = await searchParams;
  const { profile, user, accounts, profiles } = await getWalletAccountsData();

  const currency = profile?.currency_preference ?? "AUD";
  const isAdmin = profile?.role === "ADMIN";

  // Accounts don't carry their own currency column — each one's currency is
  // implicitly its owner's profile.currency_preference. Needed so the ADMIN
  // (who can see the PARTNER's accounts too) doesn't render her AUD amounts
  // with an NPR label just because the viewer's own currency is NPR.
  const currencyByUserId = new Map(profiles.map((p) => [p.id, p.currency_preference]));

  const ownAccounts = accounts.filter((a) => a.user_id === user?.id);
  const myAccounts = ownAccounts.filter((a) => !a.is_parent_account);
  const parentAccounts = ownAccounts.filter((a) => a.is_parent_account);
  const otherAccounts = accounts.filter((a) => a.user_id !== user?.id);

  // Net worth / month in / month out are scoped to the viewer's own
  // accounts only — summing balances across the ADMIN's NPR accounts and
  // the PARTNER's AUD accounts into one number would be financially
  // meaningless without an FX conversion this app doesn't do.
  const ownAccountIds = new Set(ownAccounts.map((a) => a.id));
  // Unbounded-by-recency (unlike the 50-row "recent transactions" list) so
  // month stats and the category chart below don't silently under-count
  // once monthly volume exceeds 50.
  const monthTransactions = await getWalletMonthTransactionsData();
  const ownMonthTx = monthTransactions
    .filter((t) => ownAccountIds.has(t.account_id))
    .filter((t) => isThisMonth(t.transaction_date));

  const netWorth = ownAccounts.reduce((sum, a) => sum + a.current_balance, 0);
  const monthIncome = ownMonthTx
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = ownMonthTx
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const chartData = ownAccounts.map((a) => ({
    name: a.account_name,
    balance: a.current_balance,
  }));

  // Magnitude comparison ("which category did we spend most on"), so a
  // single-hue sorted bar chart is the right form here — same as
  // BalanceChart above, not a pie/donut, and no per-category multi-hue
  // palette (11 categories is already past a reasonable categorical size).
  const categoryTotals = new Map<ExpenseCategory, number>();
  ownMonthTx
    .filter((t) => t.type === "EXPENSE" && t.category)
    .forEach((t) => {
      const category = t.category as ExpenseCategory;
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + Math.abs(t.amount));
    });
  const categoryChartData = CATEGORY_ORDER.map((c) => ({
    label: CATEGORY_META[c].label,
    amount: categoryTotals.get(c) ?? 0,
  }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount);

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
          value={formatCurrency(monthIncome, currency)}
          icon={<TrendingUp className="size-4" />}
          accent="finance"
        />
        <StatCard
          label="Month out"
          value={formatCurrency(monthExpense, currency)}
          icon={<TrendingDown className="size-4" />}
          accent="warning"
        />
      </div>

      {ownAccounts.length > 0 ? (
        <div className="border-border/60 bg-card rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-medium">Balances</h2>
          <BalanceChart data={chartData} />
        </div>
      ) : null}

      {categoryChartData.length > 0 ? (
        <div className="border-border/60 bg-card rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-medium">Spending by category</h2>
          <CategorySpendChart data={categoryChartData} />
        </div>
      ) : null}

      <div className="flex gap-2">
        <AccountForm isAdmin={isAdmin} />
        <TransactionForm accounts={accounts} defaultOpen={quick === "expense"} />
      </div>

      {myAccounts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">My accounts</h2>
          {myAccounts.map((a) => (
            <AccountCard key={a.id} account={a} currency={currency} />
          ))}
        </section>
      ) : null}

      {parentAccounts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Parents&apos; accounts</h2>
          {parentAccounts.map((a) => (
            <AccountCard key={a.id} account={a} currency={currency} />
          ))}
        </section>
      ) : null}

      {otherAccounts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            {isAdmin ? "Partner's accounts" : "Shared accounts"}
          </h2>
          {otherAccounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              currency={currencyByUserId.get(a.user_id) ?? currency}
            />
          ))}
        </section>
      ) : null}
    </>
  );
}

async function WalletRecurringBills() {
  const [{ accounts, user, profile }, bills] = await Promise.all([
    getWalletAccountsData(),
    getRecurringBillsData(),
  ]);
  const currency = profile?.currency_preference ?? "AUD";

  const ownAccounts = accounts.filter((a) => a.user_id === user?.id);
  const myBills = bills.filter((b) => b.user_id === user?.id);
  const otherBills = bills.filter((b) => b.user_id !== user?.id);

  return (
    <>
      <RecurringBillForm accounts={ownAccounts} />
      <RecurringBillList bills={myBills} accounts={accounts} currency={currency} />
      {otherBills.length > 0 ? (
        <RecurringBillList bills={otherBills} accounts={accounts} currency={currency} />
      ) : null}
    </>
  );
}

async function WalletTransactions({
  searchParams,
}: {
  searchParams: Promise<WalletSearchParams>;
}) {
  const { category, from, to, q } = await searchParams;
  const filters: TransactionFiltersType = {
    category: category && CATEGORY_ORDER.includes(category as ExpenseCategory)
      ? (category as ExpenseCategory)
      : undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };

  const [{ accounts, profile, profiles }, transactions] = await Promise.all([
    getWalletAccountsData(),
    getWalletTransactionsData(filters),
  ]);
  const currency = profile?.currency_preference ?? "AUD";
  const currencyByUserId = new Map(profiles.map((p) => [p.id, p.currency_preference]));

  return (
    <ConnectedTransactionList
      transactions={transactions}
      accounts={accounts}
      currencyByUserId={currencyByUserId}
      fallbackCurrency={currency}
    />
  );
}

function WalletSummarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatGridSkeleton count={3} columns={3} />
      <ChartSkeleton />
      <div className="flex gap-2">
        <div className="bg-muted h-12 w-32 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 w-40 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
