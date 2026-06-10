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
import { Search, FileText, Music, Image, File, Users, Shuffle, SplitSquareHorizontal, ArrowRight } from "lucide-react";
import { useTeam } from "@/hooks/useTeam";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
}

interface BulkTaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  userId: string;
  onCreated: () => void;
}

type DistributionStrategy = "equal" | "round_robin";

function getFileIcon(type: string) {
  if (type.startsWith("audio")) return Music;
  if (type.startsWith("image")) return Image;
  if (type.includes("text") || type.includes("pdf")) return FileText;
  return File;
}

function distributeFiles(
  fileIds: string[],
  annotatorIds: string[],
  strategy: DistributionStrategy
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  annotatorIds.forEach((id) => result.set(id, []));

  if (annotatorIds.length === 0 || fileIds.length === 0) return result;

  if (strategy === "equal") {
    const perAnnotator = Math.floor(fileIds.length / annotatorIds.length);
    const remainder = fileIds.length % annotatorIds.length;
    let idx = 0;
    annotatorIds.forEach((aId, i) => {
      const count = perAnnotator + (i < remainder ? 1 : 0);
      result.set(aId, fileIds.slice(idx, idx + count));
      idx += count;
    });
  } else {
    // round_robin
    fileIds.forEach((fId, i) => {
      const aId = annotatorIds[i % annotatorIds.length];
      result.get(aId)!.push(fId);
    });
  }

  return result;
}

export function BulkTaskCreateDialog({ open, onOpenChange, projects, userId, onCreated }: BulkTaskCreateDialogProps) {
  const { organization } = useOrganization(userId);
  const { members } = useTeam();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [taskNamePrefix, setTaskNamePrefix] = useState("");
  const [desc, setDesc] = useState("");
  const [projectId, setProjectId] = useState("");
  const [selectedAnnotatorIds, setSelectedAnnotatorIds] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [fileSearch, setFileSearch] = useState("");
  const [strategy, setStrategy] = useState<DistributionStrategy>("equal");
  const [creating, setCreating] = useState(false);
  const [poolTaskCount, setPoolTaskCount] = useState(1);

  const { files, isLoading: filesLoading } = useProjectFiles(projectId || undefined);

  const POOL_ID = "__any__";

  const annotators = useMemo(
    () => members.filter((m) => m.roles.includes("annotator") || m.roles.includes("qc") || m.roles.includes("admin") || m.roles.includes("manager")),
    [members]
  );

  const filteredFiles = useMemo(
    () => files.filter((f) => f.name.toLowerCase().includes(fileSearch.toLowerCase())),
    [files, fileSearch]
  );

  const isPoolMode = selectedAnnotatorIds.has(POOL_ID);

  const allocation = useMemo(() => {
    if (isPoolMode) {
      // Pool mode: distribute files across N pool tasks
      const allFiles = Array.from(selectedFileIds);
      const count = Math.max(1, Math.min(poolTaskCount, allFiles.length));
      const map = new Map<string, string[]>();
      for (let i = 0; i < count; i++) {
        map.set(`${POOL_ID}_${i}`, []);
      }
      allFiles.forEach((fId, idx) => {
        const key = `${POOL_ID}_${idx % count}`;
        map.get(key)!.push(fId);
      });
      return map;
    }
    return distributeFiles(Array.from(selectedFileIds), Array.from(selectedAnnotatorIds), strategy);
  }, [selectedFileIds, selectedAnnotatorIds, strategy, isPoolMode, poolTaskCount]);

  const annotatorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set(POOL_ID, "Any Annotator (Pool)");
    annotators.forEach((a) => map.set(a.id, a.full_name));
    return map;
  }, [annotators]);

  const toggleAnnotator = (id: string) => {
    setSelectedAnnotatorIds((prev) => {
      const next = new Set(prev);
      if (id === POOL_ID) {
        // Pool is exclusive — deselect all others
        if (next.has(POOL_ID)) { next.delete(POOL_ID); } else { next.clear(); next.add(POOL_ID); }
      } else {
        // Deselect pool if selecting a specific annotator
        next.delete(POOL_ID);
        if (next.has(id)) next.delete(id); else next.add(id);
      }
      return next;
    });
  };

  const toggleFile = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiles = () => {
    if (selectedFileIds.size === filteredFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const selectAllAnnotators = () => {
    if (selectedAnnotatorIds.size === annotators.length) {
      setSelectedAnnotatorIds(new Set());
    } else {
      setSelectedAnnotatorIds(new Set(annotators.map((a) => a.id)));
    }
  };

  const resetForm = () => {
    setStep(1);
    setTaskNamePrefix("");
    setDesc("");
    setProjectId("");
    setSelectedAnnotatorIds(new Set());
    setSelectedFileIds(new Set());
    setFileSearch("");
    setStrategy("equal");
    setPoolTaskCount(1);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      for (const [annotatorId, fileIds] of allocation.entries()) {
        if (fileIds.length === 0) continue;
        const isPool = annotatorId.startsWith(POOL_ID);
        const taskIndex = isPool ? parseInt(annotatorId.split("_").pop() || "0") + 1 : null;
        const name = isPool
          ? (poolTaskCount > 1 ? `${taskNamePrefix} — Pool #${taskIndex}` : taskNamePrefix)
          : selectedAnnotatorIds.size === 1
            ? taskNamePrefix
            : `${taskNamePrefix} — ${annotatorNameMap.get(annotatorId) || "Annotator"}`;

        const { data: task, error: taskErr } = await supabase
          .from("tasks")
          .insert({
            name,
            description: desc || null,
            project_id: projectId,
            assigned_to: isPool ? null : annotatorId,
            created_by: userId,
            total_items: fileIds.length,
          })
          .select()
          .single();
        if (taskErr) throw taskErr;

        const subTaskRows = fileIds.map((fileId) => ({
          task_id: task.id,
          file_id: fileId,
        }));
        const { error: subErr } = await supabase.from("sub_tasks").insert(subTaskRows);
        if (subErr) throw subErr;
      }

      const taskCount = Array.from(allocation.values()).filter((f) => f.length > 0).length;
      toast.success(`Created ${taskCount} task(s) across ${selectedAnnotatorIds.size} annotator(s)`);
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleProjectChange = (id: string) => {
    setProjectId(id);
    setSelectedFileIds(new Set());
    setFileSearch("");
  };

  const canProceedStep1 = taskNamePrefix.trim() && projectId;
  const canProceedStep2 = selectedAnnotatorIds.size > 0 && selectedFileIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Task Allocation
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium border ${step >= s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                {s}
              </div>
              <span className={step >= s ? "text-foreground font-medium" : ""}>
                {s === 1 ? "Setup" : s === 2 ? "Select" : "Review"}
              </span>
              {s < 3 && <ArrowRight className="h-3 w-3 mx-1" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Step 1: Basic info */}
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium">Task Name Prefix</label>
                <Input
                  value={taskNamePrefix}
                  onChange={(e) => setTaskNamePrefix(e.target.value)}
                  placeholder="e.g. Audio Review Batch #3"
                />
                <p className="text-xs text-muted-foreground mt-1">Each annotator's task will append their name</p>
              </div>
              <div>
                <label className="text-sm font-medium">Project</label>
                <Select value={projectId} onValueChange={handleProjectChange}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Instructions for annotators..."
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Step 2: Select annotators + files */}
          {step === 2 && (
            <>
              {/* Annotators */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    Select Annotators ({selectedAnnotatorIds.size} selected)
                  </label>
                  {annotators.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={selectAllAnnotators} className="text-xs h-7">
                      {selectedAnnotatorIds.size === annotators.length ? "Deselect All" : "Select All"}
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-32 rounded-lg border border-border">
              {annotators.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No team members found</div>
                  ) : (
                    <div className="p-1">
                      {/* Pool option */}
                      <label
                        className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${isPoolMode ? "bg-primary/10" : "hover:bg-muted/50"}`}
                      >
                        <Checkbox checked={isPoolMode} onCheckedChange={() => toggleAnnotator(POOL_ID)} />
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1 font-medium">Any Annotator (Pool)</span>
                        <Badge variant="outline" className="text-[10px]">pool</Badge>
                      </label>
                      <div className="border-b border-border my-1" />
                      {annotators.map((a) => {
                        const selected = selectedAnnotatorIds.has(a.id);
                        return (
                          <label
                            key={a.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${selected ? "bg-primary/10" : "hover:bg-muted/50"}`}
                          >
                            <Checkbox checked={selected} onCheckedChange={() => toggleAnnotator(a.id)} />
                            <span className="text-sm flex-1">{a.full_name}</span>
                            <span className="text-xs text-muted-foreground">{a.email}</span>
                            <div className="flex gap-1">
                              {a.roles.map((r) => (
                                <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                              ))}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Files */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    Select Data Items ({selectedFileIds.size} selected)
                  </label>
                  {filteredFiles.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={selectAllFiles} className="text-xs h-7">
                      {selectedFileIds.size === filteredFiles.length ? "Deselect All" : "Select All"}
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
                <ScrollArea className="h-40 rounded-lg border border-border">
                  {filesLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Loading files...</div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {files.length === 0 ? "No files in this project" : "No files match your search"}
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredFiles.map((f) => {
                        const Icon = getFileIcon(f.type);
                        const selected = selectedFileIds.has(f.id);
                        return (
                          <label
                            key={f.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${selected ? "bg-primary/10" : "hover:bg-muted/50"}`}
                          >
                            <Checkbox checked={selected} onCheckedChange={() => toggleFile(f.id)} />
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate flex-1">{f.name}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{f.type.split("/").pop()}</Badge>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Distribution strategy or pool task count */}
              {isPoolMode ? (
                <div>
                  <label className="text-sm font-medium">Number of Pool Tasks</label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedFileIds.size || 1}
                    value={poolTaskCount}
                    onChange={(e) => setPoolTaskCount(Math.max(1, Math.min(parseInt(e.target.value) || 1, selectedFileIds.size || 1)))}
                    className="w-32 mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedFileIds.size} file(s) will be split equally across {Math.min(poolTaskCount, selectedFileIds.size || 1)} pool task(s) — ~{selectedFileIds.size > 0 ? Math.ceil(selectedFileIds.size / Math.min(poolTaskCount, selectedFileIds.size)) : 0} files each
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">Distribution Strategy</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant={strategy === "equal" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStrategy("equal")}
                      className="gap-1.5"
                    >
                      <SplitSquareHorizontal className="h-3.5 w-3.5" />
                      Equal Split
                    </Button>
                    <Button
                      variant={strategy === "round_robin" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStrategy("round_robin")}
                      className="gap-1.5"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      Round Robin
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {strategy === "equal"
                      ? "Splits files into equal-sized chunks per annotator"
                      : "Distributes files one-by-one across annotators in rotation"}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <>
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Summary</span>
                  <Badge variant="secondary">
                    {selectedFileIds.size} items → {isPoolMode ? `${Math.min(poolTaskCount, selectedFileIds.size)} pool task(s)` : `${selectedAnnotatorIds.size} annotator(s)`}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {isPoolMode ? `Pool mode — ${Math.min(poolTaskCount, selectedFileIds.size)} unassigned task(s)` : `Strategy: ${strategy === "equal" ? "Equal Split" : "Round Robin"}`}
                </div>
              </div>

              <ScrollArea className="h-56 rounded-lg border border-border">
                <div className="p-2 space-y-2">
                  {Array.from(allocation.entries()).map(([annotatorId, fileIds]) => (
                    <div key={annotatorId} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {annotatorId.startsWith(POOL_ID)
                            ? `Pool Task #${parseInt(annotatorId.split("_").pop() || "0") + 1}`
                            : annotatorNameMap.get(annotatorId) || "Unknown"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {fileIds.length} item{fileIds.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Task: {annotatorId.startsWith(POOL_ID)
                          ? (poolTaskCount > 1 ? `${taskNamePrefix} — Pool #${parseInt(annotatorId.split("_").pop() || "0") + 1}` : taskNamePrefix)
                          : `${taskNamePrefix} — ${annotatorNameMap.get(annotatorId)}`}
                      </div>
                      {fileIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {fileIds.slice(0, 5).map((fId) => {
                            const file = files.find((f) => f.id === fId);
                            return (
                              <Badge key={fId} variant="secondary" className="text-[10px]">
                                {file?.name || fId.slice(0, 8)}
                              </Badge>
                            );
                          })}
                          {fileIds.length > 5 && (
                            <Badge variant="secondary" className="text-[10px]">
                              +{fileIds.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <Button
            variant="outline"
            onClick={() => { if (step === 1) { resetForm(); onOpenChange(false); } else setStep((s) => (s - 1) as 1 | 2 | 3); }}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : `Create ${Array.from(allocation.values()).filter((f) => f.length > 0).length} Task(s)`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
