"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createLoan } from "@/app/(app)/loans/actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayLocalISO } from "@/lib/format";
import type { LoanDirection } from "@/lib/types/database.types";

export function LoanForm({
  accounts,
}: {
  accounts: { id: string; account_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<LoanDirection>("LENT");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createLoan({}, formData);
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
        Lend / borrow
      </Button>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lend or borrow money</DialogTitle>
          <DialogDescription>
            Track money you lend to a friend, or borrow from one.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="loanDate" value={todayLocalISO()} />

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={direction === "LENT" ? "shift" : "outline"}
              onClick={() => setDirection("LENT")}
            >
              I lent money
            </Button>
            <Button
              type="button"
              variant={direction === "BORROWED" ? "shift" : "outline"}
              onClick={() => setDirection("BORROWED")}
            >
              I borrowed money
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="counterparty-name">
              {direction === "LENT" ? "Who did you lend to?" : "Who did you borrow from?"}
            </Label>
            <Input id="counterparty-name" name="counterpartyName" placeholder="Ram, Sarah…" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="principal-amount">Amount</Label>
            <Input
              id="principal-amount"
              name="principalAmount"
              type="number"
              step="0.01"
              min="0.01"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>{direction === "LENT" ? "From which account" : "Into which account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an account" />
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

          <div className="grid gap-2">
            <Label htmlFor="due-date">Due date (optional)</Label>
            <Input id="due-date" name="dueDate" type="date" min={todayLocalISO()} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" placeholder="What's this for?" rows={2} />
          </div>

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
