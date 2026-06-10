import { cn } from "@/lib/utils";
import { Upload, Tag, Users, Download, Clock, FolderKanban, GitBranch, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActivityFeed, ActivityEvent } from "@/hooks/useActivityFeed";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, React.ElementType> = {
  upload: Upload,
  annotate: Tag,
  export: Download,
  task: ClipboardList,
  project: FolderKanban,
  pipeline: GitBranch,
  team: Users,
};

const colorMap: Record<string, string> = {
  upload: "text-blue-500 bg-blue-500/10",
  annotate: "text-green-500 bg-green-500/10",
  export: "text-orange-500 bg-orange-500/10",
  task: "text-violet-500 bg-violet-500/10",
  project: "text-cyan-500 bg-cyan-500/10",
  pipeline: "text-pink-500 bg-pink-500/10",
  team: "text-purple-500 bg-purple-500/10",
};

interface RecentActivityProps {
  className?: string;
  projectId?: string;
  limit?: number;
}

export function RecentActivity({ className, projectId, limit = 20 }: RecentActivityProps) {
  const { user } = useAuth();
  const { activities, isLoading } = useActivityFeed(user?.id, projectId, limit);

  if (!user) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Recent Activity
        </h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          Sign in to see your activity feed
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        Recent Activity
      </h3>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activity yet. Upload files or create annotations to see your feed.
        </p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {activities.map((event) => {
            const Icon = iconMap[event.event_type] ?? Clock;
            const color = colorMap[event.event_type] ?? "text-muted-foreground bg-muted";

            return (
              <div key={event.id} className="flex items-start gap-3 py-2">
                <div className={cn("p-2 rounded-lg shrink-0", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{event.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
