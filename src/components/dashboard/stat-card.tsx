import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "finance" | "fitness" | "shift" | "warning" | "neutral";

const ACCENT_TEXT: Record<Accent, string> = {
  finance: "text-finance",
  fitness: "text-fitness",
  shift: "text-shift",
  warning: "text-warning",
  neutral: "text-foreground",
};

const ACCENT_ICON_BG: Record<Accent, string> = {
  finance: "bg-finance/15 text-finance",
  fitness: "bg-fitness/15 text-fitness",
  shift: "bg-shift/15 text-shift",
  warning: "bg-warning/15 text-warning",
  neutral: "bg-muted text-foreground",
};

// Stat tile per the dataviz skill's contract: label (sentence case, no
// trailing colon) + value (semibold, proportional figures — never
// tabular-nums here, that's reserved for aligned table columns).
export function StatCard({
  label,
  value,
  icon,
  accent = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <Card className={cn("gap-2 py-4", className)}>
      <div className="flex items-center justify-between px-4">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        {icon ? (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-lg",
              ACCENT_ICON_BG[accent]
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className={cn("px-4 text-2xl font-semibold", ACCENT_TEXT[accent])}>
        {value}
      </div>
    </Card>
  );
}
