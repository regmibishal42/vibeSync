import { HandCoins } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/format";
import type { Database } from "@/lib/types/database.types";

type PayoutBatch = Database["public"]["Tables"]["payout_batches"]["Row"];

export function PayoutBatchList({
  batches,
  jobNames,
  currency,
}: {
  batches: PayoutBatch[];
  jobNames: Map<string, string>;
  currency: string;
}) {
  if (batches.length === 0) {
    return (
      <EmptyState
        icon={HandCoins}
        accent="warning"
        title="No payouts settled yet"
        description="When an hourly job pays out, settle it here — the pending shifts bundle into one payout and the deposit posts to your wallet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {batches.map((batch) => (
        <Card key={batch.id} className="gap-1 py-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex flex-col">
              <span className="font-medium">{jobNames.get(batch.job_id) ?? "Job"}</span>
              <span className="text-muted-foreground text-xs">
                {new Date(batch.paid_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <span className="text-finance font-semibold">
              {formatCurrency(batch.total_amount, currency)}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}
