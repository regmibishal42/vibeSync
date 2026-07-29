"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; success?: boolean; amount?: number };

const jobSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
    payType: z.enum(["HOURLY", "MONTHLY", "BIWEEKLY"]),
    hourlyRate: z.coerce.number().positive().optional(),
    depositAccountId: z.string().uuid().optional(),
    salaryAmount: z.coerce.number().positive().optional(),
    nextPayDate: z.string().optional(),
  })
  .refine((v) => v.payType !== "HOURLY" || v.hourlyRate !== undefined, {
    message: "Hourly rate is required for an hourly job",
    path: ["hourlyRate"],
  })
  .refine(
    (v) =>
      v.payType === "HOURLY" ||
      (v.salaryAmount !== undefined && v.nextPayDate && v.depositAccountId),
    {
      message: "Salary amount, next pay date, and a deposit account are required",
      path: ["salaryAmount"],
    }
  );

// Creating a MONTHLY/BIWEEKLY job also creates its linked recurring_transactions
// INCOME row in the same call — a salaried job IS a recurring paycheck, so
// there's no separate "now go set up the recurring income" step for the user.
export async function createJob(
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

  const parsed = jobSchema.safeParse({
    name: formData.get("name"),
    employmentType: formData.get("employmentType"),
    payType: formData.get("payType"),
    hourlyRate: formData.get("hourlyRate") || undefined,
    depositAccountId: formData.get("depositAccountId") || undefined,
    salaryAmount: formData.get("salaryAmount") || undefined,
    nextPayDate: formData.get("nextPayDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      employment_type: parsed.data.employmentType,
      pay_type: parsed.data.payType,
      hourly_rate: parsed.data.hourlyRate ?? null,
      deposit_account_id: parsed.data.depositAccountId ?? null,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return { error: jobError?.message ?? "Could not create job." };
  }

  if (parsed.data.payType !== "HOURLY") {
    const { error: recurringError } = await supabase.from("recurring_transactions").insert({
      user_id: user.id,
      account_id: parsed.data.depositAccountId!,
      job_id: job.id,
      direction: "INCOME",
      label: parsed.data.name,
      amount: parsed.data.salaryAmount!,
      frequency: parsed.data.payType,
      next_due_date: parsed.data.nextPayDate!,
    });

    if (recurringError) {
      return { error: recurringError.message };
    }
  }

  revalidatePath("/work");
  revalidatePath("/");
  return { success: true };
}

export async function setJobActive(jobId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("jobs")
    .update({ is_active: isActive })
    .eq("id", jobId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/work");
  return { success: true };
}

const jobShiftSchema = z.object({
  jobId: z.string().uuid("Pick a job"),
  shiftDate: z.string().min(1, "Pick a date"),
  hoursWorked: z.coerce.number().positive("Must be greater than 0"),
});

export async function createJobShift(
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

  const parsed = jobShiftSchema.safeParse({
    jobId: formData.get("jobId"),
    shiftDate: formData.get("shiftDate"),
    hoursWorked: formData.get("hoursWorked"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("job_shifts").insert({
    job_id: parsed.data.jobId,
    user_id: user.id,
    shift_date: parsed.data.shiftDate,
    hours_worked: parsed.data.hoursWorked,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/work");
  revalidatePath("/");
  return { success: true };
}

// Settles every PENDING shift for a job into one payout_batches row and
// posts the real wallet deposit — see settle_job_shifts() in 0006_jobs.sql
// for why this is one atomic Postgres call rather than sequential client calls.
export async function settleJobPayout(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not signed in." };
  }

  const { data, error } = await supabase.rpc("settle_job_shifts", {
    p_job_id: jobId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/work");
  revalidatePath("/");
  revalidatePath("/wallet");
  return { success: true, amount: data?.total_amount };
}
