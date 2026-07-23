import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Dumbbell, Flame, TrendingUp } from "lucide-react";

import { getGymExercisesData, getGymLogsData } from "@/app/(app)/gym/data";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatGridSkeleton } from "@/components/skeletons/stat-grid-skeleton";
import { ChartSkeleton } from "@/components/skeletons/chart-skeleton";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { GymSetForm } from "@/components/gym/gym-set-form";
import { GymLogList } from "@/components/gym/gym-log-list";

const ProgressiveOverloadChart = dynamic(
  () =>
    import("@/components/gym/progressive-overload-chart").then(
      (m) => m.ProgressiveOverloadChart
    ),
  { loading: () => <ChartSkeleton /> }
);

export const metadata: Metadata = { title: "Gym" };

function isThisWeek(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  return date >= weekAgo && date <= now;
}

export default function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<GymGuardSkeleton />}>
        <GymGuard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function GymGuard({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const profile = await getCurrentProfile();

  // Gym is an ADMIN-only flow. RLS already blocks a PARTNER from the
  // underlying data (0008_rls_policies.sql), but per Next's own proxy
  // guidance, authorization should also be checked at the route itself
  // rather than relying solely on the network-edge proxy.
  if (profile?.role !== "ADMIN") {
    redirect("/");
  }

  const { quick } = await searchParams;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Gym</h1>
        <p className="text-muted-foreground text-sm">
          Machine tracking and progressive overload.
        </p>
      </div>

      <Suspense fallback={<GymFormSkeleton />}>
        <GymQuickAdd quick={quick} />
      </Suspense>

      <Suspense fallback={<GymSummarySkeleton />}>
        <GymSummary />
      </Suspense>
    </>
  );
}

async function GymQuickAdd({ quick }: { quick?: string }) {
  const exercises = await getGymExercisesData();
  return <GymSetForm exercises={exercises} defaultOpen={quick === "set"} />;
}

async function GymSummary() {
  const [exercises, logs] = await Promise.all([
    getGymExercisesData(),
    getGymLogsData(),
  ]);

  const weekLogs = logs.filter((l) => isThisWeek(l.logged_at));
  const weekSets = weekLogs.reduce((sum, l) => sum + l.sets, 0);
  const exercisesTrained = new Set(weekLogs.map((l) => l.exercise_id)).size;
  const heaviestLift = logs.reduce((max, l) => Math.max(max, l.weight_kg), 0);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Sets this week"
          value={weekSets.toString()}
          icon={<Dumbbell className="size-4" />}
          accent="fitness"
        />
        <StatCard
          label="Exercises"
          value={exercisesTrained.toString()}
          icon={<Flame className="size-4" />}
          accent="fitness"
        />
        <StatCard
          label="Heaviest lift"
          value={`${heaviestLift}kg`}
          icon={<TrendingUp className="size-4" />}
          accent="fitness"
        />
      </div>

      <div className="border-border/60 bg-card mt-6 rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">Progressive overload</h2>
        <ProgressiveOverloadChart logs={logs} exercises={exercises} />
      </div>

      <div className="mt-6">
        <GymLogList logs={logs} exercises={exercises} />
      </div>
    </>
  );
}

function GymGuardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-7 w-20 animate-pulse rounded" />
        <div className="bg-muted h-4 w-56 animate-pulse rounded" />
      </div>
      <GymFormSkeleton />
      <GymSummarySkeleton />
    </div>
  );
}

function GymFormSkeleton() {
  return <div className="bg-muted h-12 w-full animate-pulse rounded-lg" />;
}

function GymSummarySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatGridSkeleton count={3} columns={3} />
      <ChartSkeleton />
      <ListSkeleton />
    </div>
  );
}
