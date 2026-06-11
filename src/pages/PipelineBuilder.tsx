import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type ReactFlowInstance,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { usePipelines, PipelineBlock } from "@/hooks/usePipelines";
import { useFiles } from "@/hooks/useFiles";
import { usePipelineRuns } from "@/hooks/usePipelineRuns";
import { useTasks } from "@/hooks/useTasks";
import { useBlockTemplates, type BlockTemplate } from "@/hooks/useBlockTemplates";
import PipelineNode, { type PipelineNodeData } from "@/components/pipeline/PipelineNode";
import { NodeConfigPanel } from "@/components/pipeline/NodeConfigPanel";
import PipelineResultsPanel from "@/components/pipeline/PipelineResultsPanel";
import { CreateBlockDialog } from "@/components/pipeline/CreateBlockDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Play,
  Save,
  Brain,
  Code,
  GitBranch,
  Zap,
  Workflow,
  Trash2,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  Map,
  Maximize,
  Minimize,
  Download,
  Upload,
  Database,
  FileOutput,
  FileText,
  Globe,
  Layers,
  Clock,
  Terminal,
  RefreshCw,
  MessageSquare,
  Bot,
  MoreVertical,
} from "lucide-react";
import { PipelineResult } from "@/types/pipelineResult";
import { toast } from "sonner";
import { cn } from "@/lib/utils";



const ICON_MAP: Record<string, React.ElementType> = {
  Brain, Code, GitBranch, Zap, Download, Upload, Database,
  FileOutput, FileText, Globe, Layers, Clock, Terminal, RefreshCw,
  MessageSquare, Bot,
};

const CATEGORY_LABELS: Record<string, string> = {
  io: "Input / Output",
  ai: "AI Models",
  transform: "Transforms",
  operations: "Operations",
  condition: "Conditions",
  custom: "Custom",
};

const CATEGORY_STYLES: Record<string, string> = {
  io: "border-[hsl(var(--tag-red,0_84%_60%)/0.5)] hover:border-[hsl(var(--tag-red,0_84%_60%))] text-[hsl(var(--tag-red,0_84%_60%))]",
  ai: "border-[hsl(var(--tag-purple)/0.5)] hover:border-[hsl(var(--tag-purple))] text-[hsl(var(--tag-purple))]",
  function: "border-[hsl(var(--tag-blue)/0.5)] hover:border-[hsl(var(--tag-blue))] text-[hsl(var(--tag-blue))]",
  transform: "border-[hsl(var(--tag-blue)/0.5)] hover:border-[hsl(var(--tag-blue))] text-[hsl(var(--tag-blue))]",
  operations: "border-[hsl(var(--primary)/0.5)] hover:border-[hsl(var(--primary))] text-primary",
  logical: "border-[hsl(var(--tag-yellow)/0.5)] hover:border-[hsl(var(--tag-yellow))] text-[hsl(var(--tag-yellow))]",
  condition: "border-[hsl(var(--tag-yellow)/0.5)] hover:border-[hsl(var(--tag-yellow))] text-[hsl(var(--tag-yellow))]",
  custom: "border-[hsl(var(--tag-green)/0.5)] hover:border-[hsl(var(--tag-green))] text-[hsl(var(--tag-green))]",
};

const nodeTypes: NodeTypes = {
  pipeline: PipelineNode,
};

// Convert PipelineBlocks to React Flow nodes/edges
function blocksToFlow(blocks: PipelineBlock[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = blocks.map((b) => ({
    id: b.id,
    type: "pipeline",
    position: b.position || { x: 250, y: 0 },
    data: {
      blockType: b.type,
      label: b.name,
      config: b.config,
    } satisfies PipelineNodeData,
  }));

  const edges: Edge[] = [];
  blocks.forEach((b) => {
    (b.connections || []).forEach((targetId) => {
      edges.push({
        id: `${b.id}-${targetId}`,
        source: b.id,
        target: targetId,
        animated: true,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
      });
    });
  });

  return { nodes, edges };
}

// Convert React Flow nodes/edges back to PipelineBlocks
function flowToBlocks(nodes: Node[], edges: Edge[]): PipelineBlock[] {
  return nodes.map((n) => {
    const data = n.data as unknown as PipelineNodeData;
    const connections = edges
      .filter((e) => e.source === n.id)
      .map((e) => e.target);
    return {
      id: n.id,
      type: data.blockType,
      name: data.label,
      config: data.config,
      position: n.position,
      connections,
    };
  });
}

export default function PipelineBuilder() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const { pipelines, isLoading, createPipeline, updatePipeline, deletePipeline } = usePipelines(user?.id);
  const { files } = useFiles(user?.id);
  const { createRun, updateRun } = usePipelineRuns(user?.id);
  const { createTask } = useTasks(user?.id);
  const { grouped: blockGroups, isLoading: blocksLoading, createTemplate } = useBlockTemplates(user?.id);

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [blockPanelOpen, setBlockPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingPipeline = useRef(false);
  const lastSavedSnapshot = useRef<string>("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Create dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("auto_tagging");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [editPipelineId, setEditPipelineId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("");

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  // Build a snapshot string for dirty checking
  const buildSnapshot = useCallback((n: Node[], e: Edge[], name: string, desc: string) => {
    const blocks = flowToBlocks(n, e);
    return JSON.stringify({ blocks, name, desc });
  }, []);

  // Load selected pipeline into flow — only when selection changes, not on pipelines refetch
  const prevSelectedId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedPipelineId && selectedPipelineId !== prevSelectedId.current) {
      prevSelectedId.current = selectedPipelineId;
      isLoadingPipeline.current = true;
      const p = pipelines.find((p) => p.id === selectedPipelineId);
      if (p) {
        const { nodes: n, edges: e } = blocksToFlow(p.config || []);
        setNodes(n);
        setEdges(e);
        setPipelineName(p.name);
        setPipelineDescription(p.description || "");
        setSelectedNodeId(null);
        setSaveStatus("idle");
        console.log("Pipeline loaded:", { id: p.id, name: p.name, pipeline_type: p.pipeline_type });
        const snapshot = buildSnapshot(n, e, p.name, p.description || "");
        lastSavedSnapshot.current = snapshot;
      }
      setTimeout(() => { isLoadingPipeline.current = false; }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPipelineId]);

  // Auto-save debounced — only if changed
  const triggerAutoSave = useCallback(() => {
    if (!selectedPipelineId || isLoadingPipeline.current) return;
    if (!pipelineName.trim()) return; // guard: never save an empty name
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const currentSnapshot = buildSnapshot(nodes, edges, pipelineName, pipelineDescription);
      if (currentSnapshot === lastSavedSnapshot.current) return; // no changes
      setSaveStatus("saving");
      const blocks = flowToBlocks(nodes, edges);
      console.log("Pipeline save payload:", { id: selectedPipelineId, name: pipelineName, config: blocks });
      updatePipeline.mutate(
        {
          id: selectedPipelineId,
          name: pipelineName,
          description: pipelineDescription,
          config: blocks,
        },
        {
          onSuccess: (saved) => {
            console.log("Pipeline saved:", saved);
            lastSavedSnapshot.current = currentSnapshot;
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
          },
          onError: () => setSaveStatus("idle"),
        }
      );
    }, 1500);
  }, [selectedPipelineId, nodes, edges, pipelineName, pipelineDescription, updatePipeline, buildSnapshot]);
   
  useEffect(() => {
    triggerAutoSave();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges, pipelineName, pipelineDescription, triggerAutoSave]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const addNode = useCallback(
    (template: BlockTemplate) => {
      const id = crypto.randomUUID();
      const maxY = nodes.reduce((max, n) => Math.max(max, n.position.y), -80);
      const newNode: Node = {
        id,
        type: "pipeline",
        position: { x: 250, y: maxY + 120 },
        data: {
          blockType: template.block_type as PipelineBlock["type"],
          label: template.name,
          config: { ...((template.default_config as Record<string, unknown>) || {}) },
        } satisfies PipelineNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(id);

      // Auto-connect to previous last node if exists
      if (nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        setEdges((eds) =>
          addEdge(
            {
              id: `${lastNode.id}-${id}`,
              source: lastNode.id,
              target: id,
              animated: true,
              style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
            },
            eds
          )
        );
      }
    },
    [nodes, setNodes, setEdges]
  );

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  const onInit = useCallback((instance: ReactFlowInstance<Node, Edge>) => {
    setReactFlowInstance(instance);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/pipeline-block");
      if (!raw || !reactFlowInstance) return;

      const template: BlockTemplate = JSON.parse(raw);
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = crypto.randomUUID();
      const newNode: Node = {
        id,
        type: "pipeline",
        position,
        data: {
          blockType: template.block_type as PipelineBlock["type"],
          label: template.name,
          config: { ...((template.default_config as Record<string, unknown>) || {}) },
        } satisfies PipelineNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(id);
    },
    [reactFlowInstance, setNodes]
  );

  const updateNodeData = useCallback(
    (nodeId: string, updates: Partial<PipelineNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as unknown as PipelineNodeData), ...updates } }
            : n
        )
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [setNodes, setEdges, selectedNodeId]
  );

  const handleSave = useCallback(() => {
    if (!selectedPipelineId) return;
    const blocks = flowToBlocks(nodes, edges);
    updatePipeline.mutate({
      id: selectedPipelineId,
      name: pipelineName,
      description: pipelineDescription,
      config: blocks,
    });
  }, [selectedPipelineId, nodes, edges, pipelineName, pipelineDescription, updatePipeline]);

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    createPipeline.mutate(
      { name: newName, description: newDesc, pipeline_type: newType, project_id: projectId || undefined },
      {
        onSuccess: (data) => {
          setSelectedPipelineId(data.id);
          setShowNewDialog(false);
          setNewName("");
          setNewDesc("");
        },
      }
    );
  };

  const handleRunPipeline = async () => {
    const selectedFileId = localStorage.getItem("selectedFileId");
    const selectedFiles = selectedFileId
      ? files.filter((file) => file.id === selectedFileId)
      : [];
    const selectedFileIds = selectedFiles.map((file) => file.id);
    const selectedProject = selectedFiles[0]?.project_id
      ? { id: selectedFiles[0].project_id }
      : null;

    console.log("Selected Project:", selectedProject);
    console.log("Selected Files:", selectedFiles.map(({ id, name }) => ({ id, name })));
    console.log("Selected Pipeline:", selectedPipeline);
    console.log("Selected File IDs:", selectedFileIds);

    let runId: string | null = null;

    try {
      if (!selectedProject) throw new Error("No project selected for the selected file");
      if (!selectedPipeline) throw new Error("No pipeline selected");
      if (selectedFiles.length === 0) throw new Error("No files selected");
      if (nodes.length === 0) throw new Error("This pipeline has no blocks configured");

      setIsExecuting(true);

      const task = await createTask.mutateAsync({
        name: `Review: ${selectedPipeline.name}`,
        description: `Auto-generated by pipeline execution. Pipeline: ${selectedPipeline.name}`,
        project_id: selectedProject.id,
        total_items: selectedFiles.length,
      });
      const taskId = task.id;
      console.log("Created Task ID:", taskId);

      const subTaskRows = selectedFileIds.map((fileId) => ({
        task_id: taskId,
        file_id: fileId,
        status: "pending",
      }));

      const { error: subTaskError } = await supabase
        .from("sub_tasks" as never)
        .insert(subTaskRows as never);
      if (subTaskError) throw subTaskError;

      const run = await createRun.mutateAsync({
        pipeline_id: selectedPipeline.id,
        project_id: selectedProject.id,
        total_items: selectedFiles.length,
        file_ids: selectedFileIds,
      });
      runId = run.id;
      console.log("Created PipelineRun ID:", runId);

      if (!taskId) throw new Error("Task ID was not created");
      if (!runId) throw new Error("Pipeline run ID was not created");

      const payload = {
        PipelineId: selectedPipeline.id,
        ProjectId: selectedProject.id,
        TaskId: taskId,
        RunId: runId,
        FileIds: selectedFileIds,
        Nodes: nodes.map((node: Node) => ({
          id: node.id,
          type: node.data?.blockType,
          label: node.data?.label,
          config: node.data?.config || {},
        })),
        Edges: edges,
      };

      console.log("FINAL PIPELINE EXECUTION PAYLOAD", payload);

      const response = await fetch(
        "/api/pipeline/run",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      console.log("Pipeline Result:", JSON.stringify(result, null, 2));
      setPipelineResult(result);

      if (!response.ok) {
        throw new Error(result.message || result.error || "Pipeline execution failed");
      }

      await updateRun.mutateAsync({
        id: runId,
        status: "completed",
        progress: 100,
        completed_items: selectedFiles.length,
      });

      toast.success(result.message || "Pipeline executed successfully");
    } catch (error) {
      console.error("Pipeline run failed:", error);
      if (runId) {
        await updateRun.mutateAsync({
          id: runId,
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      toast.error(error instanceof Error ? error.message : "Failed to execute pipeline");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDeletePipeline = (id: string) => {
    deletePipeline.mutate(id, {
      onSuccess: () => {
        if (selectedPipelineId === id) {
          setSelectedPipelineId(null);
          setNodes([]);
          setEdges([]);
        }
        setDeleteConfirmId(null);
        toast.success("Pipeline deleted successfully");
      },
    });
  };

  const handleEditSave = () => {
    if (!editPipelineId || !editName.trim()) {
      toast.error("Name is required");
      return;
    }
    updatePipeline.mutate(
      { id: editPipelineId, name: editName.trim(), description: editDesc },
      {
        onSuccess: () => {
          if (selectedPipelineId === editPipelineId) {
            setPipelineName(editName.trim());
            setPipelineDescription(editDesc);
          }
          setEditPipelineId(null);
          toast.success("Pipeline updated successfully");
        },
      }
    );
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {!isFullscreen && <Sidebar />}

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {!isFullscreen && (
        <header className="sticky top-0 z-10 glass border-b border-border px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Workflow className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Pipeline Builder</h1>
                <p className="text-xs text-muted-foreground">
                  Visual no-code pipeline editor for auto-tagging workflows
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedPipelineId && (
                <>
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-1.5 text-xs text-primary">
                      <Check className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                    if (selectedPipelineId) {
                      setDeleteConfirmId(selectedPipelineId);
                      setDeleteConfirmName(selectedPipeline?.name ?? "");
                    }
                  }}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button size="sm" onClick={handleRunPipeline} disabled={isExecuting}>
                    {isExecuting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-1" />
                    )}
                    {isExecuting ? "Running..." : "Run"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Left panel — Pipeline list */}
          {!isFullscreen && (
          <div className="w-60 border-r border-border flex flex-col bg-card/30">
            <div className="p-3 border-b border-border">
              <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogTrigger asChild>
                  <Button variant="gradient" className="w-full" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New Pipeline
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Pipeline</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input value={newName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} placeholder="My Pipeline" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea value={newDesc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDesc(e.target.value)} placeholder="What does this pipeline do?" rows={2} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Type</label>
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto_tagging">Auto Tagging</SelectItem>
                          <SelectItem value="data">Data Pipeline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreate} className="w-full" disabled={createPipeline.isPending}>
                      Create
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isLoading ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                ) : pipelines.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No pipelines yet</p>
                ) : (
                  pipelines.map((p: { id: string; name: string; pipeline_type: string; description: string | null }) => (
                    <div key={p.id} className="relative group">
                      <button
                        onClick={() => setSelectedPipelineId(p.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors pr-8",
                          selectedPipelineId === p.id
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Workflow className="h-4 w-4 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {p.pipeline_type.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditPipelineId(p.id);
                              setEditName(p.name);
                              setEditDesc(p.description ?? "");
                              setEditType(p.pipeline_type);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeleteConfirmId(p.id);
                              setDeleteConfirmName(p.name);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          )}

          {/* Center — React Flow Canvas */}
          <div className="flex-1 relative">
            {!selectedPipelineId ? (
              <div className="flex-1 h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-3">
                  <Workflow className="h-16 w-16 mx-auto opacity-30" />
                  <p className="text-lg font-medium">Select or create a pipeline</p>
                  <p className="text-sm">Build automated tagging workflows visually</p>
                </div>
              </div>
            ) : (
              <ReactFlow
                ref={reactFlowWrapper}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onInit={onInit}
                onDragOver={onDragOver}
                onDrop={onDrop}
                nodeTypes={nodeTypes}
                fitView
                snapToGrid
                snapGrid={[20, 20]}
                defaultEdgeOptions={{
                  animated: true,
                  style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
                }}
                proOptions={{ hideAttribution: true }}
                colorMode={theme === "light" ? "light" : "dark"}
                className="!bg-background"
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="hsl(var(--border))"
                />
                <Controls
                  className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-secondary"
                />
                {showMiniMap && (
                  <MiniMap
                    className="!bg-card !border-border !rounded-lg"
                    nodeColor="hsl(var(--primary))"
                    maskColor="hsl(var(--background) / 0.8)"
                  />
                )}

                {/* Floating block palette */}
                <Panel position="top-left" className="!m-3">
                  <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-10rem)]">
                    <button
                      onClick={() => setBlockPanelOpen((v: boolean) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Add Block
                      </span>
                      {blockPanelOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    {blockPanelOpen && (
                      <ScrollArea className="flex-1 overflow-auto">
                        <div className="px-3 pb-3 space-y-3">
                          {blocksLoading ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Loading blocks...</p>
                          ) : Object.entries(blockGroups).map(([category, blocks]) => (
                            <div key={category}>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                {CATEGORY_LABELS[category] || category}
                              </p>
                              <div className="space-y-1.5">
                          {(blocks as BlockTemplate[]).map((t: BlockTemplate) => {
                                  const Icon = ICON_MAP[t.icon] || Zap;
                                  return (
                                    <div
                                      key={t.id}
                                      draggable
                                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                                        e.dataTransfer.setData("application/pipeline-block", JSON.stringify(t));
                                        e.dataTransfer.effectAllowed = "move";
                                      }}
                                      className={cn(
                                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left hover:scale-[1.02] cursor-grab active:cursor-grabbing",
                                        CATEGORY_STYLES[t.category] || CATEGORY_STYLES[t.block_type] || ""
                                      )}
                                    >
                                      <Icon className="h-4 w-4 shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-foreground">{t.name}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-border mt-2">
                            <CreateBlockDialog createTemplate={createTemplate} />
                          </div>
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </Panel>

                {/* MiniMap toggle — positioned below the minimap */}
                <Panel position="bottom-right" className="!m-3 !mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={showMiniMap ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowMiniMap((v: boolean) => !v)}
                      className="gap-1.5 shadow-lg"
                    >
                      <Map className="h-3.5 w-3.5" />
                      {showMiniMap ? "Hide Map" : "Show Map"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFullscreen((v: boolean) => !v)}
                      className="gap-1.5 shadow-lg"
                    >
                      {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                      {isFullscreen ? "Exit" : "Fullscreen"}
                    </Button>
                  </div>
                </Panel>

                {/* Pipeline name overlay */}
                <Panel position="top-center" className="!m-3">
                  <div className="bg-card/80 backdrop-blur border border-border rounded-lg px-4 py-2 flex items-center gap-3">
                    <Input
                      value={pipelineName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPipelineName(e.target.value)}
                      className="bg-transparent border-none h-7 text-sm font-semibold w-48 focus-visible:ring-0 px-0"
                    />
                    <Badge variant="secondary" className="text-[10px] shrink-0 capitalize">
                      {selectedPipeline?.pipeline_type.replace("_", " ")}
                    </Badge>
                  </div>
                </Panel>
              </ReactFlow>
            )}
          </div>

          {/* Right panel — Config */}
          {selectedNode && (
            <div className="w-72 border-l border-border bg-card/30 overflow-y-auto">
              <NodeConfigPanel
                nodeId={selectedNode.id}
                data={selectedNode.data as unknown as PipelineNodeData}
                onUpdate={(updates) => updateNodeData(selectedNode.id, updates)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            </div>
          )}
          <PipelineResultsPanel
            result={pipelineResult}
          />
        </div>
      </main>

      <Dialog open={!!editPipelineId} onOpenChange={(open) => !open && setEditPipelineId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                placeholder="Pipeline name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDesc}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditDesc(e.target.value)}
                placeholder="What does this pipeline do?"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_tagging">Auto Tagging</SelectItem>
                  <SelectItem value="data">Data Pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditPipelineId(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={updatePipeline.isPending}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pipeline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmName}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDeletePipeline(deleteConfirmId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
