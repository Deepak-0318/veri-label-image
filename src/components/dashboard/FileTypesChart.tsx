import { useMemo } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface FileTypesChartProps {
  files: { type: string }[];
}

const TYPE_COLORS: Record<string, string> = {
  image: "hsl(var(--tag-blue))",
  text: "hsl(var(--tag-green))",
  audio: "hsl(var(--tag-orange))",
  video: "hsl(var(--tag-purple))",
  pdf: "hsl(var(--tag-red))",
  spreadsheet: "hsl(var(--tag-cyan))",
  other: "hsl(var(--muted-foreground))",
};

function categorize(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/")) return "text";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "spreadsheet";
  return "other";
}

const chartConfig: ChartConfig = {
  image: { label: "Images", color: TYPE_COLORS.image },
  text: { label: "Text", color: TYPE_COLORS.text },
  audio: { label: "Audio", color: TYPE_COLORS.audio },
  video: { label: "Video", color: TYPE_COLORS.video },
  pdf: { label: "PDF", color: TYPE_COLORS.pdf },
  spreadsheet: { label: "Spreadsheet", color: TYPE_COLORS.spreadsheet },
  other: { label: "Other", color: TYPE_COLORS.other },
};

export function FileTypesChart({ files }: FileTypesChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    files.forEach((f) => {
      const cat = categorize(f.type);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      fill: TYPE_COLORS[name] || TYPE_COLORS.other,
    }));
  }, [files]);

  if (!data.length) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">File Types</CardTitle>
          <CardDescription>No files yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">File Types</CardTitle>
        <CardDescription>Distribution by category</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-[180px] flex-shrink-0">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-col gap-2">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 text-sm">
              <div
                className="h-3 w-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-muted-foreground capitalize">{entry.name}</span>
              <span className="font-medium ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
