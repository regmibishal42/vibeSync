import { Banknote, CreditCard, Wallet as WalletIcon, type LucideIcon } from "lucide-react";

import type { AccountType } from "@/lib/types/database.types";

// Extracted from account-card.tsx so transaction-list.tsx and
// transaction-form.tsx can show the same "paid via which bank/cash/wallet"
// icon+label without duplicating the map.
export const ACCOUNT_TYPE_ICON: Record<AccountType, LucideIcon> = {
  DIGITAL_WALLET: WalletIcon,
  BANK: Banknote,
  CASH: CreditCard,
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  DIGITAL_WALLET: "Digital wallet",
  BANK: "Bank",
  CASH: "Cash",
};
