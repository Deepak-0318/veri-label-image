import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ClipboardList, Clock, CheckCircle2, AlertCircle, Play, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/hooks/useTasks";

interface AssignedTasksListProps {
  tasks: Task[];
  isLoading: boolean;
  projects: { id: string; name: string }[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  in_progress: { label: "In Progress", variant: "default", icon: AlertCircle },
  completed: { label: "Completed", variant: "secondary", icon: CheckCircle2 },
  review: { label: "Review", variant: "outline", icon: ClipboardList },
};

export function AssignedTasksList({ tasks, isLoading, projects }: AssignedTasksListProps) {
  const navigate = useNavigate();
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const activeTasks = tasks.filter((t) => t.status !== "completed").slice(0, 5);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Your Tasks</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Your Tasks</CardTitle>
          <CardDescription>
            {activeTasks.length === 0
              ? "No active tasks assigned"
              : `${activeTasks.length} active task${activeTasks.length > 1 ? "s" : ""}`}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")} className="text-xs text-muted-foreground hover:text-foreground">
          View all <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeTasks.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No tasks assigned to you yet</p>
          </div>
        )}
        {activeTasks.map((task) => {
          const config = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
          const StatusIcon = config.icon;
          const progress = task.total_items > 0 ? Math.round((task.completed_items / task.total_items) * 100) : 0;

          return (
            <button
              key={task.id}
              onClick={() => navigate(`/tasks/${task.id}/perform`)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-secondary/50 group"
            >
              <div className={cn("rounded-md p-2 bg-primary/10 text-primary")}>
                <StatusIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{task.name}</p>
                  <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {task.completed_items}/{task.total_items}
                  </span>
                </div>
                {projectMap.get(task.project_id) && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {projectMap.get(task.project_id)}
                  </p>
                )}
              </div>
              <Play className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
