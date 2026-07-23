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
import type { Database, ExpenseCategory } from "@/lib/types/database.types";
import { todayLocalISO } from "@/lib/format";
import { ACCOUNT_TYPE_ICON } from "@/lib/wallet/account-type";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";
import {
  useTransactionsOptimistic,
  type OptimisticTransaction,
} from "@/components/wallet/transactions-provider";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type TxType = "EXPENSE" | "DEPOSIT" | "TRANSFER";

// Mirrors wallet/actions.ts's exact amount-signing logic (and the
// "Transfer out"/"Transfer in" naming for transfers) so the optimistic row
// renders identically to what the server will actually produce.
function buildOptimisticAction(formData: FormData, accounts: Account[]) {
  const type = formData.get("type") as TxType;
  const amount = Number(formData.get("amount"));
  const accountId = formData.get("accountId") as string;
  const account = accounts.find((a) => a.id === accountId);
  const base = {
    created_at: new Date().toISOString(),
    transaction_date: formData.get("transactionDate") as string,
    _pending: true as const,
  };

  if (type === "TRANSFER") {
    const destinationId = formData.get("destinationAccountId") as string;
    const destination = accounts.find((a) => a.id === destinationId);

    const out: OptimisticTransaction = {
      ...base,
      id: crypto.randomUUID(),
      account_id: accountId,
      user_id: account?.user_id ?? "",
      amount: -Math.abs(amount),
      type: "TRANSFER",
      category: null,
      merchant_or_item: "Transfer out",
    };
    const inbound: OptimisticTransaction = {
      ...base,
      id: crypto.randomUUID(),
      account_id: destinationId,
      user_id: destination?.user_id ?? "",
      amount: Math.abs(amount),
      type: "TRANSFER",
      category: null,
      merchant_or_item: "Transfer in",
    };

    return { type: "add-pair" as const, txs: [out, inbound] as [OptimisticTransaction, OptimisticTransaction] };
  }

  const tx: OptimisticTransaction = {
    ...base,
    id: crypto.randomUUID(),
    account_id: accountId,
    user_id: account?.user_id ?? "",
    amount: type === "EXPENSE" ? -Math.abs(amount) : Math.abs(amount),
    type,
    category: (formData.get("category") as ExpenseCategory) || null,
    merchant_or_item: (formData.get("merchantOrItem") as string) || null,
  };

  return { type: "add" as const, tx };
}

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
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { addOptimistic } = useTransactionsOptimistic();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) router.replace("/wallet");
  }

  function handleSubmit(formData: FormData) {
    const optimisticAction = buildOptimisticAction(formData, accounts);

    startTransition(async () => {
      // Shown instantly; reverts on its own once this transition settles
      // (React 19's useOptimistic rollback) if createTransaction errors —
      // no manual revert dispatch needed since we never touch base state.
      addOptimistic(optimisticAction);

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
            <Label>{type === "TRANSFER" ? "From account" : "Paid via"}</Label>
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
                    .map((a) => {
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
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as ExpenseCategory)}
                >
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
                <input type="hidden" name="category" value={category} />
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
