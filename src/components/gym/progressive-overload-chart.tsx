"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { Database } from "@/lib/types/database.types";
import { toLocalDateKey } from "@/lib/format";

type GymLog = Database["public"]["Tables"]["gym_logs"]["Row"];
type Exercise = Database["public"]["Tables"]["gym_exercises"]["Row"];

const chartConfig = {
  maxWeight: { label: "Max weight (kg)", color: "var(--fitness)" },
} satisfies ChartConfig;

export function ProgressiveOverloadChart({
  logs,
  exercises,
}: {
  logs: GymLog[];
  exercises: Exercise[];
}) {
  const exercisesWithLogs = useMemo(
    () =>
      exercises.filter((ex) => logs.some((l) => l.exercise_id === ex.id)),
    [exercises, logs]
  );

  const [exerciseId, setExerciseId] = useState(exercisesWithLogs[0]?.id ?? "");
  const selectedId = exerciseId || exercisesWithLogs[0]?.id;

  const data = useMemo(() => {
    if (!selectedId) return [];

    // One point per calendar day: the heaviest set logged that day, so the
    // line traces max weight over time rather than every individual set.
    const byDay = new Map<string, number>();
    logs
      .filter((l) => l.exercise_id === selectedId)
      .forEach((l) => {
        const day = toLocalDateKey(new Date(l.logged_at));
        byDay.set(day, Math.max(byDay.get(day) ?? 0, l.weight_kg));
      });

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, maxWeight]) => ({
        date: new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
          month: "numeric",
          day: "numeric",
        }),
        maxWeight,
      }));
  }, [logs, selectedId]);

  if (exercisesWithLogs.length === 0) {
    return (
      <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        Log a few sets to see your progressive-overload trend.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Select value={selectedId} onValueChange={setExerciseId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose exercise" />
        </SelectTrigger>
        <SelectContent>
          {exercisesWithLogs.map((ex) => (
            <SelectItem key={ex.id} value={ex.id}>
              {ex.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {data.length < 2 ? (
        <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
          Log this exercise on another day to see a trend line.
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <LineChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={32}
              domain={["dataMin - 5", "dataMax + 5"]}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line
              dataKey="maxWeight"
              type="monotone"
              stroke="var(--color-maxWeight)"
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--color-maxWeight)" }}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
