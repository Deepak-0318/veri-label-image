import { useMemo } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AnnotationProgressChartProps {
  annotations: { label: string; color: string }[];
}

const chartConfig: ChartConfig = {
  count: { label: "Annotations", color: "hsl(var(--primary))" },
};

export function AnnotationProgressChart({ annotations }: AnnotationProgressChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, { count: number; color: string }> = {};
    annotations.forEach((a) => {
      if (!counts[a.label]) counts[a.label] = { count: 0, color: a.color };
      counts[a.label].count++;
    });
    return Object.entries(counts)
      .map(([label, { count, color }]) => ({ label, count, fill: color }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [annotations]);

  if (!data.length) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Annotations by Label</CardTitle>
          <CardDescription>No annotations yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Annotations by Label</CardTitle>
        <CardDescription>Top labels used across files</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill || "hsl(var(--primary))"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}


