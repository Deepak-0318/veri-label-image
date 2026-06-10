import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type TagColor = "blue" | "green" | "yellow" | "purple" | "pink" | "orange" | "cyan" | "red";

interface TagBadgeProps {
  label: string;
  color?: TagColor;
  onRemove?: () => void;
  className?: string;
}

const colorClasses: Record<TagColor, string> = {
  blue: "bg-tag-blue/20 text-tag-blue border-tag-blue/30",
  green: "bg-tag-green/20 text-tag-green border-tag-green/30",
  yellow: "bg-tag-yellow/20 text-tag-yellow border-tag-yellow/30",
  purple: "bg-tag-purple/20 text-tag-purple border-tag-purple/30",
  pink: "bg-tag-pink/20 text-tag-pink border-tag-pink/30",
  orange: "bg-tag-orange/20 text-tag-orange border-tag-orange/30",
  cyan: "bg-tag-cyan/20 text-tag-cyan border-tag-cyan/30",
  red: "bg-tag-red/20 text-tag-red border-tag-red/30",
};

export function TagBadge({ label, color = "blue", onRemove, className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all duration-200 hover:scale-105",
        colorClasses[color],
        className
      )}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:bg-white/10 rounded-full p-0.5 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
