import { useState, useMemo } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Music, Image, File, Users } from "lucide-react";
import { useTeam, TeamMember } from "@/hooks/useTeam";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { FileRecord } from "@/hooks/useFiles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
}

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  userId: string;
  onCreated: () => void;
}

function getFileIcon(type: string) {
  if (type.startsWith("audio")) return Music;
  if (type.startsWith("image")) return Image;
  if (type.includes("text") || type.includes("pdf")) return FileText;
  return File;
}

export function TaskCreateDialog({ open, onOpenChange, projects, userId, onCreated }: TaskCreateDialogProps) {
  const { organization } = useOrganization(userId);
  const { members } = useTeam();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [fileSearch, setFileSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { files, isLoading: filesLoading } = useProjectFiles(projectId || undefined);

  const annotators = useMemo(
    () => members.filter((m) => m.roles.includes("annotator") || m.roles.includes("qc") || m.roles.includes("admin") || m.roles.includes("manager")),
    [members]
  );

  const filteredFiles = useMemo(
    () =>
      files.filter((f) =>
        f.name.toLowerCase().includes(fileSearch.toLowerCase())
      ),
    [files, fileSearch]
  );

  const toggleFile = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFileIds.size === filteredFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const resetForm = () => {
    setName("");
    setDesc("");
    setProjectId("");
    setAssignedTo("");
    setSelectedFileIds(new Set());
    setFileSearch("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !projectId) {
      toast.error("Name and project are required");
      return;
    }
    if (selectedFileIds.size === 0) {
      toast.error("Select at least one file to assign");
      return;
    }

    setCreating(true);
    try {
      // Create the task
      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          name,
          description: desc || null,
          project_id: projectId,
          assigned_to: assignedTo && assignedTo !== "__any__" ? assignedTo : null,
          created_by: userId,
          total_items: selectedFileIds.size,
        })
        .select()
        .single();
      if (taskErr) throw taskErr;

      // Create sub_tasks for each selected file
      const subTaskRows = Array.from(selectedFileIds).map((fileId) => ({
        task_id: task.id,
        file_id: fileId,
      }));
      const { error: subErr } = await supabase
        .from("sub_tasks")
        .insert(subTaskRows);
      if (subErr) throw subErr;

      toast.success(`Task created with ${selectedFileIds.size} items`);
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Reset file selection when project changes
  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setSelectedFileIds(new Set());
    setFileSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create & Allocate Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Name */}
          <div>
            <label className="text-sm font-medium">Task Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Review audio batch #12"
            />
          </div>

          {/* Project */}
          <div>
            <label className="text-sm font-medium">Project</label>
            <Select value={projectId} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assign to annotator */}
          <div>
            <label className="text-sm font-medium">Assign to Annotator</label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select annotator (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Any Annotator (Pool)
                  </span>
                </SelectItem>
                {annotators.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No annotators found
                  </div>
                ) : (
                  annotators.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} ({a.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {assignedTo === "__any__" && (
              <p className="text-xs text-muted-foreground mt-1">
                Task will be visible to all annotators. First to claim it gets assigned.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Task instructions for the annotator..."
              rows={2}
            />
          </div>

          {/* File selection */}
          {projectId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Select Data Items ({selectedFileIds.size} selected)
                </label>
                {filteredFiles.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    className="text-xs h-7"
                  >
                    {selectedFileIds.size === filteredFiles.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                )}
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter files..."
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>

              <ScrollArea className="h-48 rounded-lg border border-border">
                {filesLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading files...
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {files.length === 0
                      ? "No files in this project"
                      : "No files match your search"}
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredFiles.map((f) => {
                      const Icon = getFileIcon(f.type);
                      const selected = selectedFileIds.has(f.id);
                      return (
                        <label
                          key={f.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                            selected
                              ? "bg-primary/10"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleFile(f.id)}
                          />
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate flex-1">
                            {f.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {f.type.split("/").pop()}
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <Button
          onClick={handleCreate}
          className="w-full mt-4"
          disabled={creating || !name.trim() || !projectId || selectedFileIds.size === 0}
        >
          {creating ? "Creating..." : `Create Task (${selectedFileIds.size} items)`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
