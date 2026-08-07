"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { toLocalDateKey } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";

const chartConfig = {
  pay: { label: "Hourly pay", color: "var(--shift)" },
} satisfies ChartConfig;

type Shift = { shift_date: string; calculated_pay: number };

// Takes raw shifts and buckets them here rather than receiving pre-bucketed
// data from the server. "The last 14 days" is a question about the viewer's
// own calendar: computed server-side it was both frozen into the prerendered
// shell and calculated in the server's timezone, so the window could be off
// by a day for anyone not on UTC.
function buildBuckets(shifts: Shift[]) {
  const byDate = new Map<string, number>();
  for (const s of shifts) {
    byDate.set(s.shift_date, (byDate.get(s.shift_date) ?? 0) + s.calculated_pay);
  }

  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = toLocalDateKey(d);
    return {
      date: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
      pay: byDate.get(key) ?? 0,
    };
  });
}

export function EarningsChart({ shifts }: { shifts: Shift[] }) {
  const isClient = useIsClient();
  const data = isClient ? buildBuckets(shifts) : null;

  if (!data) {
    return <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />;
  }

  if (!data.some((d) => d.pay > 0)) {
    return (
      <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
        Log an hourly shift to see your earnings trend.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart data={data} barCategoryGap={4}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          interval="preserveStartEnd"
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="pay" fill="var(--color-pay)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
