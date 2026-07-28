"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuickAddSheet } from "@/components/wallet/quick-add-sheet";
import type { AccountType } from "@/lib/types/database.types";

type QuickAddAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_type: AccountType;
};

export function QuickAddButton({
  accounts,
  currency,
}: {
  accounts: QuickAddAccount[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="finance" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Quick add
      </Button>
      <QuickAddSheet accounts={accounts} currency={currency} open={open} onOpenChange={setOpen} />
    </>
  );
}
