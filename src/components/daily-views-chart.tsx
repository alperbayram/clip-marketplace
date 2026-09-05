"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  views: { label: "Views", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function DailyViewsChart({
  data,
}: {
  data: { day: string; views: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No campaign period to chart yet.
      </p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="views"
          type="monotone"
          fill="var(--color-views)"
          fillOpacity={0.2}
          stroke="var(--color-views)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
