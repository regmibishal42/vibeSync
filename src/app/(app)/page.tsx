import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Briefcase, HandCoins, Wallet } from "lucide-react";

import {
  getDashboardAccountsData,
  getDashboardSummary,
  getDashboardRecurringData,
  getDashboardLoanBalancesData,
} from "@/app/(app)/data";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { Greeting } from "@/components/dashboard/greeting";
import { PeriodBreakdown } from "@/components/dashboard/period-breakdown";
import { RangePicker } from "@/components/dashboard/range-picker";
import { UpcomingBillsWidget, type UpcomingBill } from "@/components/dashboard/upcoming-bills";
import { BillNotifications } from "@/components/dashboard/bill-notifications";
import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import {
  RANGE_ORDER,
  formatRangeLabel,
  resolveRange,
  type RangeKey,
} from "@/lib/dashboard";

// Validated at build time to produce an instant static shell on client
// navigation. `runtime` rather than `static` because this route reads
// searchParams (the range picker) — the sample below is the default entry,
// no params, which is what a tab switch actually hits.
type HomeSearchParams = { range?: string; from?: string; to?: string };

function parseRangeKey(raw: string | undefined): RangeKey {
  return RANGE_ORDER.includes(raw as RangeKey) ? (raw as RangeKey) : "month";
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<HeroSkeleton />}>
        <HomeHero />
      </Suspense>

      <Suspense fallback={<PeriodSkeleton />}>
        <PeriodSection searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ListSkeleton rows={2} />}>
        <UpcomingSection />
      </Suspense>

      <QuickLinks />
    </div>
  );
}

async function HomeHero() {
  const [{ profile, accounts }, recurring] = await Promise.all([
    getDashboardAccountsData(),
    getDashboardRecurringData(),
  ]);
  const currency = profile?.currency_preference ?? "AUD";

  // Parent accounts are money this user administers, not money they own —
  // the wallet lists them as their own section, so folding them into net
  // worth would overstate it.
  const ownAccounts = accounts.filter((a) => !a.is_parent_account);
  const netWorth = ownAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Which of these fall inside the forecast window is decided client-side,
  // against the viewer's own clock — see NetWorthCard.
  const upcomingBills = recurring
    .filter((r) => r.direction === "EXPENSE")
    .map((r) => ({ amount: r.amount, next_due_date: r.next_due_date }));

  return (
    <div>
      <div className="mb-4">
        <Greeting />
        <h1 className="text-2xl font-semibold">{profile?.full_name}</h1>
      </div>

      <NetWorthCard
        netWorth={netWorth}
        currency={currency}
        upcomingBills={upcomingBills}
      />
    </div>
  );
}

async function PeriodSection({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const { range, from, to } = await searchParams;
  const rangeKey = parseRangeKey(range);

  // Presets ("this week", "this month") need to know what *now* is, which
  // makes this request-time work — `connection()` is the sanctioned way to
  // say so. It only marks this section dynamic, and it already streams
  // behind <Suspense>, so the page shell stays instant on tab switch.
  //
  // Caveat worth knowing: "now" here is the server's clock, so a preset's
  // boundary can sit a few hours off for a viewer far from UTC. Only
  // transactions right at the edge of a range are affected; picking an
  // explicit custom range side-steps it entirely.
  await connection();
  const resolved = resolveRange(rangeKey, new Date(), from, to);

  const [{ profile }, summary] = await Promise.all([
    getDashboardAccountsData(),
    getDashboardSummary(resolved.from.toISOString(), resolved.to.toISOString()),
  ]);
  const currency = profile?.currency_preference ?? "AUD";

  return (
    <div className="flex flex-col gap-4">
      <RangePicker active={rangeKey} rangeLabel={formatRangeLabel(resolved)} />
      <PeriodBreakdown summary={summary} currency={currency} />
    </div>
  );
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
              <Card
                key={b.counterparty_name}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-medium">{b.counterparty_name}</span>
                <span
                  className={
                    b.net_outstanding > 0
                      ? "text-shift text-sm font-semibold"
                      : "text-warning text-sm font-semibold"
                  }
                >
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
      <div className="bg-muted h-10 w-full animate-pulse rounded-full" />
      <StatGridSkeleton count={2} columns={2} />
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  );
}
