import { useState, useEffect } from "react";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineRuns } from "@/hooks/usePipelineRuns";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { FileRecord } from "@/hooks/useFiles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Workflow, Play, ExternalLink, Loader2, FileIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const getJwt = (): string | null => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const raw = localStorage.getItem(`sb-${projectId}-auth-token`);
  try { return raw ? JSON.parse(raw)?.access_token ?? null : null; } catch { return null; }
};

async function getProjectLabels(projectId: string): Promise<string[]> {
  try {
    if (!projectId) return [];
    const { data, error } = await supabase
      .from("project_labels")
      .select("name")
      .eq("project_id", projectId);
    if (error) {
      console.error("Error fetching project labels:", error);
      return [];
    }
    return data ? data.map((row: any) => row.name) : [];
  } catch (err) {
    console.error("Error in getProjectLabels:", err);
    return [];
  }
}

interface ProjectPipelineRunnerProps {
  projectId: string;
  userId: string;
  files: FileRecord[];
}

interface AnnotationResult {
  label: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface NodeResult {
  node: string;
  annotations?: AnnotationResult[];
  status?: string;
}

interface FileResult {
  fileId: string;
  results: NodeResult[];
}

interface PipelineRunResult {
  success: boolean;
  fileResults: FileResult[];
}

export function ProjectPipelineRunner({ projectId, userId, files }: ProjectPipelineRunnerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pipelines, isLoading } = usePipelines(userId);
  const { createRun, updateRun } = usePipelineRuns(userId);
  const { createTask } = useTasks(userId, projectId);

  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<PipelineRunResult | null>(null);
  const [projectLabels, setProjectLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  useEffect(() => {
    if (projectId) {
      getProjectLabels(projectId).then(setProjectLabels);
    }
  }, [projectId]);

  const availablePipelines = pipelines.filter(
    (p) => !p.project_id || p.project_id === projectId
  );
  const selectedPipeline = availablePipelines.find((p) => p.id === selectedPipelineId);
  const selectedProject = projectId ? { id: projectId } : null;

  if (selectedPipeline) {
    console.log("Pipeline loaded:", selectedPipeline);
    console.log("Nodes:", selectedPipeline.config);
  }

  const toggleFile = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedFileIds(new Set(files.map((f) => f.id)));
  const deselectAll = () => setSelectedFileIds(new Set());

  const handleRun = async () => {
    const selectedFiles = files.filter((file) => selectedFileIds.has(file.id));
    const selectedFileIdArray = selectedFiles.map((file) => file.id);

    console.log("Selected Project:", selectedProject);
    console.log("Selected Files:", selectedFiles.map(({ id, name }) => ({ id, name })));
    console.log("Selected Pipeline:", selectedPipeline);
    console.log("Selected File IDs:", selectedFileIdArray);

    try {
      if (!selectedProject) throw new Error("No project selected");
      if (!selectedPipeline) throw new Error("No pipeline selected");
      if (selectedFiles.length === 0) throw new Error("No files selected");
      if (!selectedPipeline.config || selectedPipeline.config.length === 0) {
        throw new Error("This pipeline has no blocks configured.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid pipeline selection";
      console.error("Pipeline validation error:", err);
      toast.error(message);
      return;
    }

    setIsRunning(true);
    setRunResult(null);

    // Fetch project labels before execution
    let labels: string[] = [];
    try {
      labels = await getProjectLabels(selectedProject.id);
    } catch (err) {
      console.error("Failed to get project labels:", err);
    }

    console.log("Project Labels", labels);

    if (labels.length === 0) {
      toast.warning("No project labels found. Auto-annotation may not work correctly.");
    }

    // ── PHASE 1: Create Task and PipelineRun records before backend execution ──
    let taskId: string | null = null;
    let runId: string | null = null;
    try {
      console.log("CREATING TASK", {
        projectId: selectedProject.id,
        files: selectedFileIdArray,
        assignedTo: user?.id,
      });
      const task = await createTask.mutateAsync({
        name: `Review: ${selectedPipeline.name}`,
        description: `Auto-generated by pipeline execution. Pipeline: ${selectedPipeline.name}`,
        project_id: selectedProject.id,
        assigned_to: user?.id,
        qa_assigned_to: user?.id,
        file_ids: selectedFileIdArray,
      });
      console.log("TASK RESPONSE", task);
      taskId = task.id;
      console.log("Created Task ID:", task.id);

      // Subtasks are now created by the backend

      const run = await createRun.mutateAsync({
        pipeline_id: selectedPipelineId,
        project_id: selectedProject.id,
        total_items: selectedFiles.length,
        file_ids: selectedFileIdArray,
      });
      runId = run.id;
      console.log("Created PipelineRun ID:", runId);
      toast.info("Pipeline run started — visible in Pipeline Runs page");
    } catch (err: any) {
      console.error(
        "TASK CREATION FAILURE",
        err
      );

      console.error(
        "TASK CREATION FAILURE JSON",
        JSON.stringify(err, null, 2)
      );

      toast.error(
        err?.message ??
        "Failed to create task or pipeline run record"
      );

      setIsRunning(false);
      return;
    }

    // ── PHASE 2: Execute pipeline via backend ───────────────────────────────
    let result: PipelineRunResult | null = null;
    try {
      if (!taskId) throw new Error("Task ID was not created");
      if (!runId) throw new Error("Pipeline run ID was not created");

      const nodes = selectedPipeline.config.map((block) => ({
        id: block.id,
        type: block.type,
        label: block.name,
        config: block.config ?? {},
      }));
      const edges = selectedPipeline.config.flatMap((block) =>
        (block.connections || []).map((targetId) => ({
          id: `${block.id}-${targetId}`,
          source: block.id,
          target: targetId,
        }))
      );
      const payload = {
        PipelineId: selectedPipeline.id,
        ProjectId: selectedProject.id,
        TaskId: taskId,
        RunId: runId,
        FileIds: selectedFileIdArray,
        Nodes: nodes,
        Edges: edges,
        Labels: labels,
        SelectedLabel: selectedLabel && selectedLabel !== "ALL_LABELS" ? selectedLabel : null,
      };

      console.log("TASK ID SENT TO PIPELINE", taskId);
      console.log(
        "FINAL PIPELINE EXECUTION PAYLOAD",
        JSON.stringify(payload, null, 2)
      );

      const jwt = getJwt();
      console.log("JWT:", jwt);
      
      const response = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
      body: JSON.stringify(payload),
    });

      result = await response.json();

      if (!response.ok || !result?.success) throw new Error("Backend execution failed");

      setRunResult(result);

      // ── PHASE 3: Update run → completed ───────────────────────────────────
      await updateRun.mutateAsync({
        id: runId,
        status: "completed",
        progress: 100,
        completed_items: selectedFiles.length,
      });

      toast.success(
        `Pipeline completed. Task created with ${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""}.`
      );
    } catch (err) {
      console.error("Pipeline execution error:", err);

      // ── Mark run as failed ────────────────────────────────────────────────
      if (runId) {
        await updateRun.mutateAsync({
          id: runId,
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown error",
        });
      }

      toast.error("Pipeline execution failed");
    } finally {
      setIsRunning(false);
    }
  };

  const getFileName = (fileId: string) =>
    files.find((f) => f.id === fileId)?.name ?? fileId;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Workflow className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Pipelines</h2>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Workflow className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Run Pipeline</h2>
            <p className="text-xs text-muted-foreground">
              Select files and a pipeline to process
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/pipelines?projectId=${projectId}`)} className="text-xs">
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Builder
        </Button>
      </div>

      {/* File selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Select Data Files</p>
          <div className="flex gap-2 items-center">
            <button className="text-xs text-primary hover:underline" onClick={selectAll}>
              Select All
            </button>
            <span className="text-xs text-muted-foreground">/</span>
            <button className="text-xs text-muted-foreground hover:underline" onClick={deselectAll}>
              Deselect All
            </button>
          </div>
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
            No files in this project yet
          </p>
        ) : (
          <div className="h-80 overflow-y-auto rounded-md border border-border">
            <div className="p-2 space-y-1">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 cursor-pointer"
                  onClick={() => toggleFile(file.id)}
                >
                  <Checkbox
                    checked={selectedFileIds.has(file.id)}
                    onCheckedChange={() => toggleFile(file.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedFileIds.size > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {selectedFileIds.size} file{selectedFileIds.size !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Pipeline selector */}
      <div>
        <p className="text-sm font-medium mb-2">Select Pipeline</p>
        {availablePipelines.length === 0 ? (
          <div className="text-center py-4 border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">No pipelines available</p>
            <Button variant="outline" size="sm" onClick={() => navigate(`/pipelines?projectId=${projectId}`)}>
              Create Pipeline
            </Button>
          </div>
        ) : (
          <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a pipeline..." />
            </SelectTrigger>
            <SelectContent>
              {availablePipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      ({p.pipeline_type.replace("_", " ")})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Target Label selector */}
      {projectLabels.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Select Target Label (Optional)</p>
          <Select value={selectedLabel} onValueChange={setSelectedLabel}>
            <SelectTrigger>
              <SelectValue placeholder="All Labels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL_LABELS">All Labels</SelectItem>
              {projectLabels.map((lbl) => (
                <SelectItem key={lbl} value={lbl}>
                  {lbl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Run button */}
      <Button
        onClick={handleRun}
        disabled={isRunning || selectedFileIds.size === 0 || !selectedPipelineId}
        className="w-full"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-1.5" />
            Run Pipeline
          </>
        )}
      </Button>

      {/* Results grouped by file */}
      {runResult && runResult.fileResults.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold">Results</p>
          {runResult.fileResults.map((fr) => (
            <div key={fr.fileId} className="rounded-lg border bg-secondary/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{getFileName(fr.fileId)}</p>
              </div>
              {fr.results.map((nr, i) => (
                <div key={i} className="space-y-2">
                  {nr.annotations && nr.annotations.length > 0 ? (
                    nr.annotations.map((ann, j) => (
                      <div key={j} className="rounded-md border p-3 bg-card space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge>{ann.label}</Badge>
                          <Badge variant="secondary">
                            {(ann.confidence * 100).toFixed(1)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          X: {ann.boundingBox.x} · Y: {ann.boundingBox.y} · W: {ann.boundingBox.width} · H: {ann.boundingBox.height}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {nr.status ?? "Execution completed"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
