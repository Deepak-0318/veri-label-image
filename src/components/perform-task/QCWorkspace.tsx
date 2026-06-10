import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { inferFileType } from "@/lib/fileTypeUtils";
import { useAnnotationHistory } from "@/hooks/useAnnotationHistory";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, FileText, Shield, ChevronDown, CheckCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioAnnotationView } from "@/components/annotation/AudioAnnotationView";
import { TextAnnotationView } from "@/components/annotation/TextAnnotationView";
import { PdfAnnotationView } from "@/components/annotation/PdfAnnotationView";
import { SpreadsheetAnnotationView } from "@/components/annotation/SpreadsheetAnnotationView";
import { McapAnnotationView } from "@/components/annotation/McapAnnotationView";
import { VideoAnnotationView } from "@/components/annotation/VideoAnnotationView";
import { PointCloudView } from "@/components/annotation/PointCloudView";
import { AnnotationCanvas } from "@/components/annotation/AnnotationCanvas";
import { AnnotationToolbar } from "@/components/annotation/AnnotationToolbar";
import { AnnotationEditDialog } from "@/components/annotation/AnnotationEditDialog";
import { QCAnnotationReviewList } from "./QCAnnotationReviewList";
import { LabelSelector } from "@/components/annotation/LabelSelector";
import { useAuth } from "@/hooks/useAuth";
import { useAnnotations } from "@/hooks/useAnnotations";
import { useLabels, Label } from "@/hooks/useLabels";
import { useProjectLabelTypes, useProjectLabels } from "@/hooks/useProjectLabels";
import { Annotation, AnnotationTool, TagColor } from "@/types/annotation";
import { useGroupTypes } from "@/hooks/useGroupTypes";
import { useProjectFlags } from "@/hooks/useProjectFlags";
import { useAnnotationFlags } from "@/hooks/useAnnotationFlags";
import { SubTask } from "@/hooks/useSubTasks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function QCWorkspace({
  subTask,
  projectId,
  onComplete,
}: {
  subTask: SubTask;
  projectId?: string;
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const file = subTask.file;
  const queryClient = useQueryClient();

  const {
    annotations,
    isLoading: annotationsLoading,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
  } = useAnnotations(file?.id, projectId);

  const { labels, createLabel } = useLabels(user?.id);
  const { labelTypes: projectLabelTypes } = useProjectLabelTypes(projectId);
  const { projectLabels } = useProjectLabels(projectId);
  const { groupTypes } = useGroupTypes(projectId);
  const { flags: projectFlags } = useProjectFlags(projectId);
  const annotationIds = useMemo(() => annotations.map(a => a.id), [annotations]);
  const { annotationFlags, setFlags: setAnnotationFlags } = useAnnotationFlags(annotationIds);
  const annotationFlagMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const af of annotationFlags) {
      if (!map[af.annotation_id]) map[af.annotation_id] = [];
      map[af.annotation_id].push(af.flag_id);
    }
    return map;
  }, [annotationFlags]);

  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeLabel, setActiveLabel] = useState(labels[0]?.name || "Object");
  const [activeColor, setActiveColor] = useState<TagColor>(labels[0]?.color || "blue");
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [activeLabelTypeId, setActiveLabelTypeId] = useState<string | undefined>(undefined);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [confirmReviewedOpen, setConfirmReviewedOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Detect fullscreen and use fullscreen element as portal container
  useEffect(() => {
    const handler = () => {
      setPortalContainer(document.fullscreenElement as HTMLElement | null);
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    setPortalContainer(document.fullscreenElement as HTMLElement | null);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      fullscreenRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  const effectiveType = useMemo(() => file ? inferFileType(file.name, file.type) : "", [file]);
  const isAudio = effectiveType.startsWith("audio");
  const isText = !!(effectiveType.startsWith("text") || file?.content);
  const isSpreadsheet = effectiveType === "application/spreadsheet";
  const isPdf = effectiveType === "application/pdf";
  const isMcap = effectiveType === "application/mcap";
  const isVideo = effectiveType.startsWith("video");
  const isImage = effectiveType.startsWith("image") && !!file?.thumbnail_url;
  const isPointCloud =
    effectiveType === "application/pcd" ||
    effectiveType === "application/npz" ||
    file?.name?.toLowerCase().endsWith(".pcd") ||
    file?.name?.toLowerCase().endsWith(".npz");

  // Point cloud camera view controls (set by PointCloudView via callback)
  const pcdViewControlsRef = useRef<{
    resetView: () => void;
    topView: () => void;
    frontView: () => void;
    sideView: () => void;
  } | null>(null);

  // QC actions - update qc_status/qc_comment directly in DB
  const updateQCStatus = useCallback(async (annotationId: string, qcStatus: string, qcComment?: string) => {
    const updates: { qc_status: string; qc_comment?: string } = { qc_status: qcStatus };
    if (qcComment !== undefined) updates.qc_comment = qcComment;
    const { error } = await supabase
      .from("annotations")
      .update(updates)
      .eq("id", annotationId);
    if (error) {
      toast.error(`Failed to update QC status: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["annotations", file?.id, projectId] });
  }, [file?.id, projectId, queryClient]);

  const handleAccept = useCallback((id: string, comment?: string) => {
    updateQCStatus(id, "approved", comment);
    toast.success("Annotation approved");
  }, [updateQCStatus]);

  // Build combined label list for the selector
  const combinedLabels = useMemo(() => {
    if (projectLabels.length > 0) {
      return projectLabels.map((pl: any) => {
        const lt = projectLabelTypes.find((t: any) => t.id === pl.label_type_id);
        return {
          id: pl.id,
          name: pl.name,
          color: pl.color as TagColor,
          labelTypeName: lt?.name,
          labelTypeId: pl.label_type_id,
        };
      });
    }
    return labels.map((l: any) => ({ id: l.id, name: l.name, color: l.color as TagColor }));
  }, [projectLabels, projectLabelTypes, labels]);

  // Filter by active label type
  const filteredLabels = useMemo(() => {
    if (!activeLabelTypeId) return combinedLabels;
    return combinedLabels.filter((l: any) => l.labelTypeId === activeLabelTypeId);
  }, [combinedLabels, activeLabelTypeId]);

  const handleRework = useCallback((id: string, comment: string) => {
    updateQCStatus(id, "rework", comment);
    toast.success("Annotation sent for rework");
  }, [updateQCStatus]);

  const handleQCCommentUpdate = useCallback((id: string, comment: string) => {
    updateQCStatus(id, undefined as any, comment);
  }, [updateQCStatus]);

  const handleQCCommentOnly = useCallback(async (annotationId: string, comment: string) => {
    const { error } = await supabase
      .from("annotations")
      .update({ qc_comment: comment })
      .eq("id", annotationId);
    if (error) toast.error(`Failed: ${error.message}`);
    else queryClient.invalidateQueries({ queryKey: ["annotations", file?.id, projectId] });
  }, [file?.id, projectId, queryClient]);

  const handleDelete = useCallback((id: string) => {
    historyRef.current?.trackDelete(id);
    deleteAnnotation.mutate(user ? { annotationId: id, userId: user.id } : id);
    if (selectedAnnotation === id) setSelectedAnnotation(null);
    toast.success("Annotation deleted");
  }, [deleteAnnotation, selectedAnnotation, user]);

  const handleRectify = useCallback((annotation: Annotation) => {
    setEditingAnnotation(annotation);
  }, []);

  const handleEditSave = useCallback(async (updates: { label: string; color: TagColor; labelTypeId?: string; comment?: string; groupTypeId?: string; flagIds?: string[] }) => {
    if (!user || !editingAnnotation) return;
    const { flagIds, ...annUpdates } = updates;
    const updated = {
      ...editingAnnotation,
      ...annUpdates,
      groupTypeName: annUpdates.groupTypeId ? groupTypes.find(gt => gt.id === annUpdates.groupTypeId)?.name : undefined,
    } as Annotation;
    updateAnnotation.mutate({ annotation: updated, userId: user.id });
    if (flagIds !== undefined) {
      setAnnotationFlags.mutate({ annotationId: editingAnnotation.id, flagIds });
    }
    await updateQCStatus(updated.id, "approved");
    setEditingAnnotation(null);
    toast.success("Annotation rectified & approved");
  }, [user, editingAnnotation, updateAnnotation, updateQCStatus, groupTypes, setAnnotationFlags]);

  // For creating new annotations during rectification
  const handleCreate = useCallback((annotation: Annotation) => {
    if (!user) return;
    createAnnotation.mutate({ annotation, userId: user.id });
    historyRef.current?.trackCreate(annotation);
    setSelectedAnnotation(annotation.id);
  }, [user, createAnnotation]);

  const handleUpdate = useCallback((annotation: Annotation) => {
    if (!user) return;
    historyRef.current?.trackUpdate(annotation);
    updateAnnotation.mutate({ annotation, userId: user.id });
  }, [user, updateAnnotation]);

  // Undo/redo support — mirrors TaskAnnotationWorkspace so audio QC has parity.
  // Uses raw mutate handlers to avoid re-tracking in history during replay.
  const rawCreate = useCallback((annotation: Annotation) => {
    if (!user) return;
    createAnnotation.mutate({ annotation, userId: user.id });
  }, [user, createAnnotation]);

  const rawUpdate = useCallback((annotation: Annotation) => {
    if (!user) return;
    updateAnnotation.mutate({ annotation, userId: user.id });
  }, [user, updateAnnotation]);

  const rawDelete = useCallback((id: string) => {
    deleteAnnotation.mutate(user ? { annotationId: id, userId: user.id } : id);
    if (selectedAnnotation === id) setSelectedAnnotation(null);
  }, [deleteAnnotation, selectedAnnotation, user]);

  const history = useAnnotationHistory({
    annotations,
    onCreate: rawCreate,
    onUpdate: rawUpdate,
    onDelete: rawDelete,
  });

  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);

  // Tracked variants used by the audio view so user actions go onto the undo stack.
  const handleAudioCreate = useCallback((annotation: Annotation) => {
    if (!user) return;
    createAnnotation.mutate({ annotation, userId: user.id });
    history.trackCreate(annotation);
    setSelectedAnnotation(annotation.id);
  }, [user, createAnnotation, history]);

  const handleAudioUpdate = useCallback((annotation: Annotation) => {
    if (!user) return;
    history.trackUpdate(annotation);
    updateAnnotation.mutate({ annotation, userId: user.id });
  }, [user, updateAnnotation, history]);

  const handleAudioDelete = useCallback((id: string) => {
    history.trackDelete(id);
    deleteAnnotation.mutate(user ? { annotationId: id, userId: user.id } : id);
    if (selectedAnnotation === id) setSelectedAnnotation(null);
    toast.success("Annotation deleted");
  }, [history, deleteAnnotation, selectedAnnotation, user]);

  // "Unapproved" = anything not currently approved (pending OR rework).
  // This ensures the Approve All button stays available even after Rework All
  // is clicked, so reviewers can quickly switch the bulk decision.
  const unapprovedAnnotations = annotations.filter(a => {
    const status = (a as any).qc_status;
    return status !== "approved";
  });

  // A sub-task is ready to be marked reviewed once every annotation has a QC
  // decision — either "approved" or "rework". Annotations marked for rework
  // still count as reviewed so the QA can finalize the sub-task and the rework
  // flow can push the task back to the annotator.
  const pendingReviewAnnotations = annotations.filter(a => {
    const status = (a as any).qc_status;
    return !status || status === "pending";
  });

  const allReviewed = annotations.length > 0 && pendingReviewAnnotations.length === 0;

  const handleApproveAll = useCallback(async () => {
    if (unapprovedAnnotations.length === 0) return;
    // Snapshot previous statuses so we can offer an undo.
    const previous = unapprovedAnnotations.map(a => ({
      id: a.id,
      qc_status: ((a as any).qc_status as string | null | undefined) ?? null,
    }));
    const ids = previous.map(p => p.id);
    const { error } = await supabase
      .from("annotations")
      .update({ qc_status: "approved" })
      .in("id", ids);
    if (error) {
      toast.error(`Failed to approve all: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["annotations", file?.id, projectId] });
    toast.success(`${ids.length} annotation${ids.length !== 1 ? "s" : ""} approved`, {
      action: {
        label: "Undo",
        onClick: async () => {
          // Group by previous status and restore in batches.
          const groups = new Map<string | null, string[]>();
          for (const p of previous) {
            const key = p.qc_status;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(p.id);
          }
          for (const [status, gIds] of groups) {
            const { error: undoErr } = await supabase
              .from("annotations")
              .update({ qc_status: status })
              .in("id", gIds);
            if (undoErr) {
              toast.error(`Undo failed: ${undoErr.message}`);
              return;
            }
          }
          queryClient.invalidateQueries({ queryKey: ["annotations", file?.id, projectId] });
          toast.success("Approve All undone");
        },
      },
      duration: 8000,
    });
  }, [unapprovedAnnotations, file?.id, projectId, queryClient]);

  const nonReworkAnnotations = annotations.filter(a => {
    const status = (a as any).qc_status;
    return !status || status !== "rework";
  });

  const handleReworkAll = useCallback(async () => {
    if (nonReworkAnnotations.length === 0) return;
    const previous = nonReworkAnnotations.map(a => ({
      id: a.id,
      qc_status: ((a as any).qc_status as string | null | undefined) ?? null,
    }));
    const ids = previous.map(p => p.id);
    const { error } = await supabase
      .from("annotations")
      .update({ qc_status: "rework" })
      .in("id", ids);
    if (error) {
      toast.error(`Failed to rework all: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["annotations", file?.id, projectId] });
    toast.success(`${ids.length} annotation${ids.length !== 1 ? "s" : ""} marked for rework`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const groups = new Map<string | null, string[]>();
          for (const p of previous) {
            const key = p.qc_status;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(p.id);
          }
          for (const [status, gIds] of groups) {
            const { error: undoErr } = await supabase
              .from("annotations")
              .update({ qc_status: status })
              .in("id", gIds);
            if (undoErr) {
              toast.error(`Undo failed: ${undoErr.message}`);
              return;
            }
          }
          queryClient.invalidateQueries({ queryKey: ["annotations", file?.id, projectId] });
          toast.success("Rework All undone");
        },
      },
      duration: 8000,
    });
  }, [nonReworkAnnotations, file?.id, projectId, queryClient]);

  if (!file) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">File data not available</div>;
  }

  if (annotationsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading annotations...
      </div>
    );
  }

  const showToolbar = !isAudio && !isSpreadsheet;
  const textAnnotations = annotations.filter(a => a.type === "textHighlight");

  const renderQCSidebar = () => (
    <div className="w-80 border-l border-border bg-card/50 flex flex-col shrink-0 min-h-0 h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-primary" />
          QC Review
        </h3>
      </div>

      {projectLabelTypes.length > 0 && (
        <div className="p-4 border-b border-border space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Label Type</h3>
          <Select
            value={activeLabelTypeId || "all"}
            onValueChange={(val) => setActiveLabelTypeId(val === "all" ? undefined : val)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select label type" />
            </SelectTrigger>
            <SelectContent container={portalContainer}>
              <SelectItem value="all">All Labels</SelectItem>
              {projectLabelTypes.map((lt) => (
                <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Collapsible defaultOpen className="shrink-0 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
          <h3 className="text-sm font-medium text-muted-foreground">Labels ({filteredLabels.length})</h3>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent className="max-h-64 overflow-hidden">
          <div className="max-h-64 overflow-y-auto border-b border-border p-4">
            <LabelSelector
              labels={filteredLabels}
              activeLabel={activeLabel}
              activeColor={activeColor}
              onLabelSelect={(name, color, labelId) => {
                setActiveLabel(name);
                setActiveColor(color);
                if (labelId) {
                  const matched = projectLabels.find(pl => pl.id === labelId);
                  if (matched) setActiveLabelTypeId(matched.label_type_id);
                }
              }}
              onLabelCreate={() => {}}
              readOnly
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
          <h3 className="text-sm font-medium text-muted-foreground">Annotations ({annotations.length})</h3>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        {annotations.length > 0 && (
          <div className="px-4 py-2 border-b border-border space-y-1.5">
            {unapprovedAnnotations.length > 0 && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleApproveAll}>
                <CheckCheck className="h-3.5 w-3.5" />
                Approve All ({unapprovedAnnotations.length})
              </Button>
            )}
            {nonReworkAnnotations.length > 0 && (
              <Button variant="outline" size="sm" className="w-full gap-2 text-orange-400 hover:text-orange-300 border-orange-500/30 hover:border-orange-500/50" onClick={handleReworkAll}>
                <RotateCcw className="h-3.5 w-3.5" />
                Rework All ({nonReworkAnnotations.length})
              </Button>
            )}
          </div>
        )}
        <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full min-h-0 overflow-y-auto">
            <QCAnnotationReviewList
              annotations={annotations}
              onAccept={handleAccept}
              onRework={handleRework}
              onDelete={handleDelete}
              onRectify={handleRectify}
              onCommentUpdate={handleQCCommentOnly}
              selectedAnnotation={selectedAnnotation}
              onSelect={setSelectedAnnotation}
              projectLabelTypes={projectLabelTypes}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  const renderAnnotationView = () => {
    if (isVideo && file.thumbnail_url) {
      return (
        <VideoAnnotationView
          fileUrl={file.thumbnail_url}
          annotations={annotations}
          activeTool={activeTool}
          selectedAnnotation={selectedAnnotation}
          activeLabel={activeLabel}
          activeColor={activeColor}
          zoom={zoom}
          onAnnotationCreate={handleCreate}
          onAnnotationSelect={setSelectedAnnotation}
          onAnnotationUpdate={handleUpdate}
          onAnnotationDelete={handleDelete}
          renderToolbar={(ctx) => (
            <AnnotationToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onUndo={history.undo}
              onRedo={history.redo}
              onClear={() => {}}
              onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
              onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
              onResetZoom={() => setZoom(1)}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              zoom={zoom}
              isTextFile={false}
              isMcapFile={true}
              isVideoFile={true}
              onToggleFullscreen={ctx?.toggleFullscreen}
              isFullscreen={ctx?.isFullscreen}
            />
          )}
          renderSidebar={() => renderQCSidebar()}
        />
      );
    }
    if (isMcap && file.thumbnail_url) {
      return (
        <McapAnnotationView
          fileUrl={file.thumbnail_url}
          annotations={annotations}
          activeTool={activeTool}
          selectedAnnotation={selectedAnnotation}
          activeLabel={activeLabel}
          activeColor={activeColor}
          zoom={zoom}
          onAnnotationCreate={handleCreate}
          onAnnotationSelect={setSelectedAnnotation}
          onAnnotationUpdate={handleUpdate}
          onAnnotationDelete={handleDelete}
          renderToolbar={(ctx) => (
            <AnnotationToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onUndo={history.undo}
              onRedo={history.redo}
              onClear={() => {}}
              onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
              onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
              onResetZoom={() => setZoom(1)}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              zoom={zoom}
              isTextFile={false}
              isMcapFile={true}
              isVideoFile={true}
              onToggleFullscreen={ctx?.toggleFullscreen}
              isFullscreen={ctx?.isFullscreen}
            />
          )}
          renderSidebar={() => renderQCSidebar()}
        />
      );
    }
    if (isPointCloud && file.thumbnail_url) {
      return (
        <PointCloudView
          fileUrl={file.thumbnail_url}
          fileName={file.name}
          annotations={annotations}
          activeTool={activeTool}
          selectedAnnotation={selectedAnnotation}
          activeLabel={activeLabel}
          activeColor={activeColor}
          onAnnotationCreate={handleCreate}
          onAnnotationUpdate={handleUpdate}
          onAnnotationSelect={setSelectedAnnotation}
          onViewControlsReady={(c) => { pcdViewControlsRef.current = c; }}
        />
      );
    }
    if (isSpreadsheet && (file.thumbnail_url || file.content)) {
      return (
        <SpreadsheetAnnotationView
          content={file.content || ""}
          fileName={file.name}
          annotations={annotations}
          labels={labels}
          onAnnotationCreate={handleCreate}
          onAnnotationDelete={handleDelete}
          onLabelCreate={() => {}}
        />
      );
    }
    if (isImage) {
      return (
        <AnnotationCanvas
          imageSrc={file.thumbnail_url!}
          annotations={annotations}
          activeTool={activeTool}
          selectedAnnotation={selectedAnnotation}
          activeLabel={activeLabel}
          activeColor={activeColor}
          zoom={zoom}
          onAnnotationCreate={handleCreate}
          onAnnotationSelect={setSelectedAnnotation}
          onAnnotationUpdate={handleUpdate}
          onAnnotationDelete={handleDelete}
          fitToContainer
          onZoomChange={setZoom}
        />
      );
    }
    if (isText && file.content) {
      return (
        <TextAnnotationView
          content={file.content}
          annotations={textAnnotations as any}
          activeLabel={activeLabel}
          activeColor={activeColor}
          selectedAnnotation={selectedAnnotation}
          onAnnotationCreate={handleCreate}
          onAnnotationSelect={setSelectedAnnotation}
        />
      );
    }
    if (isPdf && file.thumbnail_url) {
      return (
        <PdfAnnotationView
          pdfUrl={file.thumbnail_url}
          annotations={annotations}
          activeTool={activeTool}
          selectedAnnotation={selectedAnnotation}
          activeLabel={activeLabel}
          activeColor={activeColor}
          zoom={zoom}
          onAnnotationCreate={handleCreate}
          onAnnotationSelect={setSelectedAnnotation}
          onAnnotationUpdate={handleUpdate}
        />
      );
    }
    if (isAudio && file.thumbnail_url) {
      return (
        <AudioAnnotationView
          audioUrl={file.thumbnail_url}
          fileId={file.id}
          annotations={annotations}
          labels={labels}
          activeLabel={activeLabel}
          activeColor={activeColor}
          selectedAnnotation={selectedAnnotation}
          onAnnotationCreate={handleAudioCreate}
          onAnnotationUpdate={handleAudioUpdate}
          onAnnotationDelete={handleAudioDelete}
          onAnnotationSelect={setSelectedAnnotation}
          onLabelCreate={() => {}}
          projectLabels={projectLabels}
          projectLabelTypes={projectLabelTypes}
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          renderSidebar={() => renderQCSidebar()}
        />
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <FileText className="h-16 w-16 opacity-40" />
        <p className="text-lg font-medium">No preview available</p>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {file.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {annotations.length} annotation{annotations.length !== 1 ? "s" : ""} to review
          </p>
        </div>
        <Button
          onClick={() => setConfirmReviewedOpen(true)}
          className="gap-2"
          disabled={!allReviewed}
        >
          <CheckCircle2 className="h-4 w-4" />
          {allReviewed ? "Mark Reviewed" : "Review All First"}
        </Button>

        <AlertDialog open={confirmReviewedOpen} onOpenChange={setConfirmReviewedOpen}>
          <AlertDialogContent container={portalContainer}>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark sub-task as reviewed?</AlertDialogTitle>
              <AlertDialogDescription>
                This finalizes your QC review for this sub-task. You won't be able to mark it
                reviewed again unless it's sent back to the annotator for rework and returns to QC.
                Make sure all annotations have been properly reviewed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmReviewedOpen(false);
                  onComplete();
                }}
              >
                Mark Reviewed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Toolbar */}
      {showToolbar && !isFullscreen && (
        <div className="px-6 py-2 border-b border-border flex justify-center">
          <AnnotationToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onUndo={history.undo}
            onRedo={history.redo}
            onClear={() => {}}
            onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
            onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
            onResetZoom={() => setZoom(1)}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            zoom={zoom}
            isTextFile={isText && !isPdf}
            isMcapFile={isMcap || isVideo}
            isVideoFile={isMcap || isVideo}
            onToggleFullscreen={isImage || isPointCloud || isMcap || isVideo ? toggleFullscreen : undefined}
            isFullscreen={isFullscreen}
            isPointCloudFile={isPointCloud}
            onResetView={() => pcdViewControlsRef.current?.resetView()}
            onTopView={() => pcdViewControlsRef.current?.topView()}
            onFrontView={() => pcdViewControlsRef.current?.frontView()}
            onSideView={() => pcdViewControlsRef.current?.sideView()}
          />
        </div>
      )}

      {/* Main content + review sidebar */}
      <div
        ref={fullscreenRef}
        className={cn("flex-1 min-h-0 flex overflow-hidden", isFullscreen && "bg-background")}
      >
        <div className={cn("relative flex-1 min-h-0 flex flex-col min-w-0", (isMcap || isVideo) ? "p-2 overflow-hidden" : "p-6 overflow-auto")}>
          {(isImage || isPointCloud || isMcap || isVideo) && isFullscreen && showToolbar && (
            <div className="pb-2 flex justify-center shrink-0">
              <AnnotationToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onUndo={history.undo}
                onRedo={history.redo}
                onClear={() => {}}
                onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
                onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                onResetZoom={() => setZoom(1)}
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                zoom={zoom}
                isTextFile={false}
                isMcapFile={isMcap || isVideo}
                isVideoFile={isMcap || isVideo}
                onToggleFullscreen={toggleFullscreen}
                isFullscreen={isFullscreen}
                isPointCloudFile={isPointCloud}
                onResetView={() => pcdViewControlsRef.current?.resetView()}
                onTopView={() => pcdViewControlsRef.current?.topView()}
                onFrontView={() => pcdViewControlsRef.current?.frontView()}
                onSideView={() => pcdViewControlsRef.current?.sideView()}
              />
            </div>
          )}
          {renderAnnotationView()}
        </div>

        {/* QC Review sidebar — audio renders it inside its own fullscreen container */}
        {!isAudio && renderQCSidebar()}
      </div>

      {/* Edit dialog for rectification */}
      {editingAnnotation && (
        <AnnotationEditDialog
          annotation={editingAnnotation}
          open={!!editingAnnotation}
          onOpenChange={(open) => { if (!open) setEditingAnnotation(null); }}
          onSave={handleEditSave}
          projectLabelTypes={projectLabelTypes}
          projectLabels={projectLabels}
          groupTypes={groupTypes}
          projectFlags={projectFlags}
          annotationFlagIds={editingAnnotation ? (annotationFlagMap[editingAnnotation.id] || []) : []}
          portalContainer={portalContainer}
        />
      )}
    </div>
  );
}
