"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createJobShift } from "@/app/(app)/work/actions";
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
import { calculateShiftPay } from "@/lib/calculations/job-pay";
import { formatCurrency, todayLocalISO } from "@/lib/format";

export function JobShiftForm({
  jobId,
  hourlyRate,
  currency,
}: {
  jobId: string;
  hourlyRate: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [shiftDate, setShiftDate] = useState(todayLocalISO());
  const [hoursWorked, setHoursWorked] = useState(1);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createJobShift({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setShiftDate(todayLocalISO());
      setHoursWorked(1);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="shift" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        Log hours
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log hours</DialogTitle>
          <DialogDescription>
            Pay is calculated from this job&apos;s hourly rate automatically.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="jobId" value={jobId} />

          <div className="grid gap-2">
            <Label htmlFor="shift-date">Date</Label>
            <Input
              id="shift-date"
              name="shiftDate"
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              max={todayLocalISO()}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="hours-worked">Hours worked</Label>
            <Input
              id="hours-worked"
              name="hoursWorked"
              type="number"
              step="0.25"
              min="0.25"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(Number(e.target.value) || 0)}
            />
          </div>

          <div className="bg-shift/10 flex items-center justify-between rounded-xl p-4 text-sm">
            <span className="text-muted-foreground">Estimated pay</span>
            <span className="text-shift text-base font-semibold">
              {formatCurrency(calculateShiftPay(hoursWorked, hourlyRate), currency)}
            </span>
          </div>

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save shift
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
