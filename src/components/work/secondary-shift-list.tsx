import { Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { Database } from "@/lib/types/database.types";

type SecondaryShift = Database["public"]["Tables"]["secondary_shifts"]["Row"];

export function SecondaryShiftList({ shifts }: { shifts: SecondaryShift[] }) {
  if (shifts.length === 0) {
    return (
      <Card className="items-center justify-center py-10 text-center">
        <Timer className="text-muted-foreground mx-auto size-8" />
        <p className="text-muted-foreground px-4 text-sm">
          No secondary shifts logged yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {shifts.map((shift) => (
        <Card key={shift.id} className="gap-2 py-4">
          <div className="flex items-center justify-between px-4">
            <div className="flex flex-col">
              <span className="font-medium">
                {new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString(
                  undefined,
                  { weekday: "short", month: "short", day: "numeric" }
                )}
              </span>
              <span className="text-muted-foreground text-xs">
                {shift.hours_worked}h @ ${shift.hourly_rate.toFixed(2)}/hr
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-shift font-semibold">
                {formatCurrency(shift.calculated_pay, "AUD")}
              </span>
              <Badge variant={shift.payout_status === "PAID" ? "finance" : "warning"}>
                {shift.payout_status}
              </Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
