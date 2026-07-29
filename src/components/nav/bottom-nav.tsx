"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Wallet, HandCoins } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/work", label: "Work", icon: ClipboardList },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/loans", label: "Loans", icon: HandCoins },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-border/60 bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto grid h-16 max-w-lg"
        style={{ gridTemplateColumns: `repeat(${ITEMS.length}, minmax(0, 1fr))` }}
      >
        {ITEMS.map((item) => {
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
