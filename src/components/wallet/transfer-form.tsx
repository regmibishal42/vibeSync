"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeftRight } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_TYPE_ICON } from "@/lib/wallet/account-type";
import { transferLabels } from "@/lib/wallet/create-transaction";
import { todayLocalISO } from "@/lib/format";
import type { Database } from "@/lib/types/database.types";
import {
  useTransactionsOptimistic,
  type OptimisticTransaction,
} from "@/components/wallet/transactions-provider";

type Account = Database["public"]["Tables"]["accounts"]["Row"];

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? ""
  );
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { addOptimistic } = useTransactionsOptimistic();

  const source = accounts.find((a) => a.id === accountId);
  const destination = accounts.find((a) => a.id === destinationAccountId);
  const labels =
    source && destination
      ? transferLabels(source.account_type, destination.account_type)
      : { out: "Transfer out", in: "Transfer in" };
  const isWithdrawal = labels.out === "Cash Withdrawal";
  const isDeposit = labels.out === "Cash Deposit";

  function handleSubmit(formData: FormData) {
    const amount = Number(formData.get("amount"));
    const transactionDate = formData.get("transactionDate") as string;

    const out: OptimisticTransaction = {
      id: crypto.randomUUID(),
      account_id: accountId,
      user_id: source?.user_id ?? "",
      amount: -Math.abs(amount),
      type: "TRANSFER",
      category: null,
      merchant_or_item: labels.out,
      transaction_date: transactionDate,
      loan_id: null,
      job_id: null,
      transfer_group_id: null,
      client_id: null,
      created_at: new Date().toISOString(),
      _pending: true,
    };
    const inbound: OptimisticTransaction = {
      id: crypto.randomUUID(),
      account_id: destinationAccountId,
      user_id: destination?.user_id ?? "",
      amount: Math.abs(amount),
      type: "TRANSFER",
      category: null,
      merchant_or_item: labels.in,
      transaction_date: transactionDate,
      loan_id: null,
      job_id: null,
      transfer_group_id: null,
      client_id: null,
      created_at: new Date().toISOString(),
      _pending: true,
    };

    startTransition(async () => {
      addOptimistic({ type: "add-pair", txs: [out, inbound] });

      const result = await createTransaction({}, formData);
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
        <ArrowLeftRight className="size-4" />
        Transfer
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isWithdrawal ? "Withdraw cash" : isDeposit ? "Deposit cash" : "Transfer between accounts"}
          </DialogTitle>
          <DialogDescription>
            {isWithdrawal
              ? "Pull cash out of a bank account — logged as a Cash Withdrawal on both sides."
              : isDeposit
                ? "Put cash into a bank account — logged as a Cash Deposit on both sides."
                : "Move money from one of your accounts to another."}
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="type" value="TRANSFER" />
          <input type="hidden" name="transactionDate" value={todayLocalISO()} />
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="destinationAccountId" value={destinationAccountId} />

          <div className="grid gap-2">
            <Label>From account</Label>
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
            <Label>To account</Label>
            <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="transfer-amount">Amount</Label>
            <Input
              id="transfer-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm font-medium">{error}</p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isPending || !accountId || accountId === destinationAccountId}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isWithdrawal ? "Withdraw" : isDeposit ? "Deposit" : "Transfer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
