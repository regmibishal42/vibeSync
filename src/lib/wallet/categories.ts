import {
  Home,
  Smartphone,
  ShoppingCart,
  Plane,
  ShoppingBag,
  Clapperboard,
  Repeat,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

import type { ExpenseCategory } from "@/lib/types/database.types";

// Single source of truth for category display — reused by the transaction
// form, transaction list, category spend chart, recurring-transaction form,
// and CSV export, so the label/icon per category never drifts between them.
export const CATEGORY_ORDER: ExpenseCategory[] = [
  "RENT",
  "TRAVEL",
  "PHONE_BILL",
  "GROCERIES",
  "SHOPPING",
  "ENTERTAINMENT",
  "SUBSCRIPTIONS",
  "OTHER",
];

export const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: LucideIcon }> = {
  RENT: { label: "Rent", icon: Home },
  TRAVEL: { label: "Travel", icon: Plane },
  PHONE_BILL: { label: "Phone bill", icon: Smartphone },
  GROCERIES: { label: "Groceries", icon: ShoppingCart },
  SHOPPING: { label: "Shopping", icon: ShoppingBag },
  ENTERTAINMENT: { label: "Entertainment", icon: Clapperboard },
  SUBSCRIPTIONS: { label: "Subscriptions", icon: Repeat },
  OTHER: { label: "Other", icon: MoreHorizontal },
};
