"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { dayMonthShort } from "@/lib/format";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Point = { date: string; plan: number | null; real: number | null };

const config = {
  plan: { label: "Plan", color: "var(--chart-2)" },
  real: { label: "Avance real", color: "var(--chart-1)" },
} satisfies ChartConfig;

function fmtTick(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return dayMonthShort(new Date(y, m - 1, day));
}

export function SCurve({ data }: { data: Point[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillPlan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-plan)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--color-plan)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-real)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-real)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={fmtTick}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => {
                const d = p?.[0]?.payload?.date as string | undefined;
                return d ? fmtTick(d) : "";
              }}
            />
          }
        />
        <Area
          dataKey="plan"
          type="monotone"
          stroke="var(--color-plan)"
          strokeWidth={2}
          strokeDasharray="5 4"
          fill="url(#fillPlan)"
          dot={false}
        />
        <Area
          dataKey="real"
          type="monotone"
          stroke="var(--color-real)"
          strokeWidth={2.5}
          fill="url(#fillReal)"
          dot={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
