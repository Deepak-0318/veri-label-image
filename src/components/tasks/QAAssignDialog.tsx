import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, SkipForward, Users } from "lucide-react";
import type { TeamMember } from "@/hooks/useTeam";

interface QAAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  onAssignQA: (qaUserId: string) => void;
  onSkip: () => void;
  taskName: string;
}

export function QAAssignDialog({
  open,
  onOpenChange,
  members,
  onAssignQA,
  onSkip,
  taskName,
}: QAAssignDialogProps) {
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
    if (qaUserId) {
      onAssignQA(qaUserId === "__any__" ? "__any__" : qaUserId);
      setQaUserId("");
    }
  };

  const handleSkip = () => {
    setQaUserId("");
    onSkip();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quality Assurance Check
          </DialogTitle>
          <DialogDescription>
            Would you like to assign a QA reviewer for "{taskName}" before completing it?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Assign QA Reviewer</label>
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

          <div className="flex gap-2">
            <Button onClick={handleAssign} disabled={!qaUserId} className="flex-1">
              <Shield className="h-4 w-4 mr-1" />
              Assign QA
            </Button>
            <Button variant="outline" onClick={handleSkip} className="flex-1">
              <SkipForward className="h-4 w-4 mr-1" />
              Skip QA
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
