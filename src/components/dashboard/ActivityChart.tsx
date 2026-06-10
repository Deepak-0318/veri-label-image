import { useMemo } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ActivityChartProps {
  files: { created_at: string }[];
  annotations: { created_at: string }[];
}

const chartConfig: ChartConfig = {
  files: { label: "Files", color: "hsl(var(--primary))" },
  annotations: { label: "Annotations", color: "hsl(var(--tag-purple))" },
};

export function ActivityChart({ files, annotations }: ActivityChartProps) {
  const data = useMemo(() => {
    const days = 7;
    const now = new Date();
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStr = date.toISOString().split("T")[0];
      const label = date.toLocaleDateString("en-US", { weekday: "short" });

      const fileCount = files.filter(
        (f) => f.created_at.split("T")[0] === dayStr
      ).length;
      const annCount = annotations.filter(
        (a) => a.created_at.split("T")[0] === dayStr
      ).length;

      result.push({ day: label, files: fileCount, annotations: annCount });
    }
    return result;
  }, [files, annotations]);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Weekly Activity</CardTitle>
        <CardDescription>Files uploaded & annotations created</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="fillFiles" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillAnnotations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--tag-purple))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--tag-purple))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="files"
              stroke="hsl(var(--primary))"
              fill="url(#fillFiles)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="annotations"
              stroke="hsl(var(--tag-purple))"
              fill="url(#fillAnnotations)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
