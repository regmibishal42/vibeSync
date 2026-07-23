import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Dumbbell,
  HandCoins,
  Wallet,
} from "lucide-react";

import {
  getHomeAccountsData,
  getHomeActivityData,
  getHomeUpcomingBillsData,
} from "@/app/(app)/data";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { UpcomingBillsWidget } from "@/components/dashboard/upcoming-bills";
import { BillNotifications } from "@/components/dashboard/bill-notifications";
import { formatCurrency } from "@/lib/format";

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isThisWeek(iso: string) {
  const date = new Date(iso);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return date >= weekAgo;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<HeroSkeleton />}>
        <HomeHero />
      </Suspense>
      <Suspense fallback={<StatGridSkeleton count={2} columns={2} />}>
        <HomeStats />
      </Suspense>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <HomeBills />
      </Suspense>
      <Suspense fallback={<QuickLinksSkeleton />}>
        <QuickLinks />
      </Suspense>
    </div>
  );
}

async function HomeHero() {
  const { profile, user, accounts } = await getHomeAccountsData();
  const isAdmin = profile?.role === "ADMIN";
  const currency = profile?.currency_preference ?? "AUD";

  const ownAccounts = accounts.filter((a) => a.user_id === user?.id);
  const netWorth = ownAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  let partnerMonthEarnings = 0;
  if (!isAdmin) {
    const { hotelShifts, secondaryShifts } = await getHomeActivityData();
    const monthHotel = hotelShifts.filter((s) => isThisMonth(s.shift_date));
    const monthSecondary = secondaryShifts.filter((s) => isThisMonth(s.shift_date));
    partnerMonthEarnings =
      monthHotel.reduce((sum, s) => sum + s.calculated_pay, 0) +
      monthSecondary.reduce((sum, s) => sum + s.calculated_pay, 0);
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-muted-foreground text-sm">{greeting()},</p>
        <h1 className="text-2xl font-semibold">{profile?.full_name}</h1>
      </div>

      {isAdmin ? (
        <div className="glow-finance border-border/60 bg-card rounded-2xl border p-5">
          <p className="text-muted-foreground text-sm">Net worth</p>
          <p className="text-finance text-3xl font-semibold">
            {formatCurrency(netWorth, currency)}
          </p>
        </div>
      ) : (
        <div className="glow-shift border-border/60 bg-card rounded-2xl border p-5">
          <p className="text-muted-foreground text-sm">This month&apos;s earnings</p>
          <p className="text-shift text-3xl font-semibold">
            {formatCurrency(partnerMonthEarnings, "AUD")}
          </p>
        </div>
      )}
    </div>
  );
}

async function HomeStats() {
  const { profile, user, accounts } = await getHomeAccountsData();
  const isAdmin = profile?.role === "ADMIN";
  const ownAccountsCount = accounts.filter((a) => a.user_id === user?.id).length;

  const { hotelShifts, secondaryShifts, gymLogs } = await getHomeActivityData();

  const monthHotel = hotelShifts.filter((s) => isThisMonth(s.shift_date));
  const partnerPending = secondaryShifts
    .filter((s) => s.payout_status === "PENDING")
    .reduce((sum, s) => sum + s.calculated_pay, 0);
  const roomsCleanedMonth = monthHotel.reduce((s, x) => s + x.rooms_cleaned, 0);
  const weekGymSets = gymLogs
    .filter((l) => isThisWeek(l.logged_at))
    .reduce((sum, l) => sum + l.sets, 0);

  if (isAdmin) {
    const monthSecondary = secondaryShifts.filter((s) => isThisMonth(s.shift_date));
    const partnerMonthEarnings =
      monthHotel.reduce((sum, s) => sum + s.calculated_pay, 0) +
      monthSecondary.reduce((sum, s) => sum + s.calculated_pay, 0);

    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Sets this week"
            value={weekGymSets.toString()}
            icon={<Dumbbell className="size-4" />}
            accent="fitness"
          />
          <StatCard
            label="Accounts"
            value={ownAccountsCount.toString()}
            icon={<Wallet className="size-4" />}
            accent="finance"
          />
        </div>

        <section className="mt-6 flex flex-col gap-3">
          <h2 className="text-sm font-medium">Her side of the sync</h2>
          <Link
            href="/work"
            className="border-border/60 bg-card glow-shift flex items-center justify-between rounded-xl border p-4"
          >
            <div>
              <p className="text-sm font-medium">This month&apos;s earnings</p>
              <p className="text-shift text-xl font-semibold">
                {formatCurrency(partnerMonthEarnings, "AUD")}
              </p>
              <p className="text-muted-foreground text-xs">
                {roomsCleanedMonth} rooms · pending{" "}
                {formatCurrency(partnerPending, "AUD")}
              </p>
            </div>
            <ArrowRight className="text-muted-foreground size-5" />
          </Link>
        </section>
      </>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        label="Pending payout"
        value={formatCurrency(partnerPending, "AUD")}
        icon={<HandCoins className="size-4" />}
        accent="warning"
      />
      <StatCard
        label="Rooms this month"
        value={roomsCleanedMonth.toString()}
        icon={<BedDouble className="size-4" />}
        accent="shift"
      />
    </div>
  );
}

async function HomeBills() {
  const [{ profile, accounts }, bills] = await Promise.all([
    getHomeAccountsData(),
    getHomeUpcomingBillsData(),
  ]);
  const currency = profile?.currency_preference ?? "AUD";
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const upcomingBills = bills.map((bill) => ({
    id: bill.id,
    label: bill.label,
    category: bill.category,
    amount: bill.amount,
    next_due_date: bill.next_due_date,
    accountName: accountById.get(bill.account_id)?.account_name ?? "Unknown account",
  }));

  return (
    <>
      <UpcomingBillsWidget bills={upcomingBills} currency={currency} />
      <BillNotifications bills={upcomingBills} />
    </>
  );
}

async function QuickLinks() {
  const { profile } = await getHomeAccountsData();
  const isAdmin = profile?.role === "ADMIN";

  return (
    <section className="grid grid-cols-2 gap-3">
      <Link
        href="/work"
        className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-4"
      >
        <span className="bg-shift/15 text-shift flex size-9 items-center justify-center rounded-lg">
          <BedDouble className="size-4" />
        </span>
        <span className="text-sm font-medium">Work / Shifts</span>
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
      {isAdmin ? (
        <Link
          href="/gym"
          className="border-border/60 bg-card flex flex-col gap-2 rounded-xl border p-4"
        >
          <span className="bg-fitness/15 text-fitness flex size-9 items-center justify-center rounded-lg">
            <Dumbbell className="size-4" />
          </span>
          <span className="text-sm font-medium">Gym</span>
        </Link>
      ) : null}
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
      <div className="bg-muted h-24 w-full animate-pulse rounded-2xl" />
    </div>
  );
}

function QuickLinksSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-muted h-[88px] animate-pulse rounded-xl" />
      <div className="bg-muted h-[88px] animate-pulse rounded-xl" />
    </div>
  );
}
