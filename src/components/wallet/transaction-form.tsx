"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { createTransaction } from "@/app/(app)/wallet/actions";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/lib/types/database.types";
import { todayLocalISO } from "@/lib/format";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type TxType = "EXPENSE" | "DEPOSIT" | "TRANSFER";

const CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Supplements",
  "Transport",
  "Dining",
  "Health",
  "Shopping",
];

export function TransactionForm({
  accounts,
  defaultOpen = false,
}: {
  accounts: Account[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [type, setType] = useState<TxType>("EXPENSE");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? ""
  );
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) router.replace("/wallet");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTransaction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="finance" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add transaction
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>
            Balances update automatically once saved.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="type" value={type} />
          <input
            type="hidden"
            name="transactionDate"
            value={todayLocalISO()}
          />

          <Tabs value={type} onValueChange={(v) => setType(v as TxType)}>
            <TabsList className="w-full">
              <TabsTrigger value="EXPENSE" className="flex-1">
                Expense
              </TabsTrigger>
              <TabsTrigger value="DEPOSIT" className="flex-1">
                Deposit
              </TabsTrigger>
              <TabsTrigger value="TRANSFER" className="flex-1">
                Transfer
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-2">
            <Label>{type === "TRANSFER" ? "From account" : "Account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
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
          <input type="hidden" name="accountId" value={accountId} />

          {type === "TRANSFER" ? (
            <div className="grid gap-2">
              <Label>To account</Label>
              <Select
                value={destinationAccountId}
                onValueChange={setDestinationAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="destinationAccountId"
                value={destinationAccountId}
              />
            </div>
          ) : null}

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

          {type !== "TRANSFER" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  list="categories"
                  placeholder="Groceries, Rent, Supplements…"
                />
                <datalist id="categories">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="merchant">Merchant / item</Label>
                <Input id="merchant" name="merchantOrItem" placeholder="Optional" />
              </div>
            </>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isPending || !accountId}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save transaction
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
