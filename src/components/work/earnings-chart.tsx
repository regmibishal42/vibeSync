"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  hotel: { label: "Hotel", color: "var(--shift)" },
  secondary: { label: "Secondary", color: "color-mix(in oklch, var(--shift) 55%, transparent)" },
} satisfies ChartConfig;

export function EarningsChart({
  data,
}: {
  data: { date: string; hotel: number; secondary: number }[];
}) {
  const hasData = data.some((d) => d.hotel > 0 || d.secondary > 0);

  if (!hasData) {
    return (
      <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
        Log a shift to see your earnings trend.
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
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="hotel"
          stackId="earnings"
          fill="var(--color-hotel)"
          radius={[0, 0, 4, 4]}
        />
        <Bar
          dataKey="secondary"
          stackId="earnings"
          fill="var(--color-secondary)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
