import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "finance" | "shift" | "fitness" | "warning" | "neutral";

const ACCENT: Record<Accent, string> = {
  finance: "bg-finance/12 text-finance",
  shift: "bg-shift/12 text-shift",
  fitness: "bg-fitness/12 text-fitness",
  warning: "bg-warning/12 text-warning",
  neutral: "bg-muted text-muted-foreground",
};

// An empty screen is the first thing a new user sees, so it does the most
// work of any state in the app — yet these were all a grey icon over
// "Nothing yet", which explains nothing and offers nowhere to go.
//
// Three jobs, in order: say what belongs here, say why it's worth doing, and
// put the action that creates the first one directly in reach. The `action`
// slot takes the same real form/button used elsewhere, so an empty screen is
// never a dead end the user has to navigate away from.
export function EmptyState({
  icon: Icon,
  title,
  description,
  hint,
  accent = "neutral",
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  hint?: string;
  accent?: Accent;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "items-center gap-3 px-6 py-10 text-center",
        className
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-2xl",
          ACCENT[accent]
        )}
      >
        <Icon className="size-6" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-[34ch] text-sm text-balance">
          {description}
        </p>
      </div>

      {action ? <div className="pt-1">{action}</div> : null}

      {hint ? (
        <p className="text-muted-foreground/80 mx-auto max-w-[38ch] text-xs text-balance">
          {hint}
        </p>
      ) : null}
    </Card>
  );
}
