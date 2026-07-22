"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dumbbell,
  Loader2,
  Plus,
  Receipt,
  Timer,
  BedDouble,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import type { ProfileRole } from "@/lib/types/database.types";
import { logSecondaryShift } from "@/app/(app)/work/actions";

type Accent = "fitness" | "finance" | "shift";

// Tailwind's compiler needs static, literal class strings to find at build
// time — `bg-${accent}/15` in a template literal would never be generated.
const ACCENT_CLASSES: Record<Accent, string> = {
  fitness: "bg-fitness/15 text-fitness",
  finance: "bg-finance/15 text-finance",
  shift: "bg-shift/15 text-shift",
};

type QuickAction =
  | { kind: "link"; href: string; label: string; description: string; icon: typeof Plus; accent: Accent }
  | { kind: "instant"; label: string; description: string; icon: typeof Plus; accent: Accent };

const ADMIN_ACTIONS: QuickAction[] = [
  {
    kind: "link",
    href: "/gym?quick=set",
    label: "Log gym set",
    description: "Weight, reps, sets for today's session",
    icon: Dumbbell,
    accent: "fitness",
  },
  {
    kind: "link",
    href: "/wallet?quick=expense",
    label: "Log expense",
    description: "Add a spend to any of your accounts",
    icon: Receipt,
    accent: "finance",
  },
];

const PARTNER_ACTIONS: QuickAction[] = [
  {
    kind: "instant",
    label: "Log 2-hour shift",
    description: "Instantly logs today's secondary job — $50",
    icon: Timer,
    accent: "shift",
  },
  {
    kind: "link",
    href: "/work?quick=hotel",
    label: "Log room / shift",
    description: "Room credits from today's hotel shift",
    icon: BedDouble,
    accent: "shift",
  },
  {
    kind: "link",
    href: "/wallet?quick=expense",
    label: "Log expense",
    description: "Add a spend to any of your accounts",
    icon: Receipt,
    accent: "finance",
  },
];

export function FabQuickLog({ role }: { role: ProfileRole }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const actions = role === "ADMIN" ? ADMIN_ACTIONS : PARTNER_ACTIONS;

  function handleInstant(action: Extract<QuickAction, { kind: "instant" }>) {
    startTransition(async () => {
      const result = await logSecondaryShift();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${action.label} logged — $${result?.amount?.toFixed(2)}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <Button
        size="fab"
        onClick={() => setOpen(true)}
        aria-label="Quick log"
        className="glow-shift fixed bottom-20 left-1/2 z-50 -translate-x-1/2 shadow-xl"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Plus className="size-7" />
      </Button>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Quick log</DrawerTitle>
          <DrawerDescription>Jump straight into logging something.</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2 px-5 pb-8">
          {actions.map((action) => {
            const Icon = action.icon;
            const content = (
              <>
                <span
                  className={`${ACCENT_CLASSES[action.accent]} flex size-11 shrink-0 items-center justify-center rounded-xl`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex flex-col text-left">
                  <span className="text-sm font-medium">{action.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {action.description}
                  </span>
                </span>
                {action.kind === "instant" && isPending ? (
                  <Loader2 className="ml-auto size-4 animate-spin" />
                ) : null}
              </>
            );

            if (action.kind === "link") {
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="hover:bg-accent flex items-center gap-3 rounded-xl p-3 transition-colors"
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={action.label}
                type="button"
                disabled={isPending}
                onClick={() => handleInstant(action)}
                className="hover:bg-accent flex items-center gap-3 rounded-xl p-3 text-left transition-colors disabled:opacity-60"
              >
                {content}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
