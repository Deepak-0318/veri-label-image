import { useState, useCallback, useEffect ,useMemo} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, PanelLeftClose, PanelLeftOpen, Shield, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useTasks } from "@/hooks/useTasks";
import { useSubTasks, SubTask } from "@/hooks/useSubTasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SubTaskList } from "@/components/perform-task/SubTaskList";
import { TaskAnnotationWorkspace } from "@/components/perform-task/TaskAnnotationWorkspace";
import { QCWorkspace } from "@/components/perform-task/QCWorkspace";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  in_progress: { label: "In Progress", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  review: { label: "In Review", variant: "destructive" },
};

export default function PerformTask() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQCMode = searchParams.get("mode") === "qc";
  const { user } = useAuth();
  const { isAdmin } = useUserRole(user?.id);

  const { tasks, isLoading: tasksLoading, updateTask } = useTasks(user?.id);
  const task = tasks.find(t => t.id === taskId);

  const canAccessTask =
    isAdmin ||
    (!isQCMode && (task?.assigned_to === user?.id || task?.assigned_to === null)) ||
    (isQCMode && (task?.qa_assigned_to === user?.id || task?.qa_assigned_to === null));

  const { subTasks, isLoading: subTasksLoading, updateStatus } = useSubTasks(taskId);
  const [activeSubTaskId, setActiveSubTaskId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const activeSubTask = subTasks.find(st => st.id === activeSubTaskId) ?? null;

  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [completeBlockedOpen, setCompleteBlockedOpen] = useState(false);
  const [completePendingOpen, setCompletePendingOpen] = useState(false);
  const [statusCounts, setStatusCounts] = useState<{ total: number; approved: number; rework: number; pending: number }>({ total: 0, approved: 0, rework: 0, pending: 0 });
  const [checkingStatuses, setCheckingStatuses] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const handler = () =>
      setPortalContainer(document.fullscreenElement as HTMLElement | null);
    document.addEventListener("fullscreenchange", handler);
    setPortalContainer(document.fullscreenElement as HTMLElement | null);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Shift task to in_progress if an annotator opens a pending task
  useEffect(() => {
    if (task && task.status === "pending" && !isQCMode && subTasks.length > 0) {
      updateTask.mutate({ id: task.id, status: "in_progress" });
    }
  }, [task, isQCMode, subTasks.length, updateTask]);

  // Query which files have rework annotations


 const fileIdsKey = useMemo(() => {
  return subTasks
    .map(st => st.file?.id)
    .filter(Boolean)
    .sort()
    .join(",");
}, [subTasks]);

const [reworkFileIds, setReworkFileIds] = useState<string[]>([]);

useEffect(() => {
  if (!task || task.qa_status !== "rework" || subTasks.length === 0) {
    setReworkFileIds(prev => (prev.length === 0 ? prev : []));
    return;
  }

  const fileIds = subTasks
    .map(st => st.file?.id)
    .filter(Boolean) as string[];

  if (fileIds.length === 0) return;

  supabase
    .from("annotations")
    .select("file_id")
    .in("file_id", fileIds)
    .eq("qc_status", "rework")
    .eq("project_id", task.project_id)
    .then(({ data }) => {
      if (data) {
        const ids = [...new Set(data.map(d => d.file_id))];

        setReworkFileIds(prev =>
          JSON.stringify(prev) === JSON.stringify(ids) ? prev : ids
        );
      }
    });
}, [task?.qa_status, task?.project_id, fileIdsKey]);

  const firstIncomplete = subTasks.find(st => st.status !== "completed");
  const effectiveSubTask = activeSubTask ?? (firstIncomplete || subTasks[0]) ?? null;

  const completedCount = subTasks.filter(st => st.status === "completed").length;
  const progress = subTasks.length > 0 ? (completedCount / subTasks.length) * 100 : 0;

  const handleSelectSubTask = useCallback((st: SubTask) => {
    setActiveSubTaskId(st.id);
    if (st.status === "pending" && !isQCMode) {
      updateStatus.mutate({ id: st.id, status: "in_progress" });
    }
  }, [updateStatus, isQCMode]);

  const handleMarkComplete = useCallback(async () => {
    if (!effectiveSubTask) return;
    updateStatus.mutate({ id: effectiveSubTask.id, status: "completed" });
    toast.success(isQCMode ? "Sub-task reviewed" : "Sub-task marked for QC");

    const currentIdx = subTasks.findIndex(st => st.id === effectiveSubTask.id);
    const next = subTasks.slice(currentIdx + 1).find(st => st.status !== "completed");

    const remainingIncomplete = subTasks.filter(
      st => st.status !== "completed" && st.id !== effectiveSubTask.id
    );
    if (remainingIncomplete.length === 0 && task) {
      if (isQCMode) {
        // Check if any annotations across all sub-task files have rework status
        const fileIds = subTasks.map(st => st.file?.id).filter(Boolean) as string[];
        if (fileIds.length > 0) {
          const { data: reworkAnnotations } = await supabase
            .from("annotations")
            .select("id")
            .in("file_id", fileIds)
            .eq("qc_status", "rework")
            .eq("project_id", task.project_id)
            .limit(1);

          if (reworkAnnotations && reworkAnnotations.length > 0) {
            // Push task back to annotator for rework
            setTimeout(() => {
              // Reset sub-tasks to pending so annotator can rework
              subTasks.forEach(st => {
                updateStatus.mutate({ id: st.id, status: "pending" });
              });
              updateTask.mutate({
                id: task.id,
                status: "in_progress",
                qa_status: "rework",
              });
              toast.info("Task sent back to annotator for rework");
            }, 500);
            if (next) setActiveSubTaskId(next.id);
            return;
          }
        }
        // No rework annotations — complete the task
        setTimeout(() => {
          updateTask.mutate({ id: task.id, status: "completed", qa_status: "completed" });
          toast.success("QC review complete — task marked as completed");
        }, 500);
      } else {
        // Annotator finished — move task to review pool (no QA dialog)
        setTimeout(() => {
          updateTask.mutate({ id: task.id, status: "review", qa_status: "pending" });
          toast.success("All sub-tasks completed — task moved to QC review pool");
        }, 500);
      }
    }

    if (next) {
      setActiveSubTaskId(next.id);
      if (next.status === "pending" && !isQCMode) {
        updateStatus.mutate({ id: next.id, status: "in_progress" });
      }
    }
  }, [effectiveSubTask, subTasks, updateStatus, task, isQCMode, updateTask]);

  const navigateSubTask = useCallback((dir: "prev" | "next") => {
    const idx = subTasks.findIndex(st => st.id === effectiveSubTask?.id);
    const newIdx = dir === "prev" ? idx - 1 : idx + 1;
    if (newIdx >= 0 && newIdx < subTasks.length) {
      handleSelectSubTask(subTasks[newIdx]);
    }
  }, [subTasks, effectiveSubTask, handleSelectSubTask]);


  const currentIdx = effectiveSubTask ? subTasks.findIndex(st => st.id === effectiveSubTask.id) : -1;

  const handleCompleteClick = useCallback(async () => {
    if (!task) return;
    const fileIds = subTasks.map(st => st.file?.id).filter(Boolean) as string[];
    if (fileIds.length === 0) {
      setStatusCounts({ total: 0, approved: 0, rework: 0, pending: 0 });
      setCompleteConfirmOpen(true);
      return;
    }
    setCheckingStatuses(true);
    const { data, error } = await supabase
      .from("annotations")
      .select("qc_status")
      .in("file_id", fileIds)
      .eq("project_id", task.project_id);
    setCheckingStatuses(false);
    if (error) {
      toast.error(`Failed to check annotation statuses: ${error.message}`);
      return;
    }
    const rows = data ?? [];
    let approved = 0, rework = 0, pending = 0;
    for (const r of rows) {
      const s = (r as any).qc_status;
      if (s === "approved") approved++;
      else if (s === "rework") rework++;
      else pending++; // null or "pending"
    }
    setStatusCounts({ total: rows.length, approved, rework, pending });
    if (rework > 0) {
      setCompleteBlockedOpen(true);
    } else if (pending > 0) {
      setCompletePendingOpen(true);
    } else {
      setCompleteConfirmOpen(true);
    }
  }, [task, subTasks]);

  const performComplete = useCallback(() => {
    if (!task) return;
    updateTask.mutate({ id: task.id, status: "completed", qa_status: isQCMode ? "completed" : undefined });
    toast.success("Task marked as completed");
    setCompleteConfirmOpen(false);
    setCompletePendingOpen(false);
  }, [task, updateTask, isQCMode]);

  if (tasksLoading || subTasksLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!task || !canAccessTask) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Task not found or not assigned to you</p>
        <Button variant="outline" onClick={() => navigate("/tasks")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      <header className="sticky top-0 z-20 glass border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                {isQCMode && <Shield className="h-4 w-4 text-primary" />}
                {task.name}
                {isQCMode && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">QC Mode</Badge>}
              </h1>
              <p className="text-xs text-muted-foreground">
                {task.description || "No description"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigateSubTask("prev")} disabled={currentIdx <= 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-1">
              {currentIdx + 1} / {subTasks.length}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateSubTask("next")} disabled={currentIdx >= subTasks.length - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 min-w-[200px]">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-xs font-medium text-muted-foreground">
                {completedCount}/{subTasks.length}
              </span>
            </div>
            <Badge variant={STATUS_CONFIG[task.status]?.variant ?? "outline"}>
              {STATUS_CONFIG[task.status]?.label ?? task.status}
            </Badge>
            {isQCMode && task.status !== "completed" && (
              <Button size="sm" variant="default" onClick={handleCompleteClick} disabled={checkingStatuses}>
                {checkingStatuses ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Complete Task
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {sidebarOpen && (
          <aside className="w-72 border-r border-border bg-card/50 overflow-y-auto p-3 shrink-0">
            <div className="mb-3 flex items-center justify-between px-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sub-Tasks ({subTasks.length})
              </h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSidebarOpen(false)}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            {subTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3">No sub-tasks assigned</p>
            ) : (
              <SubTaskList
                subTasks={subTasks}
                activeId={effectiveSubTask?.id ?? null}
                onSelect={handleSelectSubTask}
                onMarkComplete={!isQCMode ? (st) => {
                  const newStatus = st.status === "completed" ? "in_progress" : "completed";
                  updateStatus.mutate({ id: st.id, status: newStatus });
                } : undefined}
                reworkFileIds={reworkFileIds}
              />
            )}
          </aside>
        )}
        {!sidebarOpen && (
          <div className="border-r border-border bg-card/50 p-2 flex flex-col items-center shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(true)}>
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {effectiveSubTask ? (
          isQCMode ? (
            <QCWorkspace
              key={effectiveSubTask.id}
              subTask={effectiveSubTask}
              projectId={task?.project_id}
              onComplete={handleMarkComplete}
            />
          ) : (
            <TaskAnnotationWorkspace
              key={effectiveSubTask.id}
              subTask={effectiveSubTask}
              projectId={task?.project_id}
              onComplete={handleMarkComplete}
            />
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Clock className="h-12 w-12 opacity-40" />
            <p className="text-lg font-medium">No sub-tasks to work on</p>
            <p className="text-sm">All items have been completed or none are assigned.</p>
          </div>
        )}
      </div>

      <AlertDialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <AlertDialogContent container={portalContainer}>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              All {statusCounts.total} annotation{statusCounts.total === 1 ? " is" : "s are"} approved. This will mark the entire task as completed and finalize the QC review. This action cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performComplete}>Complete Task</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hard block — annotations marked for rework */}
      <AlertDialog open={completeBlockedOpen} onOpenChange={setCompleteBlockedOpen}>
        <AlertDialogContent container={portalContainer}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cannot complete task
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusCounts.rework} annotation{statusCounts.rework === 1 ? " is" : "s are"} marked for rework and must be sent back to the annotator before this task can be completed.
              <br /><br />
              <span className="text-xs text-muted-foreground">
                Status breakdown — Approved: {statusCounts.approved} · Rework: {statusCounts.rework} · Pending: {statusCounts.pending} · Total: {statusCounts.total}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCompleteBlockedOpen(false)}>Go back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning — pending (unreviewed) annotations */}
      <AlertDialog open={completePendingOpen} onOpenChange={setCompletePendingOpen}>
        <AlertDialogContent container={portalContainer}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Unreviewed annotations
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusCounts.pending} annotation{statusCounts.pending === 1 ? " has" : "s have"} not been reviewed yet. Completing now will finalize the task without reviewing them.
              <br /><br />
              <span className="text-xs text-muted-foreground">
                Status breakdown — Approved: {statusCounts.approved} · Pending: {statusCounts.pending} · Rework: {statusCounts.rework} · Total: {statusCounts.total}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performComplete}>Complete anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
