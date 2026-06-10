import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SubTask } from "@/hooks/useSubTasks";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  in_progress: { label: "In Progress", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  review: { label: "In Review", variant: "destructive" },
};

export function SubTaskList({
  subTasks,
  activeId,
  onSelect,
  onMarkComplete,
  reworkFileIds = [],
}: {
  subTasks: SubTask[];
  activeId: string | null;
  onSelect: (st: SubTask) => void;
  onMarkComplete?: (st: SubTask) => void;
  reworkFileIds?: string[];
}) {
  return (
    <div className="space-y-1">
      {subTasks.map((st, i) => {
        const isActive = st.id === activeId;
        const cfg = STATUS_CONFIG[st.status] ?? STATUS_CONFIG.pending;
        const hasRework = st.file?.id ? reworkFileIds.includes(st.file.id) : false;
        const isCompleted = st.status === "completed";
        return (
          <div
            key={st.id}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all text-left",
              hasRework
                ? "bg-orange-500/10 border border-orange-500/30"
                : isActive
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "hover:bg-muted/50 text-muted-foreground",
              !hasRework && "border border-transparent"
            )}
          >
            {onMarkComplete && (
              <Checkbox
                checked={isCompleted}
                onCheckedChange={() => onMarkComplete(st)}
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <button
              onClick={() => onSelect(st)}
              className="flex-1 flex items-center gap-3 min-w-0"
            >
              <span className="font-mono text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn("truncate font-medium", isCompleted ? "line-through text-muted-foreground" : "text-foreground")}>{st.file?.name ?? "Unknown file"}</p>
                  {hasRework && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{st.file?.type ?? "unknown"}</p>
              </div>
              {hasRework ? (
                <Badge variant="outline" className="text-[10px] shrink-0 bg-orange-500/20 text-orange-400 border-orange-500/30">Rework</Badge>
              ) : (
                <Badge variant={cfg.variant} className="text-[10px] shrink-0">{cfg.label}</Badge>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
