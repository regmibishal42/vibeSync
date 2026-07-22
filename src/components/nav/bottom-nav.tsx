"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, LayoutDashboard, ClipboardList, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProfileRole } from "@/lib/types/database.types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const BASE_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/work", label: "Work", icon: ClipboardList },
];

const WALLET_ITEM: NavItem = { href: "/wallet", label: "Wallet", icon: Wallet };
const GYM_ITEM: NavItem = { href: "/gym", label: "Gym", icon: Dumbbell };

export function BottomNav({ role }: { role: ProfileRole }) {
  const pathname = usePathname();

  // Gym is ADMIN-only end to end (RLS blocks the partner from the data
  // entirely), so her nav skips straight from Work to Wallet rather than
  // linking to a page that can only ever show her an empty/blocked state.
  const items =
    role === "ADMIN"
      ? [...BASE_ITEMS, GYM_ITEM, WALLET_ITEM]
      : [...BASE_ITEMS, WALLET_ITEM];

  return (
    <nav
      className="border-border/60 bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto grid h-16 max-w-lg"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 text-xs font-medium"
            >
              <Icon
                className={cn(
                  "size-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
