import { useState, useMemo } from "react";
import { useAuditLogs, type AuditLogEntry } from "@/hooks/useAuditLogs";
import type { AuditCategory } from "@/services/auditLogger";
import type { TeamMember } from "@/hooks/useTeam";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Search, Filter, ChevronDown, ChevronRight, Loader2,
  LogIn, LogOut, Upload, Tag, ClipboardCheck, Users,
  FolderPlus, Pencil, Trash2, Play, Bot, Eye, ShieldCheck, RotateCcw,
  FileText, AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  auth: { label: "Auth", icon: LogIn, color: "text-blue-500 bg-blue-500/10" },
  crud: { label: "Data", icon: FileText, color: "text-emerald-500 bg-emerald-500/10" },
  annotation: { label: "Annotation", icon: Tag, color: "text-purple-500 bg-purple-500/10" },
  task: { label: "Task", icon: ClipboardCheck, color: "text-amber-500 bg-amber-500/10" },
  qc: { label: "QC", icon: ShieldCheck, color: "text-orange-500 bg-orange-500/10" },
  team: { label: "Team", icon: Users, color: "text-pink-500 bg-pink-500/10" },
  pipeline: { label: "Pipeline", icon: Play, color: "text-cyan-500 bg-cyan-500/10" },
  ai: { label: "AI", icon: Bot, color: "text-violet-500 bg-violet-500/10" },
  general: { label: "General", icon: Eye, color: "text-muted-foreground bg-muted" },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  create: FolderPlus,
  update: Pencil,
  delete: Trash2,
  login: LogIn,
  logout: LogOut,
  signup: LogIn,
  upload: Upload,
  assign: Users,
  invite: Users,
  accept: ShieldCheck,
  reject: AlertCircle,
  rework: RotateCcw,
  run: Play,
  complete: ClipboardCheck,
};

function getActionIcon(action: string): React.ElementType {
  const key = Object.keys(ACTION_ICONS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_ICONS[key] : Eye;
}

function DiffView({ oldValues, newValues }: { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null }) {
  if (!oldValues && !newValues) return null;
  const allKeys = [...new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])];
  if (allKeys.length === 0) return null;

  return (
    <div className="mt-2 text-xs space-y-1 bg-muted/50 rounded-md p-2 border border-border">
      {allKeys.map(key => {
        const oldVal = oldValues?.[key];
        const newVal = newValues?.[key];
        const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
        if (!changed && oldVal !== undefined) return null;
        return (
          <div key={key} className="flex gap-2">
            <span className="font-medium text-muted-foreground min-w-[80px]">{key}:</span>
            {oldVal !== undefined && (
              <span className="text-destructive line-through">{String(oldVal)}</span>
            )}
            {newVal !== undefined && (
              <span className="text-green-500">{String(newVal)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.general;
  const ActionIcon = getActionIcon(entry.action);
  const hasDiff = entry.old_values || entry.new_values;

  return (
    <div className="flex gap-3 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", catConfig.color)}>
          <ActionIcon className="h-4 w-4" />
        </div>
        <div className="w-px flex-1 bg-border group-last:bg-transparent" />
      </div>

      {/* Content */}
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-medium">{entry.user_name}</span>
              <span className="text-muted-foreground ml-1">{entry.description}</span>
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", catConfig.color)}>
                {catConfig.label}
              </Badge>
              {entry.entity_name && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {entry.entity_type}: {entry.entity_name}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0" title={format(new Date(entry.created_at), "PPpp")}>
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
        </div>

        {hasDiff && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs mt-1 px-2 text-muted-foreground">
                {expanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                Changes
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <DiffView oldValues={entry.old_values} newValues={entry.new_values} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

function groupByDate(entries: AuditLogEntry[]): { label: string; entries: AuditLogEntry[] }[] {
  const groups = new Map<string, AuditLogEntry[]>();
  for (const entry of entries) {
    const date = startOfDay(new Date(entry.created_at));
    const key = date.toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.entries()).map(([key, entries]) => {
    const date = new Date(key);
    let label = format(date, "EEEE, MMMM d, yyyy");
    if (isToday(date)) label = "Today";
    else if (isYesterday(date)) label = "Yesterday";
    return { label, entries };
  });
}

interface AuditTimelineProps {
  organizationId: string | undefined;
  members: TeamMember[];
}

export function AuditTimeline({ organizationId, members }: AuditTimelineProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useAuditLogs(organizationId, {
    category: categoryFilter !== "all" ? categoryFilter as AuditCategory : undefined,
    userId: userFilter !== "all" ? userFilter : undefined,
    search: search.trim() || undefined,
  });

  const grouped = useMemo(() => groupByDate(logs), [logs]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-transparent"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[180px]">
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">No audit logs yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Actions performed by team members will appear here.</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-360px)]">
          <div className="pr-4">
            {grouped.map((group) => (
              <div key={group.label} className="mb-6">
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
                </div>
                {group.entries.map((entry) => (
                  <TimelineEntry key={entry.id} entry={entry} />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
