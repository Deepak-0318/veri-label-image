import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, CheckCircle2, Users } from "lucide-react";
import type { TeamMember } from "@/hooks/useTeam";
import type { Task } from "@/hooks/useTasks";

interface BulkQAAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  members: TeamMember[];
  onAssign: (taskIds: string[], qaUserId: string) => void;
}

export function BulkQAAssignDialog({
  open,
  onOpenChange,
  tasks,
  members,
  onAssign,
}: BulkQAAssignDialogProps) {
  const [qaUserId, setQaUserId] = useState("");

  const qcMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          m.roles.includes("qc") ||
          m.roles.includes("admin") ||
          m.roles.includes("manager")
      ),
    [members]
  );

  const handleAssign = () => {
    if (qaUserId && tasks.length > 0) {
      onAssign(tasks.map(t => t.id), qaUserId);
      setQaUserId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Assign QC Reviewer
          </DialogTitle>
          <DialogDescription>
            Assign a QC reviewer to {tasks.length} selected task{tasks.length !== 1 ? "s" : ""} currently under review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Selected tasks summary */}
          <div>
            <label className="text-sm font-medium mb-2 block">Selected Tasks</label>
            <ScrollArea className="max-h-40 rounded-lg border border-border">
              <div className="p-2 space-y-1">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/50 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate flex-1">{task.name}</span>
                    <Badge variant="outline" className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">
                      Review
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* QC reviewer selector */}
          <div>
            <label className="text-sm font-medium mb-1 block">QC Reviewer</label>
            <Select value={qaUserId} onValueChange={setQaUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a QC reviewer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Any QC Reviewer (Pool)
                  </span>
                </SelectItem>
                {qcMembers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No QC members available
                  </div>
                ) : (
                  qcMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name} ({m.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAssign} disabled={!qaUserId} className="w-full">
            <Shield className="h-4 w-4 mr-1" />
            Assign QC to {tasks.length} Task{tasks.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
