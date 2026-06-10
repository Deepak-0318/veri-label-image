import { Monitor, Cpu, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PerformanceLevel, usePerformanceSettings } from "@/hooks/usePerformanceSettings";

const OPTIONS: Array<{
  value: PerformanceLevel;
  label: string;
  icon: typeof Monitor;
  description: string;
  details: string;
}> = [
  {
    value: "high",
    label: "High",
    icon: Zap,
    description: "For powerful machines",
    details: "150-frame cache, large decode batches, hardware GPU decoding",
  },
  {
    value: "mid",
    label: "Medium",
    icon: Monitor,
    description: "Balanced performance",
    details: "60-frame cache, moderate batches, hardware GPU decoding",
  },
  {
    value: "low",
    label: "Low",
    icon: Cpu,
    description: "For 8 GB RAM / limited GPU",
    details: "Compressed JPEG frames, 500-frame cap, software decoding, minimal memory",
  },
];

export function RenderingPerformanceCard() {
  const { level, setLevel } = usePerformanceSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-primary" />
          Rendering Performance
        </CardTitle>
        <CardDescription>
          Adjust memory and decoding settings for MCAP / video annotation playback
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = level === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setLevel(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer",
                  isActive
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50"
                )}
              >
                <div className={cn("rounded-full p-2.5 transition-colors", isActive ? "bg-primary/20" : "bg-muted")}>
                  <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="text-center">
                  <p className={cn("font-semibold text-sm", isActive ? "text-foreground" : "text-muted-foreground")}>
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1 leading-tight">{option.details}</p>
                </div>
                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Changes take effect next time you open an MCAP file. Lower settings reduce memory usage and prevent blank screens on weaker machines.
        </p>
      </CardContent>
    </Card>
  );
}
