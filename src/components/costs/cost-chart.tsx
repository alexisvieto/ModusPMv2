"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { formatCompactCurrency } from "@/lib/format";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Datum = { category: string; presupuesto: number; real: number };

const config = {
  presupuesto: { label: "Presupuesto", color: "var(--chart-2)" },
  real: { label: "Costo real", color: "var(--chart-1)" },
} satisfies ChartConfig;

const compact = (v: number) => formatCompactCurrency(v);

export function CostChart({ data }: { data: Datum[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="category"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickFormatter={compact}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="presupuesto" fill="var(--color-presupuesto)" radius={4} />
        <Bar dataKey="real" fill="var(--color-real)" radius={4} />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}
