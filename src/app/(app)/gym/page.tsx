import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dumbbell, Flame, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { StatCard } from "@/components/dashboard/stat-card";
import { GymSetForm } from "@/components/gym/gym-set-form";
import { GymLogList } from "@/components/gym/gym-log-list";
import { ProgressiveOverloadChart } from "@/components/gym/progressive-overload-chart";

export const metadata: Metadata = { title: "Gym" };

function isThisWeek(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  return date >= weekAgo && date <= now;
}

export default async function GymPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const { quick } = await searchParams;
  const profile = await getCurrentProfile();

  // Gym is an ADMIN-only flow. RLS already blocks a PARTNER from the
  // underlying data (0008_rls_policies.sql), but per Next's own proxy
  // guidance, authorization should also be checked at the route itself
  // rather than relying solely on the network-edge proxy.
  if (profile?.role !== "ADMIN") {
    redirect("/");
  }

  const supabase = await createClient();
  const [{ data: exercises }, { data: logs }] = await Promise.all([
    supabase.from("gym_exercises").select("*").order("name"),
    supabase
      .from("gym_logs")
      .select("*")
      .order("logged_at", { ascending: false })
      .limit(100),
  ]);

  const allExercises = exercises ?? [];
  const allLogs = logs ?? [];

  const weekLogs = allLogs.filter((l) => isThisWeek(l.logged_at));
  const weekSets = weekLogs.reduce((sum, l) => sum + l.sets, 0);
  const exercisesTrained = new Set(weekLogs.map((l) => l.exercise_id)).size;
  const heaviestLift = allLogs.reduce(
    (max, l) => Math.max(max, l.weight_kg),
    0
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Gym</h1>
        <p className="text-muted-foreground text-sm">
          Machine tracking and progressive overload.
        </p>
      </div>

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

      <div className="border-border/60 bg-card rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-medium">Progressive overload</h2>
        <ProgressiveOverloadChart logs={allLogs} exercises={allExercises} />
      </div>

      <GymSetForm exercises={allExercises} defaultOpen={quick === "set"} />

      <GymLogList logs={allLogs} exercises={allExercises} />
    </div>
  );
}
