import type { Metadata } from "next";
import { BedDouble, Clock, DollarSign, HandCoins } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { formatCurrency } from "@/lib/format";
import { StatCard } from "@/components/dashboard/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HotelShiftForm } from "@/components/work/hotel-shift-form";
import { HotelShiftList } from "@/components/work/hotel-shift-list";
import { SecondaryShiftForm } from "@/components/work/secondary-shift-form";
import { SecondaryShiftList } from "@/components/work/secondary-shift-list";
import { PayoutBatchList } from "@/components/work/payout-batch-list";
import { CreatePayoutBatchButton } from "@/components/work/create-payout-batch-button";
import { EarningsChart } from "@/components/work/earnings-chart";

export const metadata: Metadata = { title: "Work / Shifts" };

function isThisMonth(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const { quick } = await searchParams;
  const [profile, supabase] = await Promise.all([
    getCurrentProfile(),
    createClient(),
  ]);

  const [{ data: hotelShifts }, { data: secondaryShifts }, { data: payoutBatches }] =
    await Promise.all([
      supabase
        .from("hotel_shifts")
        .select("*")
        .order("shift_date", { ascending: false })
        .limit(60),
      supabase
        .from("secondary_shifts")
        .select("*")
        .order("shift_date", { ascending: false })
        .limit(60),
      supabase
        .from("payout_batches")
        .select("*")
        .order("paid_at", { ascending: false })
        .limit(20),
    ]);

  const hotel = hotelShifts ?? [];
  const secondary = secondaryShifts ?? [];
  const batches = payoutBatches ?? [];
  const isPartner = profile?.role === "PARTNER";

  const monthHotel = hotel.filter((s) => isThisMonth(s.shift_date));
  const monthSecondary = secondary.filter((s) => isThisMonth(s.shift_date));

  const roomsCleaned = monthHotel.reduce((sum, s) => sum + s.rooms_cleaned, 0);
  const totalCredits = monthHotel.reduce((sum, s) => sum + s.total_credits, 0);
  const hoursWorked = monthSecondary.reduce((sum, s) => sum + s.hours_worked, 0);
  const monthEarnings =
    monthHotel.reduce((sum, s) => sum + s.calculated_pay, 0) +
    monthSecondary.reduce((sum, s) => sum + s.calculated_pay, 0);

  const pendingSecondaryTotal = secondary
    .filter((s) => s.payout_status === "PENDING")
    .reduce((sum, s) => sum + s.calculated_pay, 0);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });

  const chartData = days.map((dateISO) => ({
    date: new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
    }),
    hotel: hotel
      .filter((s) => s.shift_date === dateISO)
      .reduce((sum, s) => sum + s.calculated_pay, 0),
    secondary: secondary
      .filter((s) => s.shift_date === dateISO)
      .reduce((sum, s) => sum + s.calculated_pay, 0),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Work / Shifts</h1>
        <p className="text-muted-foreground text-sm">
          {isPartner
            ? "This month across both jobs."
            : "Read-only view of her shift income this month."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Rooms cleaned"
          value={roomsCleaned.toString()}
          icon={<BedDouble className="size-4" />}
          accent="shift"
        />
        <StatCard
          label="Total credits"
          value={totalCredits.toFixed(1)}
          icon={<HandCoins className="size-4" />}
          accent="shift"
        />
        <StatCard
          label="Hours (secondary)"
          value={hoursWorked.toFixed(1)}
          icon={<Clock className="size-4" />}
          accent="shift"
        />
        <StatCard
          label="Month earnings"
          value={formatCurrency(monthEarnings, "AUD")}
          icon={<DollarSign className="size-4" />}
          accent="finance"
        />
      </div>

      <div className="border-border/60 bg-card rounded-xl border p-4">
        <h2 className="mb-2 text-sm font-medium">Last 14 days</h2>
        <EarningsChart data={chartData} />
      </div>

      <Tabs defaultValue="hotel">
        <TabsList className="w-full">
          <TabsTrigger value="hotel" className="flex-1">
            Hotel
          </TabsTrigger>
          <TabsTrigger value="secondary" className="flex-1">
            Secondary
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex-1">
            Payouts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hotel" className="flex flex-col gap-3 pt-3">
          {isPartner ? <HotelShiftForm defaultOpen={quick === "hotel"} /> : null}
          <HotelShiftList shifts={hotel} />
        </TabsContent>

        <TabsContent value="secondary" className="flex flex-col gap-3 pt-3">
          {isPartner ? <SecondaryShiftForm /> : null}
          <SecondaryShiftList shifts={secondary} />
        </TabsContent>

        <TabsContent value="payouts" className="flex flex-col gap-3 pt-3">
          {isPartner ? (
            <CreatePayoutBatchButton pendingTotal={pendingSecondaryTotal} />
          ) : null}
          <PayoutBatchList batches={batches} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
