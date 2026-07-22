import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Dumbbell,
  HandCoins,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { StatCard } from "@/components/dashboard/stat-card";
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

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: accounts },
    { data: hotelShifts },
    { data: secondaryShifts },
    { data: gymLogs },
  ] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.from("hotel_shifts").select("*"),
    supabase.from("secondary_shifts").select("*"),
    supabase.from("gym_logs").select("*"),
  ]);

  const isAdmin = profile?.role === "ADMIN";
  const currency = profile?.currency_preference ?? "AUD";

  const ownAccounts = (accounts ?? []).filter((a) => a.user_id === user?.id);
  const netWorth = ownAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  const hotel = hotelShifts ?? [];
  const secondary = secondaryShifts ?? [];
  const gym = gymLogs ?? [];

  const monthHotel = hotel.filter((s) => isThisMonth(s.shift_date));
  const monthSecondary = secondary.filter((s) => isThisMonth(s.shift_date));
  const partnerMonthEarnings =
    monthHotel.reduce((sum, s) => sum + s.calculated_pay, 0) +
    monthSecondary.reduce((sum, s) => sum + s.calculated_pay, 0);
  const partnerPending = secondary
    .filter((s) => s.payout_status === "PENDING")
    .reduce((sum, s) => sum + s.calculated_pay, 0);
  const roomsCleanedMonth = monthHotel.reduce((s, x) => s + x.rooms_cleaned, 0);

  const weekGymSets = gym
    .filter((l) => isThisWeek(l.logged_at))
    .reduce((sum, l) => sum + l.sets, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
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

      {isAdmin ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Sets this week"
            value={weekGymSets.toString()}
            icon={<Dumbbell className="size-4" />}
            accent="fitness"
          />
          <StatCard
            label="Accounts"
            value={ownAccounts.length.toString()}
            icon={<Wallet className="size-4" />}
            accent="finance"
          />
        </div>
      ) : (
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
      )}

      {isAdmin ? (
        <section className="flex flex-col gap-3">
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
      ) : null}

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
    </div>
  );
}
