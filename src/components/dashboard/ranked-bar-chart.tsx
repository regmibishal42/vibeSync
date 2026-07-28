"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Generic "which one is biggest" horizontal bar — shared by the dashboard's
// bank-wise, job-wise, and top-spending-category breakdowns, all the same
// single-hue sorted-magnitude shape as wallet's CategorySpendChart/
// BalanceChart. Kept separate from those two (rather than swapping them to
// this) since their data means something narrower (a snapshot balance, a
// fixed category set) that doesn't need a reusable label/amount shape.
export function RankedBarChart({
  data,
  color = "var(--finance)",
  valueLabel = "Amount",
  emptyMessage = "Nothing to show yet.",
}: {
  data: { label: string; amount: number }[];
  color?: string;
  valueLabel?: string;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        {emptyMessage}
      </div>
    );
  }

  const chartConfig = { amount: { label: valueLabel, color } } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="h-48 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={90}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={4} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}
