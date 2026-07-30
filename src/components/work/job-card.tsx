"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Briefcase, Calendar, HandCoins, Loader2, Power } from "lucide-react";

import { settleJobPayout, setJobActive } from "@/app/(app)/work/actions";
import { markRecurringTransactionPaid } from "@/app/(app)/wallet/recurring-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JobShiftForm } from "@/components/work/job-shift-form";
import { formatCurrency } from "@/lib/format";
import type { Database } from "@/lib/types/database.types";

type Job = Database["public"]["Tables"]["jobs"]["Row"];
type JobShift = Database["public"]["Tables"]["job_shifts"]["Row"];
type RecurringTransaction = Database["public"]["Tables"]["recurring_transactions"]["Row"];

const PAY_TYPE_LABEL: Record<Job["pay_type"], string> = {
  HOURLY: "Hourly",
  MONTHLY: "Monthly salary",
  BIWEEKLY: "Biweekly salary",
};

export function JobCard({
  job,
  shifts,
  salary,
  currency,
}: {
  job: Job;
  shifts: JobShift[];
  salary: RecurringTransaction | undefined;
  currency: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const pending = shifts.filter((s) => s.payout_status === "PENDING");
  const pendingTotal = pending.reduce((sum, s) => sum + s.calculated_pay, 0);
  const pendingHours = pending.reduce((sum, s) => sum + s.hours_worked, 0);
  const recentShifts = shifts.slice(0, 5);

  function handleSettle() {
    startTransition(async () => {
      const result = await settleJobPayout(job.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Settled ${formatCurrency(result.amount ?? 0, currency)}`);
      router.refresh();
    });
  }

  function handleMarkSalaryPaid() {
    if (!salary) return;
    startTransition(async () => {
      const result = await markRecurringTransactionPaid(salary.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${job.name} salary marked paid`);
      router.refresh();
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setJobActive(job.id, !job.is_active);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="gap-3 py-4">
      <div className="flex items-start justify-between px-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Briefcase className="text-muted-foreground size-4" />
            <span className="font-medium">{job.name}</span>
            {!job.is_active ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <span className="text-muted-foreground text-xs">
            {job.employment_type === "FULL_TIME" ? "Full-time" : "Part-time"} ·{" "}
            {PAY_TYPE_LABEL[job.pay_type]}
            {job.pay_type === "HOURLY" ? ` · ${formatCurrency(job.hourly_rate ?? 0, currency)}/hr` : ""}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleActive}
          disabled={isPending}
          aria-label={job.is_active ? "Deactivate job" : "Reactivate job"}
        >
          <Power className={job.is_active ? "text-muted-foreground size-4" : "text-shift size-4"} />
        </Button>
      </div>

      {job.pay_type === "HOURLY" ? (
        <div className="flex flex-col gap-3 px-4">
          <div className="bg-shift/10 flex items-center justify-between rounded-xl p-3 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Pending payout</span>
              <span className="text-shift text-base font-semibold">
                {formatCurrency(pendingTotal, currency)}
              </span>
              <span className="text-muted-foreground text-xs">
                {pendingHours.toFixed(1)} hrs · {pending.length} shift
                {pending.length === 1 ? "" : "s"}
              </span>
            </div>
            <Button
              variant="finance"
              size="sm"
              onClick={handleSettle}
              disabled={isPending || pendingTotal <= 0}
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <HandCoins className="size-3.5" />}
              Settle
            </Button>
          </div>

          <JobShiftForm jobId={job.id} hourlyRate={job.hourly_rate ?? 0} currency={currency} />

          {recentShifts.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {recentShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {shift.hours_worked}h
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatCurrency(shift.calculated_pay, currency)}
                    </span>
                    <Badge variant={shift.payout_status === "PAID" ? "finance" : "warning"}>
                      {shift.payout_status}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-4">
          {salary ? (
            <div className="bg-finance/10 flex items-center justify-between rounded-xl p-3 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Calendar className="size-3" />
                  Next pay{" "}
                  {new Date(`${salary.next_due_date}T00:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-finance text-base font-semibold">
                  {formatCurrency(salary.amount, currency)}
                </span>
              </div>
              <Button
                variant="finance"
                size="sm"
                onClick={handleMarkSalaryPaid}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <HandCoins className="size-3.5" />}
                Mark paid
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No salary schedule linked.</p>
          )}
        </div>
      )}
    </Card>
  );
}
