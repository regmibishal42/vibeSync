"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RANGE_LABEL, RANGE_ORDER, type RangeKey } from "@/lib/dashboard";

// Range lives in the URL so it survives reload and back/forward, and so the
// server can resolve the same window the summary was computed for.
export function RangePicker({
  active,
  rangeLabel,
}: {
  active: RangeKey;
  rangeLabel: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setRange(key: RangeKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    if (key !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.replace(`/?${params.toString()}`);
  }

  function setBound(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted flex gap-1 overflow-x-auto rounded-full p-1">
        {RANGE_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active === key ? "bg-card shadow-sm" : "text-muted-foreground"
            )}
          >
            {RANGE_LABEL[key]}
          </button>
        ))}
      </div>

      {active === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              defaultValue={searchParams.get("from") ?? ""}
              onChange={(e) => setBound("from", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              defaultValue={searchParams.get("to") ?? ""}
              onChange={(e) => setBound("to", e.target.value)}
            />
          </div>
        </div>
      ) : null}

      <p className="text-muted-foreground text-center text-xs">{rangeLabel}</p>
    </div>
  );
}
