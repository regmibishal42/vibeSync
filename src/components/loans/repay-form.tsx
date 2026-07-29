"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HandCoins } from "lucide-react";

import { repayLoan } from "@/app/(app)/loans/actions";
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
import { formatCurrency, todayLocalISO } from "@/lib/format";
import type { AccountType } from "@/lib/types/database.types";

type RepayAccount = { id: string; account_name: string; account_type: AccountType };

export function RepayForm({
  loanId,
  remaining,
  currency,
  accounts,
  defaultAccountId,
}: {
  loanId: string;
  remaining: number;
  currency: string;
  accounts: RepayAccount[];
  defaultAccountId: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(remaining);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await repayLoan({}, formData);
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
      <Button variant="finance" size="sm" onClick={() => setOpen(true)}>
        <HandCoins className="size-3.5" />
        Record repayment
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record repayment</DialogTitle>
          <DialogDescription>
            Remaining: {formatCurrency(remaining, currency)}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="loanId" value={loanId} />
          <input type="hidden" name="paidDate" value={todayLocalISO()} />
          <input type="hidden" name="accountId" value={accountId} />

          <div className="grid gap-2">
            <Label htmlFor="repay-amount">Amount</Label>
            <Input
              id="repay-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </div>

          {accounts.length > 1 ? (
            <div className="grid gap-2">
              <Label>Received into</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an account" />
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
              <p className="text-muted-foreground text-xs">
                Paid back into a different account than it was lent from? Pick it here —
                e.g. lent from your bank, paid back in cash.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
