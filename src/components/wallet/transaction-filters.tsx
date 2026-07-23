"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CATEGORY_ORDER, CATEGORY_META } from "@/lib/wallet/categories";

const ALL_CATEGORIES = "ALL";

export function TransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
        <Select
          value={searchParams.get("category") ?? ALL_CATEGORIES}
          onValueChange={(v) => setParam("category", v === ALL_CATEGORIES ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {CATEGORY_ORDER.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_META[c].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          className="flex-1"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="date"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" size="icon" asChild>
          <a href={`/api/wallet/export?${searchParams.toString()}`} download>
            <Download className="size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
