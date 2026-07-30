"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteTransaction } from "@/app/(app)/wallet/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import type { TransactionType } from "@/lib/types/database.types";

// Deleting money is irreversible and this is a one-tap target on a phone, so
// it always confirms first — and says explicitly when a delete will remove
// *two* rows (both legs of a transfer) rather than the one being looked at.
export function DeleteTransactionButton({
  transactionId,
  type,
  amount,
  label,
  currency,
}: {
  transactionId: string;
  type: TransactionType;
  amount: number;
  label: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Loan/repayment rows are owned by the loans tables — the RPC refuses them
  // too, but there's no reason to offer a button that can only ever error.
  if (type === "LOAN" || type === "REPAYMENT") return null;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTransaction(transactionId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transaction deleted");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive size-8 shrink-0"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${label}`}
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this transaction?</DialogTitle>
            <DialogDescription>
              {label} · {formatCurrency(Math.abs(amount), currency)}
              {type === "TRANSFER"
                ? " — this is a transfer, so both sides of it will be removed and both account balances will update."
                : " — the account balance will update to match."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
