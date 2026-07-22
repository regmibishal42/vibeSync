"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createExercise, logGymSet } from "@/app/(app)/gym/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/lib/types/database.types";

type Exercise = Database["public"]["Tables"]["gym_exercises"]["Row"];

export function GymSetForm({
  exercises,
  defaultOpen = false,
}: {
  exercises: Exercise[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [creatingNew, setCreatingNew] = useState(exercises.length === 0);
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? "");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) router.replace("/gym");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      let targetExerciseId = exerciseId;

      if (creatingNew) {
        const result = await createExercise({}, formData);
        if (result.error || !result.exerciseId) {
          setError(result.error ?? "Could not create exercise.");
          return;
        }
        targetExerciseId = result.exerciseId;
      }

      formData.set("exerciseId", targetExerciseId);
      const logResult = await logGymSet({}, formData);
      if (logResult.error) {
        setError(logResult.error);
        return;
      }

      setError(undefined);
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="fitness" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Log set
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a set</DialogTitle>
          <DialogDescription>
            Pick the machine/exercise, then record what you lifted.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>Exercise</Label>
            {creatingNew ? (
              <div className="flex flex-col gap-2">
                <Input name="name" placeholder="Exercise name" required />
                <div className="grid grid-cols-2 gap-2">
                  <Input name="targetMuscle" placeholder="Target muscle" />
                  <Input name="machineName" placeholder="Machine name" />
                </div>
                {exercises.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setCreatingNew(false)}
                  >
                    Choose an existing exercise instead
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Select value={exerciseId} onValueChange={setExerciseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select exercise" />
                  </SelectTrigger>
                  <SelectContent>
                    {exercises.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name}
                        {ex.machine_name ? ` · ${ex.machine_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setCreatingNew(true)}
                >
                  <Plus className="size-3.5" />
                  Add a new exercise
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="weight-kg">Weight (kg)</Label>
              <Input
                id="weight-kg"
                name="weightKg"
                type="number"
                step="0.5"
                min="0"
                defaultValue={20}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                name="reps"
                type="number"
                min="1"
                defaultValue={10}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sets">Sets</Label>
              <Input
                id="sets"
                name="sets"
                type="number"
                min="1"
                defaultValue={3}
                required
              />
            </div>
          </div>

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isPending || (!creatingNew && !exerciseId)}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save set
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
