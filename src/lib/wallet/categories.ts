import {
  Home,
  Smartphone,
  ShoppingCart,
  Plane,
  Zap,
  Car,
  UtensilsCrossed,
  HeartPulse,
  ShoppingBag,
  Pill,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

import type { ExpenseCategory } from "@/lib/types/database.types";

// Single source of truth for category display — reused by the transaction
// form, transaction list, category spend chart, recurring-bill form, and
// CSV export, so the label/icon per category never drifts between them.
export const CATEGORY_ORDER: ExpenseCategory[] = [
  "RENT",
  "SIM_PLAN",
  "GROCERIES",
  "TRAVEL",
  "UTILITIES",
  "TRANSPORT",
  "DINING",
  "HEALTH",
  "SHOPPING",
  "SUPPLEMENTS",
  "OTHER",
];

export const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: LucideIcon }> = {
  RENT: { label: "Rent", icon: Home },
  SIM_PLAN: { label: "Sim plan", icon: Smartphone },
  GROCERIES: { label: "Groceries", icon: ShoppingCart },
  TRAVEL: { label: "Travel", icon: Plane },
  UTILITIES: { label: "Utilities", icon: Zap },
  TRANSPORT: { label: "Transport", icon: Car },
  DINING: { label: "Dining", icon: UtensilsCrossed },
  HEALTH: { label: "Health", icon: HeartPulse },
  SHOPPING: { label: "Shopping", icon: ShoppingBag },
  SUPPLEMENTS: { label: "Supplements", icon: Pill },
  OTHER: { label: "Other", icon: MoreHorizontal },
};
