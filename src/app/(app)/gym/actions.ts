"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; success?: boolean };

const gymSetSchema = z.object({
  exerciseId: z.string().uuid("Pick an exercise"),
  weightKg: z.coerce.number().nonnegative("Must be 0 or more"),
  reps: z.coerce.number().int().positive("Must be at least 1"),
  sets: z.coerce.number().int().positive("Must be at least 1"),
});

export async function logGymSet(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const parsed = gymSetSchema.safeParse({
    exerciseId: formData.get("exerciseId"),
    weightKg: formData.get("weightKg"),
    reps: formData.get("reps"),
    sets: formData.get("sets"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("gym_logs").insert({
    user_id: user.id,
    exercise_id: parsed.data.exerciseId,
    weight_kg: parsed.data.weightKg,
    reps: parsed.data.reps,
    sets: parsed.data.sets,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/gym");
  revalidatePath("/");
  return { success: true };
}

const exerciseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetMuscle: z.string().optional(),
  machineName: z.string().optional(),
});

export async function createExercise(
  _prevState: ActionResult & { exerciseId?: string },
  formData: FormData
): Promise<ActionResult & { exerciseId?: string }> {
  const supabase = await createClient();

  const parsed = exerciseSchema.safeParse({
    name: formData.get("name"),
    targetMuscle: formData.get("targetMuscle") || undefined,
    machineName: formData.get("machineName") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data, error } = await supabase
    .from("gym_exercises")
    .insert({
      name: parsed.data.name,
      target_muscle: parsed.data.targetMuscle ?? null,
      machine_name: parsed.data.machineName ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create exercise." };
  }

  revalidatePath("/gym");
  return { success: true, exerciseId: data.id };
}
