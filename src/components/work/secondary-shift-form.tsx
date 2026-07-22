"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createSecondaryShift } from "@/app/(app)/work/actions";
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
  SECONDARY_SHIFT_DEFAULT_HOURS,
  SECONDARY_SHIFT_DEFAULT_RATE,
  calculateSecondaryShiftPay,
} from "@/lib/calculations/shift-pay";
import { formatCurrency, todayLocalISO } from "@/lib/format";

export function SecondaryShiftForm() {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(SECONDARY_SHIFT_DEFAULT_HOURS);
  const [rate, setRate] = useState(SECONDARY_SHIFT_DEFAULT_RATE);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSecondaryShift({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setHours(SECONDARY_SHIFT_DEFAULT_HOURS);
      setRate(SECONDARY_SHIFT_DEFAULT_RATE);
      setOpen(false);
      router.refresh();
    });
  }

  const estimate = calculateSecondaryShiftPay(hours, rate);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Custom hours
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log secondary shift</DialogTitle>
          <DialogDescription>
            For anything other than the standard 2-hour / $25 shift.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="secondary-date">Shift date</Label>
            <Input
              id="secondary-date"
              name="shiftDate"
              type="date"
              defaultValue={todayLocalISO()}
              max={todayLocalISO()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="hours-worked">Hours worked</Label>
              <Input
                id="hours-worked"
                name="hoursWorked"
                type="number"
                step="0.25"
                min="0.25"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 0)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hourly-rate">Hourly rate</Label>
              <Input
                id="hourly-rate"
                name="hourlyRate"
                type="number"
                step="0.5"
                min="0"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="bg-shift/10 flex items-center justify-between rounded-xl p-4 text-sm">
            <span className="text-muted-foreground">Estimated pay</span>
            <span className="text-shift text-base font-semibold">
              {formatCurrency(estimate, "AUD")}
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
