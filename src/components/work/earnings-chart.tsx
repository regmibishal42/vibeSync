"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  pay: { label: "Hourly pay", color: "var(--shift)" },
} satisfies ChartConfig;

export function EarningsChart({ data }: { data: { date: string; pay: number }[] }) {
  const hasData = data.some((d) => d.pay > 0);

  if (!hasData) {
    return (
      <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
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
