"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createJob } from "@/app/(app)/work/actions";
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
import { todayLocalISO } from "@/lib/format";
import type { PayType } from "@/lib/types/database.types";

export function JobForm({
  accounts,
}: {
  accounts: { id: string; account_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [employmentType, setEmploymentType] = useState<"FULL_TIME" | "PART_TIME">(
    "PART_TIME"
  );
  const [payType, setPayType] = useState<PayType>("HOURLY");
  const [depositAccountId, setDepositAccountId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createJob({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add job
      </Button>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
          <DialogDescription>
            Full-time or part-time, paid hourly, monthly, or biweekly.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="employmentType" value={employmentType} />
          <input type="hidden" name="payType" value={payType} />

          <div className="grid gap-2">
            <Label htmlFor="job-name">Job name</Label>
            <Input id="job-name" name="name" placeholder="Hotel housekeeping, Dev job…" required />
          </div>

          <div className="grid gap-2">
            <Label>Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(v) => setEmploymentType(v as typeof employmentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Full-time</SelectItem>
                <SelectItem value="PART_TIME">Part-time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Pay type</Label>
            <Select value={payType} onValueChange={(v) => setPayType(v as PayType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HOURLY">Hourly</SelectItem>
                <SelectItem value="MONTHLY">Monthly salary</SelectItem>
                <SelectItem value="BIWEEKLY">Biweekly salary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payType === "HOURLY" ? (
            <div className="grid gap-2">
              <Label htmlFor="hourly-rate">Hourly rate</Label>
              <Input
                id="hourly-rate"
                name="hourlyRate"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="salary-amount">
                  {payType === "MONTHLY" ? "Monthly" : "Biweekly"} salary amount
                </Label>
                <Input
                  id="salary-amount"
                  name="salaryAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="next-pay-date">Next pay date</Label>
                <Input
                  id="next-pay-date"
                  name="nextPayDate"
                  type="date"
                  defaultValue={todayLocalISO()}
                  required
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label>Deposit account{payType === "HOURLY" ? " (optional)" : ""}</Label>
            <input type="hidden" name="depositAccountId" value={depositAccountId} />
            <Select value={depositAccountId} onValueChange={setDepositAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Where the pay lands" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save job
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
