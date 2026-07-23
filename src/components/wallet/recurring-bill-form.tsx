"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createRecurringBill } from "@/app/(app)/wallet/recurring-actions";
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
import { ACCOUNT_TYPE_ICON } from "@/lib/wallet/account-type";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";
import { todayLocalISO } from "@/lib/format";
import type { Database, ExpenseCategory } from "@/lib/types/database.types";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  WEEKLY: "Every week",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Every month",
};

export function RecurringBillForm({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [category, setCategory] = useState<ExpenseCategory>("RENT");
  const [frequency, setFrequency] = useState<Frequency>("BIWEEKLY");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createRecurringBill({}, formData);
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add recurring bill
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add recurring bill</DialogTitle>
          <DialogDescription>
            Rent, a sim plan, or anything else that repeats on a schedule.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="frequency" value={frequency} />

          <div className="grid gap-2">
            <Label htmlFor="label">Name</Label>
            <Input id="label" name="label" placeholder="Rent, Sim plan…" required />
          </div>

          <div className="grid gap-2">
            <Label>Paid via</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => {
                  const AccountIcon = ACCOUNT_TYPE_ICON[a.account_type];
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <AccountIcon className="size-3.5" />
                        {a.account_name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => {
                  const CategoryIcon = CATEGORY_META[c].icon;
                  return (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon className="size-3.5" />
                        {CATEGORY_META[c].label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Repeats</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCY_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nextDueDate">First due date</Label>
            <Input
              id="nextDueDate"
              name="nextDueDate"
              type="date"
              defaultValue={todayLocalISO()}
              required
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isPending || !accountId}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save recurring bill
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
