import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-tag-green" : "text-tag-red"
              )}
            >
              {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}% from last week
            </p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
    </div>
  );
}
