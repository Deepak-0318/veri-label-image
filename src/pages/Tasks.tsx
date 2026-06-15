import { useState, useMemo, useCallback } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useTasks, Task } from "@/hooks/useTasks";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjects } from "@/hooks/useProjects";
import { useTeam } from "@/hooks/useTeam";
import { TaskCreateDialog } from "@/components/tasks/TaskCreateDialog";
import { BulkTaskCreateDialog } from "@/components/tasks/BulkTaskCreateDialog";
import { QAAssignDialog } from "@/components/tasks/QAAssignDialog";
import { BulkQAAssignDialog } from "@/components/tasks/BulkQAAssignDialog";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  ClipboardList,
  Trash2,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Shield,
  Users,
  PenTool,
  HandMetal,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: CheckCircle2 },
  review: { label: "Under Review", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: ClipboardList },
};

const QA_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "QA Pending", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  in_progress: { label: "QA In Progress", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  rework: { label: "Rework", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  completed: { label: "QA Passed", color: "bg-green-500/20 text-green-300 border-green-500/30" },
};

function TaskCard({ task, projects, memberMap, navigate, updateTask, onDeleteRequest, onRequestComplete, isAdmin, isManager, isQCView, isCompletedView, selectable, selected, onToggleSelect, currentUserId, onClaim }: {
  task: Task;
  projects: any[];
  memberMap: Map<string, string>;
  navigate: (path: string) => void;
  updateTask: any;
  onDeleteRequest: (task: Task) => void;
  onRequestComplete: (task: Task) => void;
  isAdmin: boolean;
  isManager: boolean;
  isQCView: boolean;
  isCompletedView?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  currentUserId?: string;
  onClaim?: (task: Task, type: "annotator" | "qc") => void;
}) {
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const progress = task.total_items > 0 ? (task.completed_items / task.total_items) * 100 : 0;
  const project = projects.find((p: any) => p.id === task.project_id);
  const assigneeName = task.assigned_to ? memberMap.get(task.assigned_to) : null;
  const qaName = task.qa_assigned_to ? memberMap.get(task.qa_assigned_to) : null;
  const qaCfg = task.qa_status ? QA_STATUS_CONFIG[task.qa_status] : null;
  const isPoolTask = !task.assigned_to;
  const isPoolQC = isQCView && !task.qa_assigned_to;
  const canClaim = isPoolTask || isPoolQC;

  const handleStatusChange = (v: string) => {
    if (v === "completed" || v === "review") {
      if (isAdmin) {
        updateTask.mutate({ id: task.id, status: v });
        return;
      }
      if (!task.qa_assigned_to && !task.qa_status) {
        onRequestComplete(task);
        return;
      }
      if (task.qa_assigned_to && task.qa_status !== "completed" && v === "completed") return;
    }
    updateTask.mutate({ id: task.id, status: v });
  };

  const performPath = isQCView
    ? `/tasks/${task.id}/perform?mode=qc`
    : `/tasks/${task.id}/perform`;

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {selectable && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.(task.id)}
              className="mt-1 shrink-0"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="font-semibold">{task.name}</h3>
              <Badge variant="outline" className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              {qaCfg && (
                <Badge variant="outline" className={qaCfg.color}>
                  <Shield className="h-3 w-3 mr-1" />
                  {qaCfg.label}
                </Badge>
              )}
              {project && <Badge variant="secondary" className="text-xs">{project.name}</Badge>}
            </div>
            {task.description && <p className="text-sm text-muted-foreground mb-3">{task.description}</p>}
            <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(task.created_at).toLocaleDateString()}</span>
              {assigneeName ? (
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{assigneeName}</span>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-accent/50 text-accent-foreground border-accent">
                  <Users className="h-2.5 w-2.5 mr-0.5" /> Pool
                </Badge>
              )}
              {qaName ? (
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" />QA: {qaName}</span>
              ) : isQCView ? (
                <Badge variant="outline" className="text-[10px] bg-accent/50 text-accent-foreground border-accent">
                  <Users className="h-2.5 w-2.5 mr-0.5" /> QC Pool
                </Badge>
              ) : null}
              <span>{task.completed_items}/{task.total_items} items</span>
            </div>
            {task.total_items > 0 && <Progress value={progress} className="mt-3 h-1.5" />}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {canClaim && onClaim && (
            <Button
              size="sm"
              className="gap-1"
              onClick={() => onClaim(task, isPoolQC ? "qc" : "annotator")}
            >
              <HandMetal className="h-3 w-3" />
              Claim
            </Button>
          )}
          {(!canClaim || isAdmin || isManager) && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(performPath)}>
              {isQCView ? <Shield className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isQCView ? "Review" : "Perform"}
            </Button>
          )}
          {!isQCView && !isCompletedView && (isAdmin || isManager) && (
            <>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Under Review</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDeleteRequest(task)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PaginatedTaskList({ tasks, selectedIds, onToggleSelect, ...props }: {
  tasks: any[];
  projects: any[];
  memberMap: Map<string, string>;
  navigate: (path: string) => void;
  updateTask: any;
  onDeleteRequest: (task: Task) => void;
  onRequestComplete: (task: Task) => void;
  isAdmin: boolean;
  isManager: boolean;
  isQCView: boolean;
  isCompletedView?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  currentUserId?: string;
  onClaim?: (task: Task, type: "annotator" | "qc") => void;
}) {
  const { paginatedItems, currentPage, totalPages, totalItems, setCurrentPage } = usePagination(tasks, 10);
  return (
    <>
      <div className="space-y-3">
        {paginatedItems.map((task) => {
          // Selectable: annotation tab review tasks without QA, OR QC tab unclaimed pool tasks
          const selectable = task.status === "review" && !task.qa_assigned_to;
          return (
            <TaskCard
              key={task.id}
              task={task}
              selectable={selectable}
              selected={selectedIds.has(task.id)}
              onToggleSelect={onToggleSelect}
              {...props}
            />
          );
        })}
      </div>
      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} onPageChange={setCurrentPage} />
    </>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tasks, isLoading, updateTask, deleteTask } = useTasks(user?.id);
  console.log("TASKS FROM DB", tasks);
  console.log(
    "ALL TASKS",
    tasks.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      project_id: t.project_id
    }))
  );
  tasks.forEach((task) => console.log("TASK STATUS", task.status));
  const { isAdmin, isManager, isQC } = useUserRole(user?.id);
  const { projects } = useProjects(user?.id);
  const { organization } = useOrganization(user?.id);
  const { members } = useTeam();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [qaDialogTask, setQaDialogTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<string>("annotation");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkQADialog, setShowBulkQADialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.id, m.full_name));
    return map;
  }, [members]);

  const annotationTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === "completed" || t.status === "review") return false;
      if (isAdmin || isManager) return true;
      return t.assigned_to === user?.id || !t.assigned_to;
    });
  }, [tasks, isAdmin, isManager, user?.id]);

  const qcTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Completed QA tasks go to Completed tab
      if (t.status === "completed" && t.qa_status === "completed") return false;
      // Must have qa_assigned_to OR be in review (pool QC)
      if (t.status !== "review" && !t.qa_assigned_to) return false;
      if (isAdmin || isManager) return true;
      return t.qa_assigned_to === user?.id || (!t.qa_assigned_to && t.status === "review");
    });
  }, [tasks, isAdmin, isManager, user?.id]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== "completed") return false;
      if (isAdmin) return true;
      return t.assigned_to === user?.id || t.qa_assigned_to === user?.id;
    });
  }, [tasks, isAdmin, user?.id]);

  console.log("ANNOTATION TASKS", annotationTasks);
  console.log("QC TASKS",
  qcTasks.map(t => ({
    id: t.id,
    name: t.name,
    status: t.status,
    assigned_to: t.assigned_to,
    qa_assigned_to: t.qa_assigned_to,
    project_id: t.project_id
  }))
);

  const currentTasks = activeTab === "qc" ? qcTasks : activeTab === "completed" ? completedTasks : annotationTasks;

  console.log(
    "TASK DETAILS",
    currentTasks.map(t => ({
      id: t.id,
      status: t.status,
      assigned_to: t.assigned_to,
      qa_assigned_to: t.qa_assigned_to,
      name: t.name
    }))
  );

  const filteredTasks = currentTasks.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Tasks eligible for bulk QC assign (in review, no QA assigned yet)
  const reviewTasksWithoutQA = useMemo(() => {
    return annotationTasks.filter(t => t.status === "review" && !t.qa_assigned_to);
  }, [annotationTasks]);

  // Unclaimed QC pool tasks in the QC tab
  const unclaimedQCTasks = useMemo(() => {
    return qcTasks.filter(t => !t.qa_assigned_to && t.status === "review");
  }, [qcTasks]);

  const selectedTasks = useMemo(() => {
    if (activeTab === "qc") {
      return unclaimedQCTasks.filter(t => selectedTaskIds.has(t.id));
    }
    return reviewTasksWithoutQA.filter(t => selectedTaskIds.has(t.id));
  }, [activeTab, reviewTasksWithoutQA, unclaimedQCTasks, selectedTaskIds]);

  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleSelectAllReview = useCallback(() => {
    const pool = activeTab === "qc" ? unclaimedQCTasks : reviewTasksWithoutQA;
    if (selectedTaskIds.size === pool.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(pool.map(t => t.id)));
    }
  }, [activeTab, reviewTasksWithoutQA, unclaimedQCTasks, selectedTaskIds.size]);

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const handleRequestComplete = useCallback((task: Task) => {
    setQaDialogTask(task);
  }, []);

  const handleAssignQA = useCallback((qaUserId: string) => {
    if (!qaDialogTask) return;
    updateTask.mutate({
      id: qaDialogTask.id,
      status: "review",
      qa_assigned_to: qaUserId === "__any__" ? null : qaUserId,
      qa_status: "pending",
    });
    setQaDialogTask(null);
  }, [qaDialogTask, updateTask]);

  const handleClaim = useCallback((task: Task, type: "annotator" | "qc") => {
    if (!user?.id) return;
    if (type === "annotator") {
      updateTask.mutate({ id: task.id, assigned_to: user.id });
      toast.success(`You claimed task "${task.name}"`);
    } else {
      updateTask.mutate({ id: task.id, qa_assigned_to: user.id, qa_status: "pending" });
      toast.success(`You claimed QC review for "${task.name}"`);
    }
  }, [user?.id, updateTask]);

  const handleSkipQA = useCallback(() => {
    if (!qaDialogTask) return;
    updateTask.mutate({ id: qaDialogTask.id, status: "completed" });
    setQaDialogTask(null);
  }, [qaDialogTask, updateTask]);

  const handleBulkQAAssign = useCallback((taskIds: string[], qaUserId: string) => {
    const resolvedQA = qaUserId === "__any__" ? null : qaUserId;
    taskIds.forEach(id => {
      updateTask.mutate({
        id,
        qa_assigned_to: resolvedQA,
        qa_status: "pending",
      });
    });
    setSelectedTaskIds(new Set());
    setShowBulkQADialog(false);
    toast.success(resolvedQA
      ? `QC reviewer assigned to ${taskIds.length} task${taskIds.length !== 1 ? "s" : ""}`
      : `${taskIds.length} task${taskIds.length !== 1 ? "s" : ""} moved to QC pool`
    );
  }, [updateTask]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 glass border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tasks</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage annotation and QC review tasks
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-secondary/50 border-transparent"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="review">Under Review</SelectItem>
                </SelectContent>
              </Select>
              {isManager && (
                <>
                  <Button variant="outline" onClick={() => setShowBulkDialog(true)}>
                    <Users className="h-4 w-4 mr-1" />
                    Bulk Allocate
                  </Button>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Task
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
             <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedTaskIds(new Set()); }}>
              <TabsList>
                <TabsTrigger value="annotation" className="gap-1.5">
                  <PenTool className="h-3.5 w-3.5" />
                  Annotation ({annotationTasks.length})
                </TabsTrigger>
                <TabsTrigger value="qc" className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  QC Review ({qcTasks.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed ({completedTasks.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Bulk QC assign actions — for managers in annotation tab (review tasks) or QC tab (unclaimed pool) */}
            {isManager && (
              (activeTab === "annotation" && reviewTasksWithoutQA.length > 0) ||
              (activeTab === "qc" && unclaimedQCTasks.length > 0)
            ) && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleSelectAllReview}
                >
                  {(() => {
                    const pool = activeTab === "qc" ? unclaimedQCTasks : reviewTasksWithoutQA;
                    return selectedTaskIds.size === pool.length
                      ? "Deselect All"
                      : `Select All Unclaimed (${pool.length})`;
                  })()}
                </Button>
                {selectedTasks.length > 0 && (
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => setShowBulkQADialog(true)}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Assign QC ({selectedTasks.length})
                  </Button>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-20 text-muted-foreground">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ClipboardList className="h-16 w-16 mx-auto opacity-30 mb-4" />
              <p className="text-lg font-medium">
                {activeTab === "qc" ? "No QC tasks found" : "No tasks found"}
              </p>
              <p className="text-sm">
                {activeTab === "qc"
                  ? "QC tasks will appear here when annotation tasks are submitted for review"
                  : "Create a new task to get started"
                }
              </p>
            </div>
          ) : (
            <PaginatedTaskList
              tasks={filteredTasks}
              projects={projects}
              memberMap={memberMap}
              navigate={navigate}
              updateTask={updateTask}
              onDeleteRequest={(task) => setDeleteTarget(task)}
              onRequestComplete={handleRequestComplete}
              isAdmin={isAdmin}
              isManager={isManager}
              isQCView={activeTab === "qc"}
              isCompletedView={activeTab === "completed"}
              selectedIds={selectedTaskIds}
              onToggleSelect={handleToggleSelect}
              currentUserId={user?.id}
              onClaim={handleClaim}
            />
          )}
        </div>
      </main>

      {user && (
        <>
          <TaskCreateDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            projects={projects}
            userId={user.id}
            onCreated={handleCreated}
          />
          <BulkTaskCreateDialog
            open={showBulkDialog}
            onOpenChange={setShowBulkDialog}
            projects={projects}
            userId={user.id}
            onCreated={handleCreated}
          />
        </>
      )}

      <QAAssignDialog
        open={!!qaDialogTask}
        onOpenChange={(open) => { if (!open) setQaDialogTask(null); }}
        members={members}
        onAssignQA={handleAssignQA}
        onSkip={handleSkipQA}
        taskName={qaDialogTask?.name ?? ""}
      />

      <BulkQAAssignDialog
        open={showBulkQADialog}
        onOpenChange={setShowBulkQADialog}
        tasks={selectedTasks}
        members={members}
        onAssign={handleBulkQAAssign}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the task "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteTask.mutate(deleteTarget.id, {
                    onSuccess: () => toast.success("Task deleted successfully"),
                    onError: () => toast.error("Failed to delete task"),
                  });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
