"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search, SlidersHorizontal, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";
import { ACCOUNT_TYPE_ICON } from "@/lib/wallet/account-type";
import type { AccountType } from "@/lib/types/database.types";

const ALL = "ALL";

const TYPE_LABEL: Record<string, string> = {
  EXPENSE: "Expense",
  DEPOSIT: "Deposit",
  TRANSFER: "Transfer",
  LOAN: "Loan",
  REPAYMENT: "Repayment",
};

const FILTER_KEYS = ["category", "type", "account", "from", "to", "q", "min", "max"];

// Every filter lives in the URL rather than component state: it survives a
// reload, is shareable, and — because the page then re-renders from the
// server — keeps pagination honest, since a filter change starts a fresh
// first page instead of paging on through a stale result set.
export function TransactionFilters({
  accounts,
}: {
  accounts: { id: string; account_name: string; account_type: AccountType }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCount = FILTER_KEYS.filter((k) => searchParams.get(k)).length;
  // Open by default when arriving on an already-filtered URL, otherwise the
  // active filters are invisible and look like missing data.
  const [showAdvanced, setShowAdvanced] = useState(activeCount > 0);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/wallet?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Search merchant / item"
            className="pl-9"
            onChange={(e) => setParam("q", e.target.value)}
          />
        </div>
        <Button
          variant={activeCount > 0 ? "default" : "outline"}
          size="icon"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-label="Advanced filters"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
        <Button variant="outline" size="icon" asChild>
          <a href={`/api/wallet/export?${searchParams.toString()}`} download>
            <Download className="size-4" />
          </a>
        </Button>
      </div>

      {showAdvanced ? (
        <div className="border-border/60 bg-card flex flex-col gap-3 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Category</Label>
              <Select
                value={searchParams.get("category") ?? ALL}
                onValueChange={(v) => setParam("category", v === ALL ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any category</SelectItem>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={searchParams.get("type") ?? ALL}
                onValueChange={(v) => setParam("type", v === ALL ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any type</SelectItem>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Account</Label>
            <Select
              value={searchParams.get("account") ?? ALL}
              onValueChange={(v) => setParam("account", v === ALL ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Any account</SelectItem>
                {accounts.map((a) => {
                  const Icon = ACCOUNT_TYPE_ICON[a.account_type];
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-3.5" />
                        {a.account_name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Min amount</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0"
                defaultValue={searchParams.get("min") ?? ""}
                onChange={(e) => setParam("min", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Max amount</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Any"
                defaultValue={searchParams.get("max") ?? ""}
                onChange={(e) => setParam("max", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                defaultValue={searchParams.get("from") ?? ""}
                onChange={(e) => setParam("from", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                defaultValue={searchParams.get("to") ?? ""}
                onChange={(e) => setParam("to", e.target.value)}
              />
            </div>
          </div>

          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => router.replace("/wallet")}>
              <X className="size-3.5" />
              Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
