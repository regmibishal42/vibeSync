"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  SECONDARY_SHIFT_DEFAULT_HOURS,
  SECONDARY_SHIFT_DEFAULT_RATE,
} from "@/lib/calculations/shift-pay";

type ActionResult = { error?: string; success?: boolean; amount?: number };

// The FAB's "Log 2-Hour Shift" one-tap action. hours_worked/hourly_rate are
// left at their column defaults; the database trigger derives calculated_pay
// (see 0007_secondary_shifts.sql) so there is nothing else to compute here.
export async function logSecondaryShift(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("secondary_shifts").insert({
    user_id: user.id,
    shift_date: today,
    hours_worked: SECONDARY_SHIFT_DEFAULT_HOURS,
    hourly_rate: SECONDARY_SHIFT_DEFAULT_RATE,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/work");
  revalidatePath("/");
  return {
    success: true,
    amount: SECONDARY_SHIFT_DEFAULT_HOURS * SECONDARY_SHIFT_DEFAULT_RATE,
  };
}

const roomDetailSchema = z.object({
  room: z.string().min(1),
  credits: z.number().positive(),
});

const hotelShiftSchema = z.object({
  shiftDate: z.string().min(1, "Pick a date"),
  rooms: z.array(roomDetailSchema).min(1, "Add at least one room"),
});

export async function createHotelShift(
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

  const raw = formData.get("rooms");
  let rooms: unknown;
  try {
    rooms = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return { error: "Malformed room list." };
  }

  const parsed = hotelShiftSchema.safeParse({
    shiftDate: formData.get("shiftDate"),
    rooms,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const totalCredits = parsed.data.rooms.reduce((sum, r) => sum + r.credits, 0);

  const { error } = await supabase.from("hotel_shifts").insert({
    user_id: user.id,
    shift_date: parsed.data.shiftDate,
    rooms_cleaned: parsed.data.rooms.length,
    total_credits: Math.round(totalCredits * 100) / 100,
    room_details: parsed.data.rooms,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/work");
  revalidatePath("/");
  return { success: true };
}

const secondaryShiftSchema = z.object({
  shiftDate: z.string().min(1, "Pick a date"),
  hoursWorked: z.coerce.number().positive("Must be greater than 0"),
  hourlyRate: z.coerce.number().positive("Must be greater than 0"),
});

export async function createSecondaryShift(
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

  const parsed = secondaryShiftSchema.safeParse({
    shiftDate: formData.get("shiftDate"),
    hoursWorked: formData.get("hoursWorked"),
    hourlyRate: formData.get("hourlyRate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("secondary_shifts").insert({
    user_id: user.id,
    shift_date: parsed.data.shiftDate,
    hours_worked: parsed.data.hoursWorked,
    hourly_rate: parsed.data.hourlyRate,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/work");
  revalidatePath("/");
  return { success: true };
}

// Bundles every PENDING secondary shift into one payout_batches row and
// flips those shifts to PAID — the "reconcile once salary lands" flow.
export async function createPayoutBatch(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: pending, error: fetchError } = await supabase
    .from("secondary_shifts")
    .select("id, calculated_pay")
    .eq("user_id", user.id)
    .eq("payout_status", "PENDING");

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!pending || pending.length === 0) {
    return { error: "No pending shifts to pay out." };
  }

  const total = pending.reduce((sum, s) => sum + s.calculated_pay, 0);

  const { data: batch, error: batchError } = await supabase
    .from("payout_batches")
    .insert({
      user_id: user.id,
      total_amount: Math.round(total * 100) / 100,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { error: batchError?.message ?? "Could not create payout batch." };
  }

  const { error: updateError } = await supabase
    .from("secondary_shifts")
    .update({ payout_status: "PAID", payout_batch_id: batch.id })
    .in(
      "id",
      pending.map((s) => s.id)
    );

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/work");
  revalidatePath("/");
  return { success: true, amount: total };
}
