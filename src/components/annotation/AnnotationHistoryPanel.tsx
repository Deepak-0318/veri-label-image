import { useQuery } from "@tanstack/react-query";
import { AnnotationApi } from "@/services/apiClient";
import { Loader2, History, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AnnotationHistoryPanelProps {
  annotationId: string;
}

export function AnnotationHistoryPanel({ annotationId }: AnnotationHistoryPanelProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["annotation-history", annotationId],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const storageKey = `sb-${projectId}-auth-token`;
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      try {
        const token = JSON.parse(raw)?.access_token;
        if (!token) return [];
        return AnnotationApi.getHistory(annotationId, token);
      } catch {
        return [];
      }
    },
    enabled: !!annotationId,
  });

  const parseJson = (val: any) => {
    if (!val) return null;
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  };

  const getDiffs = (oldVal: any, newVal: any) => {
    const oldObj = parseJson(oldVal);
    const newObj = parseJson(newVal);
    if (!oldObj || !newObj) return null;

    const diffs: string[] = [];
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of keys) {
      if (key === "updated_at" || key === "created_at" || key === "id") continue;
      
      const ov = oldObj[key];
      const nv = newObj[key];

      if (JSON.stringify(ov) !== JSON.stringify(nv)) {
        if (key === "label") {
          diffs.push(`Label: "${ov}" → "${nv}"`);
        } else if (key === "color") {
          diffs.push(`Color changed`);
        } else if (key === "qc_status") {
          diffs.push(`QC Status: ${ov || "none"} → ${nv || "none"}`);
        } else if (key === "qc_comment") {
          diffs.push(`QC Comment: "${ov || ""}" → "${nv || ""}"`);
        } else if (key === "comment") {
          diffs.push(`Comment: "${ov || ""}" → "${nv || ""}"`);
        } else if (key === "data") {
          diffs.push(`Geometry / coordinates updated`);
        }
      }
    }

    return diffs;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-xs">
        No history records found for this annotation.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-h-[300px] overflow-y-auto">
      <div className="relative border-l-2 border-muted pl-4 space-y-6">
        {history.map((event: any, idx: number) => {
          const diffs = getDiffs(event.oldValues, event.newValues);
          return (
            <div key={idx} className="relative space-y-1">
              {/* Timeline marker */}
              <div className="absolute -left-[25px] top-1 bg-background border-2 border-muted h-3.5 w-3.5 rounded-full flex items-center justify-center">
                <div className="h-1.5 w-1.5 bg-primary rounded-full" />
              </div>
              
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground capitalize flex items-center gap-1">
                  <History className="h-3 w-3" />
                  {event.action?.replace("_", " ")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {event.createdAt ? formatDistanceToNow(new Date(event.createdAt), { addSuffix: true }) : ""}
                </span>
              </div>
              
              <p className="text-xs text-foreground/90">{event.description}</p>
              
              {diffs && diffs.length > 0 && (
                <div className="mt-1 text-[10px] bg-muted/40 rounded px-2 py-1 space-y-0.5 text-muted-foreground font-mono">
                  {diffs.map((d, dIdx) => (
                    <div key={dIdx}>{d}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
