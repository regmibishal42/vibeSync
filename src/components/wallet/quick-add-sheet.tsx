"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Delete } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ACCOUNT_TYPE_ICON } from "@/lib/wallet/account-type";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";
import { formatCurrency, todayLocalISO } from "@/lib/format";
import { enqueueQuickAdd } from "@/lib/offline-queue";
import {
  useTransactionsOptimistic,
  type OptimisticTransaction,
} from "@/components/wallet/transactions-provider";
import { cn } from "@/lib/utils";
import type { AccountType, ExpenseCategory } from "@/lib/types/database.types";

type QuickAddAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_type: AccountType;
};

// Cash-register style entry (type digits, they fill in from the right —
// "1250" reads as $12.50) rather than a free-text number input: it's
// impossible to type an invalid amount, which is most of what "unbreakable"
// means for the highest-frequency action in the app.
const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];
const MAX_CENTS = 999_999_999;

export function QuickAddSheet({
  accounts,
  currency,
  open,
  onOpenChange,
}: {
  accounts: QuickAddAccount[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState<"EXPENSE" | "DEPOSIT">("EXPENSE");
  const [cents, setCents] = useState(0);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { addOptimistic } = useTransactionsOptimistic();

  // Falls back to the first account at render time rather than syncing via
  // an effect — accounts arrive fully resolved as a prop (server-fetched),
  // so there's no async external state to synchronize, just a default.
  const selectedAccountId = accountId || accounts[0]?.id || "";

  function reset() {
    setCents(0);
    setType("EXPENSE");
    setCategory("OTHER");
  }

  function pressKey(key: string) {
    setCents((current) => {
      if (key === "⌫") return Math.floor(current / 10);
      const next = key === "00" ? current * 100 : current * 10 + Number(key);
      return next > MAX_CENTS ? current : next;
    });
  }

  const amount = cents / 100;

  function handleSave() {
    if (amount <= 0 || !selectedAccountId || isPending) return;

    const transactionDate = todayLocalISO();
    const account = accounts.find((a) => a.id === selectedAccountId);
    const savedType = type;
    const savedCategory = category;

    const optimisticTx: OptimisticTransaction = {
      id: crypto.randomUUID(),
      account_id: selectedAccountId,
      user_id: account?.user_id ?? "",
      amount: savedType === "EXPENSE" ? -amount : amount,
      type: savedType,
      category: savedType === "EXPENSE" ? savedCategory : null,
      merchant_or_item: null,
      transaction_date: transactionDate,
      loan_id: null,
      job_id: null,
      transfer_group_id: null,
      client_id: null,
      created_at: new Date().toISOString(),
      _pending: true,
    };

    addOptimistic({ type: "add", tx: optimisticTx });
    onOpenChange(false);
    reset();

    const payload = {
      queueId: optimisticTx.id,
      accountId: selectedAccountId,
      type: savedType,
      amount,
      category: savedType === "EXPENSE" ? savedCategory : undefined,
      transactionDate,
    };

    startTransition(async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueQuickAdd(payload);
        toast.success("Saved offline — will sync when you're back online");
        return;
      }

      try {
        const res = await fetch("/api/wallet/quick-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, clientId: payload.queueId }),
        });
        if (!res.ok) throw new Error();
        toast.success(`${savedType === "EXPENSE" ? "Expense" : "Income"} saved`);
        router.refresh();
      } catch {
        enqueueQuickAdd(payload);
        toast.success("Saved offline — will sync when you're back online");
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="sr-only">Quick add</DrawerTitle>
          <div className="bg-muted mx-auto grid w-full max-w-xs grid-cols-2 gap-1 rounded-full p-1">
            <button
              type="button"
              onClick={() => setType("EXPENSE")}
              className={cn(
                "rounded-full py-2 text-sm font-medium transition-colors",
                type === "EXPENSE" ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType("DEPOSIT")}
              className={cn(
                "rounded-full py-2 text-sm font-medium transition-colors",
                type === "DEPOSIT" ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
            >
              Income
            </button>
          </div>
        </DrawerHeader>

        <div className="flex flex-col gap-4 px-5 pb-8">
          <p
            className={cn(
              "text-center text-4xl font-semibold tabular-nums",
              type === "EXPENSE" ? "text-foreground" : "text-shift"
            )}
          >
            {formatCurrency(amount, currency)}
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {accounts.map((a) => {
              const Icon = ACCOUNT_TYPE_ICON[a.account_type];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedAccountId === a.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {a.account_name}
                </button>
              );
            })}
          </div>

          {type === "EXPENSE" ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORY_ORDER.map((c) => {
                const Icon = CATEGORY_META[c].icon;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      category === c
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {CATEGORY_META[c].label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            {KEYPAD_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKey(key)}
                className="hover:bg-muted active:bg-muted flex h-14 items-center justify-center rounded-xl text-xl font-medium transition-colors"
              >
                {key === "⌫" ? <Delete className="size-5" /> : key}
              </button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={amount <= 0 || !selectedAccountId}
            onClick={handleSave}
          >
            Save {formatCurrency(amount, currency)}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
