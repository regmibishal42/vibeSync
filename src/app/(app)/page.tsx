import { Suspense } from "react";
import Link from "next/link";
import { Briefcase, HandCoins, Wallet } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";

import {
  getDashboardAccountsData,
  getDashboardTransactionsData,
  getDashboardJobsData,
  getDashboardRecurringData,
  getDashboardLoanBalancesData,
} from "@/app/(app)/data";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { PeriodBreakdown, type PeriodStats } from "@/components/dashboard/period-breakdown";
import { UpcomingBillsWidget, type UpcomingBill } from "@/components/dashboard/upcoming-bills";
import { BillNotifications } from "@/components/dashboard/bill-notifications";
import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { Card } from "@/components/ui/card";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";
import { formatCurrency, todayLocalISO } from "@/lib/format";
import { isInPeriod, type Period } from "@/lib/dashboard";
import type { Database, ExpenseCategory } from "@/lib/types/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type JobShift = Database["public"]["Tables"]["job_shifts"]["Row"];
type Job = Database["public"]["Tables"]["jobs"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function buildPeriodStats(
  period: Period,
  transactions: Transaction[],
  shifts: JobShift[],
  jobs: Job[],
  accounts: Account[],
  ownUserId: string
): PeriodStats {
  // Same parent-account exclusion as net worth above: flows through an
  // account held for a parent aren't this user's own income/spending.
  const ownAccountIds = new Set(
    accounts
      .filter((a) => a.user_id === ownUserId && !a.is_parent_account)
      .map((a) => a.id)
  );
  const periodTx = transactions.filter(
    (t) => ownAccountIds.has(t.account_id) && isInPeriod(t.transaction_date, period)
  );

  const income = periodTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = periodTx
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const categoryTotals = new Map<ExpenseCategory, number>();
  periodTx
    .filter((t) => t.type === "EXPENSE" && t.category)
    .forEach((t) => {
      const c = t.category as ExpenseCategory;
      categoryTotals.set(c, (categoryTotals.get(c) ?? 0) + Math.abs(t.amount));
    });
  const categoryData = CATEGORY_ORDER.map((c) => ({
    label: CATEGORY_META[c].label,
    amount: categoryTotals.get(c) ?? 0,
  }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const bankTotals = new Map<string, number>();
  periodTx.forEach((t) => {
    const account = accountById.get(t.account_id);
    if (!account) return;
    bankTotals.set(
      account.account_name,
      Math.round(((bankTotals.get(account.account_name) ?? 0) + t.amount) * 100) / 100
    );
  });
  const bankData = [...bankTotals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .filter((d) => d.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  const ownJobs = jobs.filter((j) => j.user_id === ownUserId);
  const jobById = new Map(ownJobs.map((j) => [j.id, j]));
  const jobTotals = new Map<string, number>();
  shifts
    .filter((s) => s.user_id === ownUserId && isInPeriod(s.shift_date, period))
    .forEach((s) => {
      const job = jobById.get(s.job_id);
      if (!job) return;
      jobTotals.set(job.name, (jobTotals.get(job.name) ?? 0) + s.calculated_pay);
    });
  periodTx
    .filter((t) => t.type === "DEPOSIT" && t.job_id)
    .forEach((t) => {
      const job = jobById.get(t.job_id!);
      if (!job) return;
      jobTotals.set(job.name, (jobTotals.get(job.name) ?? 0) + t.amount);
    });
  const jobData = [...jobTotals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return { income, expense, categoryData, bankData, jobData };
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<HeroSkeleton />}>
        <HomeHero />
      </Suspense>

      <Suspense fallback={<PeriodSkeleton />}>
        <PeriodSection />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={2} />}>
        <UpcomingSection />
      </Suspense>

      <QuickLinks />
    </div>
  );
}

async function HomeHero() {
  const [{ profile, user, accounts }, recurring] = await Promise.all([
    getDashboardAccountsData(),
    getDashboardRecurringData(),
  ]);
  const currency = profile?.currency_preference ?? "AUD";
  // Parent accounts are money this user *administers*, not money they own —
  // the wallet page has always listed them as their own separate section, so
  // folding them into "Net worth" would silently overstate it.
  const ownAccounts = accounts.filter(
    (a) => a.user_id === user?.id && !a.is_parent_account
  );
  const netWorth = ownAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  const today = todayLocalISO();
  const upcomingBillsTotal = recurring
    .filter((r) => r.direction === "EXPENSE")
    .filter((r) => differenceInCalendarDays(new Date(`${r.next_due_date}T00:00:00`), new Date(`${today}T00:00:00`)) <= 14)
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div>
      <div className="mb-4">
        <p className="text-muted-foreground text-sm">{greeting()},</p>
        <h1 className="text-2xl font-semibold">{profile?.full_name}</h1>
      </div>

      <NetWorthCard netWorth={netWorth} currency={currency} upcomingBillsTotal={upcomingBillsTotal} />
    </div>
  );
}

async function PeriodSection() {
  const [{ profile, user, accounts }, transactions, { jobs, shifts }] = await Promise.all([
    getDashboardAccountsData(),
    getDashboardTransactionsData(),
    getDashboardJobsData(),
  ]);
  const currency = profile?.currency_preference ?? "AUD";

  if (!user) return null;

  const week = buildPeriodStats("week", transactions, shifts, jobs, accounts, user.id);
  const month = buildPeriodStats("month", transactions, shifts, jobs, accounts, user.id);

  return <PeriodBreakdown week={week} month={month} currency={currency} />;
}

async function UpcomingSection() {
  const [{ profile, accounts }, recurring, loanBalances] = await Promise.all([
    getDashboardAccountsData(),
    getDashboardRecurringData(),
    getDashboardLoanBalancesData(),
  ]);
  const currency = profile?.currency_preference ?? "AUD";
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const upcoming: UpcomingBill[] = recurring.slice(0, 5).map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
    direction: r.direction,
    amount: r.amount,
    next_due_date: r.next_due_date,
    accountName: accountById.get(r.account_id)?.account_name ?? "Unknown account",
  }));

  const openLoans = loanBalances
    .filter((b) => Math.abs(b.net_outstanding) > 0.01)
    .sort((a, b) => Math.abs(b.net_outstanding) - Math.abs(a.net_outstanding))
    .slice(0, 3);

  return (
    <>
      <UpcomingBillsWidget bills={upcoming} currency={currency} />
      <BillNotifications bills={upcoming} />

      {openLoans.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Loans</h2>
          <Link href="/loans" className="flex flex-col gap-2">
            {openLoans.map((b) => (
              <Card key={b.counterparty_name} className="flex-row items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{b.counterparty_name}</span>
                <span className={b.net_outstanding > 0 ? "text-shift text-sm font-semibold" : "text-warning text-sm font-semibold"}>
                  {b.net_outstanding > 0 ? "owes you " : "you owe "}
                  {formatCurrency(Math.abs(b.net_outstanding), currency)}
                </span>
              </Card>
            ))}
          </Link>
        </section>
      ) : null}
    </>
  );
}

function QuickLinks() {
  return (
    <section className="grid grid-cols-3 gap-3">
      <Link
        href="/work"
        className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-4"
      >
        <span className="bg-shift/15 text-shift flex size-9 items-center justify-center rounded-lg">
          <Briefcase className="size-4" />
        </span>
        <span className="text-sm font-medium">Work</span>
      </Link>
      <Link
        href="/wallet"
        className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-4"
      >
        <span className="bg-finance/15 text-finance flex size-9 items-center justify-center rounded-lg">
          <Wallet className="size-4" />
        </span>
        <span className="text-sm font-medium">Wallet</span>
      </Link>
      <Link
        href="/loans"
        className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-4"
      >
        <span className="bg-fitness/15 text-fitness flex size-9 items-center justify-center rounded-lg">
          <HandCoins className="size-4" />
        </span>
        <span className="text-sm font-medium">Loans</span>
      </Link>
    </section>
  );
}

function HeroSkeleton() {
  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
        <div className="bg-muted h-7 w-40 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-28 w-full animate-pulse rounded-2xl" />
    </div>
  );
}

function PeriodSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted mx-auto h-10 w-full max-w-xs animate-pulse rounded-full" />
      <StatGridSkeleton count={2} columns={2} />
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  );
}
