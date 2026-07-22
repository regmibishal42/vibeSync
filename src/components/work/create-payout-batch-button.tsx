"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HandCoins } from "lucide-react";
import { toast } from "sonner";

import { createPayoutBatch } from "@/app/(app)/work/actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

export function CreatePayoutBatchButton({
  pendingTotal,
}: {
  pendingTotal: number;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await createPayoutBatch();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Payout batch created — ${formatCurrency(result?.amount ?? 0, "AUD")}`
      );
      router.refresh();
    });
  }

  return (
    <Button
      variant="finance"
      className="w-full"
      disabled={isPending || pendingTotal <= 0}
      onClick={handleClick}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <HandCoins className="size-4" />
      )}
      Reconcile {formatCurrency(pendingTotal, "AUD")} pending
    </Button>
  );
}
