import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePipelineRuns, PipelineRun } from "@/hooks/usePipelineRuns";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Workflow,
  FolderOpen,
  Calendar,
  Ban,
  ClipboardList,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  queued: {
    label: "Queued",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Clock,
  },
  running: {
    label: "Running",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Activity,
  },
  completed: {
    label: "Completed",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "bg-destructive/20 text-destructive border-destructive/30",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-muted text-muted-foreground border-border",
    icon: Ban,
  },
};

function RunCard({ run, onCancel, onViewTasks }: { run: PipelineRun; onCancel?: (id: string) => void; onViewTasks?: () => void }) {
  const cfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.queued;
  const StatusIcon = cfg.icon;
  const progress =
    run.total_items > 0 ? (run.completed_items / run.total_items) * 100 : run.progress;
  const isActive = ["queued", "running"].includes(run.status);

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold truncate">
                {run.pipeline?.name || "Unknown Pipeline"}
              </h3>
            </div>
            <Badge variant="outline" className={cfg.color}>
              <StatusIcon
                className={`h-3 w-3 mr-1 ${isActive ? "animate-pulse" : ""}`}
              />
              {cfg.label}
            </Badge>
            {run.pipeline?.pipeline_type && (
              <Badge variant="secondary" className="text-[10px] capitalize">
                {run.pipeline.pipeline_type.replace("_", " ")}
              </Badge>
            )}
          </div>

          {run.project && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <FolderOpen className="h-3 w-3" />
              {run.project.name}
            </div>
          )}

          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
            </span>
            <span>
              {run.completed_items}/{run.total_items} items
            </span>
            {run.completed_at && (
              <span>
                Duration:{" "}
                {formatDistanceToNow(new Date(run.started_at), {
                  includeSeconds: true,
                }).replace("about ", "")}
              </span>
            )}
          </div>

          {run.error_message && (
            <p className="text-xs text-destructive mt-2 bg-destructive/10 rounded-md px-3 py-1.5">
              {run.error_message}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-2xl font-bold tabular-nums">
            {Math.round(progress)}%
          </span>
          {isActive && onCancel && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => onCancel(run.id)}
            >
              <Ban className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
          {!isActive && onViewTasks && (
            <Button variant="outline" size="sm" onClick={onViewTasks}>
              <ClipboardList className="h-3 w-3 mr-1" />
              View Tasks
            </Button>
          )}
        </div>
      </div>

      {(isActive || progress > 0) && (
        <Progress value={progress} className="mt-3 h-1.5" />
      )}
    </div>
  );
}

export default function PipelineRuns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeRuns, completedRuns, isLoading, cancelRun } = usePipelineRuns(user?.id);

  const handleCancel = (runId: string) => cancelRun.mutate(runId);

  const {
    paginatedItems: paginatedCompleted,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage,
  } = usePagination(completedRuns, 10);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 glass border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Pipeline Runs</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor active and completed pipeline executions
              </p>
            </div>
            {activeRuns.length > 0 && (
              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1.5">
                <Activity className="h-3 w-3 animate-pulse" />
                {activeRuns.length} active
              </Badge>
            )}
          </div>
        </header>

        <div className="p-8 space-y-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Active Runs */}
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  Active Runs
                  {activeRuns.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({activeRuns.length})
                    </span>
                  )}
                </h2>
                {activeRuns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                    <Workflow className="h-10 w-10 mx-auto opacity-30 mb-3" />
                    <p className="font-medium">No pipelines running</p>
                    <p className="text-sm mt-1">
                      Run a pipeline from a project page to see progress here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeRuns.map((run) => (
                      <RunCard key={run.id} run={run} onCancel={handleCancel} />
                    ))}
                  </div>
                )}
              </section>

              {/* Completed Runs */}
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  Run History
                  {completedRuns.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      ({completedRuns.length})
                    </span>
                  )}
                </h2>
                {completedRuns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto opacity-30 mb-3" />
                    <p className="font-medium">No previous runs</p>
                    <p className="text-sm mt-1">
                      Completed pipeline runs will appear here
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {paginatedCompleted.map((run) => (
                        <RunCard key={run.id} run={run} onViewTasks={() => navigate("/tasks")} />
                      ))}
                    </div>
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      onPageChange={setCurrentPage}
                    />
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
