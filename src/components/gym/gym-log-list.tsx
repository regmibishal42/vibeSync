import { Dumbbell } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { Database } from "@/lib/types/database.types";

type GymLog = Database["public"]["Tables"]["gym_logs"]["Row"];
type Exercise = Database["public"]["Tables"]["gym_exercises"]["Row"];

export function GymLogList({
  logs,
  exercises,
}: {
  logs: GymLog[];
  exercises: Exercise[];
}) {
  if (logs.length === 0) {
    return (
      <Card className="items-center justify-center py-10 text-center">
        <Dumbbell className="text-muted-foreground mx-auto size-8" />
        <p className="text-muted-foreground px-4 text-sm">
          No sets logged yet — hit that FAB after your next lift.
        </p>
      </Card>
    );
  }

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  return (
    <div className="flex flex-col gap-3">
      {logs.map((log) => {
        const exercise = exerciseById.get(log.exercise_id);
        return (
          <Card key={log.id} className="gap-1 py-4">
            <div className="flex items-center justify-between px-4">
              <div className="flex flex-col">
                <span className="font-medium">
                  {exercise?.name ?? "Unknown exercise"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(log.logged_at).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {exercise?.machine_name ? ` · ${exercise.machine_name}` : ""}
                </span>
              </div>
              <div className="text-fitness text-right font-semibold">
                {log.weight_kg}kg
                <span className="text-muted-foreground block text-xs font-normal">
                  {log.sets} × {log.reps}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
