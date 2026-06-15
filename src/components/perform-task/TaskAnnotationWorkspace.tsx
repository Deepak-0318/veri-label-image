import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { inferFileType } from "@/lib/fileTypeUtils";
import { useAnnotationHistory } from "@/hooks/useAnnotationHistory";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { AudioAnnotationView } from "@/components/annotation/AudioAnnotationView";
import { TextAnnotationView } from "@/components/annotation/TextAnnotationView";
import { PdfAnnotationView } from "@/components/annotation/PdfAnnotationView";
import { SpreadsheetAnnotationView } from "@/components/annotation/SpreadsheetAnnotationView";
import { McapAnnotationView } from "@/components/annotation/McapAnnotationView";
import { VideoAnnotationView } from "@/components/annotation/VideoAnnotationView";
import { PointCloudView } from "@/components/annotation/PointCloudView";
import { AnnotationCanvas } from "@/components/annotation/AnnotationCanvas";
import { AnnotationToolbar } from "@/components/annotation/AnnotationToolbar";
import { AnnotationSidebar } from "@/components/annotation/AnnotationSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAnnotations } from "@/hooks/useAnnotations";
import { useLabels, Label } from "@/hooks/useLabels";
import { useProjectLabelTypes, useProjectLabels } from "@/hooks/useProjectLabels";
import { useGroupTypes } from "@/hooks/useGroupTypes";
import { useProjectFlags } from "@/hooks/useProjectFlags";
import { useAnnotationFlags } from "@/hooks/useAnnotationFlags";
import { useProjectVariables } from "@/hooks/useProjectVariables";
import { useAnnotationVariableValues } from "@/hooks/useAnnotationVariables";
import { Annotation, AnnotationTool, TagColor, TextHighlightAnnotation } from "@/types/annotation";
import { SubTask } from "@/hooks/useSubTasks";

export function TaskAnnotationWorkspace({
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

  const {
    annotations,
    isLoading: annotationsLoading,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    deleteAllAnnotations,
  } = useAnnotations(file?.id, projectId);

  const { labels, createLabel } = useLabels(user?.id);
  const { labelTypes: projectLabelTypes } = useProjectLabelTypes(projectId);
  const { projectLabels, deleteLabel: deleteProjectLabel } = useProjectLabels(projectId);
  const { groupTypes } = useGroupTypes(projectId);
  const { flags: projectFlags } = useProjectFlags(projectId);
  const annotationIds = useMemo(() => annotations.map(a => a.id), [annotations]);
  const { annotationFlags, setFlags: setAnnotationFlags } = useAnnotationFlags(annotationIds);
  const { variables: projectVariables } = useProjectVariables(projectId);
  const { valueMap: annotationVariableValueMap, setValues: setAnnotationVariableValues } = useAnnotationVariableValues(annotationIds);
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
  const [activeLabelId, setActiveLabelId] = useState<string | undefined>(undefined);
  const [activeLabelTypeId, setActiveLabelTypeId] = useState<string | undefined>(undefined);
  const [activeGroupTypeId, setActiveGroupTypeId] = useState<string | undefined>(undefined);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const [initializedProjectLabels, setInitializedProjectLabels] = useState(false);

  useEffect(() => {
    if (projectLabels.length > 0 && !initializedProjectLabels) {
      setActiveLabel(projectLabels[0].name);
      setActiveColor(projectLabels[0].color);
      setActiveLabelId(projectLabels[0].id);
      setActiveLabelTypeId(projectLabels[0].label_type_id);
      setInitializedProjectLabels(true);
    }
  }, [projectLabels, initializedProjectLabels]);

  useEffect(() => {
    const handler = () => {
      setPortalContainer(document.fullscreenElement as HTMLElement | null);
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    setPortalContainer(document.fullscreenElement as HTMLElement | null);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (!selectedAnnotation) return;

    const ann =
      annotations.find(
        a => a.id === selectedAnnotation
      );

    if (!ann) return;

    setActiveLabel(ann.label);

    if (ann.labelTypeId) {
      setActiveLabelTypeId(
        ann.labelTypeId
      );
    }
  }, [
    selectedAnnotation,
    annotations
  ]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      fullscreenRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  const alreadyMarkedForQC = subTask.status === "completed";

  const effectiveType = useMemo(() => file ? inferFileType(file.name, file.type) : "", [file]);
  const isAudio = effectiveType.startsWith("audio");
  const isText = !!(effectiveType.startsWith("text") || file?.content);
  const isSpreadsheet = effectiveType === "application/spreadsheet";
  const isPdf = effectiveType === "application/pdf";
  const isMcap = effectiveType === "application/mcap";
  const isPointCloud =
    effectiveType === "application/pcd" ||
    effectiveType === "application/npz" ||
    file?.name?.toLowerCase().endsWith(".pcd") ||
    file?.name?.toLowerCase().endsWith(".npz");
  const isVideo = effectiveType.startsWith("video");
  const isImage = effectiveType.startsWith("image") && !!file?.thumbnail_url;

  // Point cloud camera view controls (set by PointCloudView via callback)
  const pcdViewControlsRef = useRef<{
    resetView: () => void;
    topView: () => void;
    frontView: () => void;
    sideView: () => void;
  } | null>(null);

  // Raw handlers for undo/redo replay (no tracking to avoid infinite loops)
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
  }, [deleteAnnotation, selectedAnnotation]);

  const history = useAnnotationHistory({
    annotations,
    onCreate: rawCreate,
    onUpdate: rawUpdate,
    onDelete: rawDelete,
  });

  const handleCreate = useCallback((annotation: Annotation) => {
    if (!user) return;
    const enriched = {
      ...annotation,
      labelTypeId: activeLabelTypeId,
      labelTypeName: activeLabelTypeId ? projectLabelTypes.find(lt => lt.id === activeLabelTypeId)?.name : undefined,
      groupTypeId: activeGroupTypeId,
      groupTypeName: activeGroupTypeId ? groupTypes.find(gt => gt.id === activeGroupTypeId)?.name : undefined,
    };
    createAnnotation.mutate({ annotation: enriched, userId: user.id });
    history.trackCreate(enriched);
    setSelectedAnnotation(enriched.id);
  }, [user, createAnnotation, activeLabelTypeId, projectLabelTypes, activeGroupTypeId, groupTypes, history]);

  const handleUpdate = useCallback((annotation: Annotation) => {
    if (!user) return;
    history.trackUpdate(annotation);
    updateAnnotation.mutate({ annotation, userId: user.id });
  }, [user, updateAnnotation, history]);

  const handleDelete = useCallback((id: string) => {
    history.trackDelete(id);
    deleteAnnotation.mutate(user ? { annotationId: id, userId: user.id } : id);
    if (selectedAnnotation === id) setSelectedAnnotation(null);
  }, [deleteAnnotation, selectedAnnotation, history]);

  const handleLabelCreate = useCallback((label: Label) => {
    if (!user) return;
    createLabel.mutate({ label: { name: label.name, color: label.color }, userId: user.id });
    setActiveLabel(label.name);
    setActiveColor(label.color);
  }, [user, createLabel]);

  const handleLabelSelect = useCallback((label: string, color: TagColor, labelId?: string) => {
    setActiveLabel(label);
    setActiveColor(color);
    setActiveLabelId(labelId);
    // Auto-set the label type when selecting a project label by ID
    if (labelId) {
      const matchedProjectLabel = projectLabels.find(pl => pl.id === labelId);
      if (matchedProjectLabel) {
        setActiveLabelTypeId(matchedProjectLabel.label_type_id);
      }
    }
  }, [projectLabels]);

  const handleUpdateLabel = useCallback((id: string, newLabel: string) => {
    const annotation = annotations.find(a => a.id === id);
    if (annotation) handleUpdate({ ...annotation, label: newLabel });
  }, [annotations, handleUpdate]);

  const handleClear = useCallback(() => {
    deleteAllAnnotations.mutate();
    setSelectedAnnotation(null);
  }, [deleteAllAnnotations]);

  const handleAnnotationCommentUpdate = useCallback((id: string, comment: string) => {
    const annotation = annotations.find(a => a.id === id);
    if (annotation) handleUpdate({ ...annotation, comment });
  }, [annotations, handleUpdate]);

  const reworkAnnotations = annotations.filter(a => (a as any).qc_status === "rework");

  const textAnnotations = annotations.filter(
    (a): a is TextHighlightAnnotation => a.type === "textHighlight"
  );

  useEffect(() => {
    if (annotations.length === 1) {
      setSelectedAnnotation(annotations[0].id);
    }
  }, [annotations]);

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        File data not available
      </div>
    );
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

  const renderAnnotationView = () => {
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
          onAnnotationCreate={handleCreate}
          onAnnotationUpdate={handleUpdate}
          onAnnotationDelete={handleDelete}
          onAnnotationSelect={setSelectedAnnotation}
           onLabelCreate={handleLabelCreate}
          projectLabels={projectLabels}
          projectLabelTypes={projectLabelTypes}
          onUndo={history.undo}
          onRedo={history.redo}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          renderSidebar={() => (
            <AnnotationSidebar
              labels={labels}
              annotations={annotations}
              activeLabel={activeLabel}
              activeLabelId={activeLabelId}
              activeColor={activeColor}
              selectedAnnotation={selectedAnnotation}
              labelsDefaultOpen={false}
              projectLabelTypes={projectLabelTypes}
              projectLabels={projectLabels}
              activeLabelTypeId={activeLabelTypeId}
              readOnly
              onLabelSelect={handleLabelSelect}
              onLabelCreate={handleLabelCreate}
              onAnnotationSelect={setSelectedAnnotation}
              onAnnotationDelete={handleDelete}
              onAnnotationUpdate={handleUpdate}
              onLabelTypeChange={setActiveLabelTypeId}
              groupTypes={groupTypes}
              activeGroupTypeId={activeGroupTypeId}
              onGroupTypeChange={setActiveGroupTypeId}
              projectFlags={projectFlags}
              annotationFlagMap={annotationFlagMap}
              onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
              projectVariables={projectVariables}
              annotationVariableValueMap={annotationVariableValueMap}
              onAnnotationVariableValuesChange={(annId, values) => setAnnotationVariableValues.mutate({ annotationId: annId, values })}
            />
          )}
        />
      );
    }

    if (isSpreadsheet && file.content) {
      return (
        <SpreadsheetAnnotationView
          content={file.content}
          fileName={file.name}
          annotations={annotations}
          labels={labels}
          onAnnotationCreate={handleCreate}
          onAnnotationDelete={handleDelete}
          onLabelCreate={handleLabelCreate}
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
              onClear={handleClear}
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
          renderSidebar={() => (
            <AnnotationSidebar
              labels={labels}
              annotations={annotations}
              activeLabel={activeLabel}
              activeLabelId={activeLabelId}
              activeColor={activeColor}
              selectedAnnotation={selectedAnnotation}
              labelsDefaultOpen={false}
              projectLabelTypes={projectLabelTypes}
              projectLabels={projectLabels}
              activeLabelTypeId={activeLabelTypeId}
              readOnly
              annotationsDefaultOpen
              onLabelSelect={handleLabelSelect}
              onLabelCreate={handleLabelCreate}
              onAnnotationSelect={setSelectedAnnotation}
              onAnnotationDelete={handleDelete}
              onAnnotationUpdate={handleUpdate}
              onLabelTypeChange={setActiveLabelTypeId}
              groupTypes={groupTypes}
              activeGroupTypeId={activeGroupTypeId}
              onGroupTypeChange={setActiveGroupTypeId}
              projectFlags={projectFlags}
              annotationFlagMap={annotationFlagMap}
              onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
              projectVariables={projectVariables}
              annotationVariableValueMap={annotationVariableValueMap}
              onAnnotationVariableValuesChange={(annId, values) => setAnnotationVariableValues.mutate({ annotationId: annId, values })}
            />
          )}
        />
      );
    }

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
              onClear={handleClear}
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
          renderSidebar={() => (
            <AnnotationSidebar
              labels={labels}
              annotations={annotations}
              activeLabel={activeLabel}
              activeLabelId={activeLabelId}
              activeColor={activeColor}
              selectedAnnotation={selectedAnnotation}
              labelsDefaultOpen={false}
              projectLabelTypes={projectLabelTypes}
              projectLabels={projectLabels}
              activeLabelTypeId={activeLabelTypeId}
              readOnly
              annotationsDefaultOpen
              onLabelSelect={handleLabelSelect}
              onLabelCreate={handleLabelCreate}
              onAnnotationSelect={setSelectedAnnotation}
              onAnnotationDelete={handleDelete}
              onAnnotationUpdate={handleUpdate}
              onLabelTypeChange={setActiveLabelTypeId}
              groupTypes={groupTypes}
              activeGroupTypeId={activeGroupTypeId}
              onGroupTypeChange={setActiveGroupTypeId}
              projectFlags={projectFlags}
              annotationFlagMap={annotationFlagMap}
              onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
              projectVariables={projectVariables}
              annotationVariableValueMap={annotationVariableValueMap}
              onAnnotationVariableValuesChange={(annId, values) => setAnnotationVariableValues.mutate({ annotationId: annId, values })}
            />
          )}
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

    if (isText && file.content) {
      return (
        <TextAnnotationView
          content={file.content}
          annotations={textAnnotations}
          activeLabel={activeLabel}
          activeColor={activeColor}
          selectedAnnotation={selectedAnnotation}
          onAnnotationCreate={handleCreate}
          onAnnotationSelect={setSelectedAnnotation}
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

    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <FileText className="h-16 w-16 opacity-40" />
        <p className="text-lg font-medium">No preview available</p>
        <p className="text-sm">This file type doesn't support inline annotation yet.</p>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Rework banner */}
      {reworkAnnotations.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-orange-500/10 border-b border-orange-500/30">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <p className="text-sm font-medium text-orange-400">
            {reworkAnnotations.length} annotation{reworkAnnotations.length !== 1 ? "s" : ""} need rework — review QC comments and fix the highlighted items
          </p>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">{file.name}</h2>
          <p className="text-sm text-muted-foreground">
            {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
            {reworkAnnotations.length > 0 && (
              <span className="text-orange-400 ml-1">· {reworkAnnotations.length} rework</span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setConfirmOpen(true)}
          className="gap-2"
          disabled={alreadyMarkedForQC}
          title={alreadyMarkedForQC ? "Already marked for QC" : undefined}
        >
          <CheckCircle2 className="h-4 w-4" />
          {alreadyMarkedForQC ? "Marked for QC" : "Mark for QC"}
        </Button>
      </div>

      {/* Toolbar for non-audio, non-spreadsheet */}
      {showToolbar && !isFullscreen && (
        <div className="px-6 py-2 border-b border-border flex justify-center">
          <AnnotationToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onUndo={history.undo}
            onRedo={history.redo}
            onClear={handleClear}
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

      {/* Main content area */}
      <div
        ref={fullscreenRef}
        className={cn(
          "flex-1 min-h-0 flex overflow-hidden",
          isFullscreen && "bg-background"
        )}
      >
        <div className={cn("relative flex-1 min-h-0 flex flex-col min-w-0", (isMcap || isVideo) ? "p-2 overflow-hidden" : "p-6 overflow-auto")}>
          {/* Fullscreen toolbar (image / point cloud) */}
          {(isImage || isPointCloud || isMcap || isVideo) && isFullscreen && showToolbar && (
            <div className="pb-2 flex justify-center shrink-0">
              <AnnotationToolbar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onUndo={history.undo}
                onRedo={history.redo}
                onClear={handleClear}
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

        {/* Sidebar for non-audio, non-spreadsheet (those have built-in label UIs) */}
        {!isAudio && !isSpreadsheet && (!isFullscreen || isImage || isPointCloud || isMcap || isVideo) && (
          <AnnotationSidebar
            labels={labels}
            annotations={annotations}
            activeLabel={activeLabel}
            activeLabelId={activeLabelId}
            activeColor={activeColor}
            selectedAnnotation={selectedAnnotation}
            labelsDefaultOpen={!isMcap && !isVideo}
            projectLabelTypes={projectLabelTypes}
            projectLabels={projectLabels}
          activeLabelTypeId={activeLabelTypeId}
          readOnly
          annotationsDefaultOpen={!isMcap && !isVideo}
          onLabelSelect={handleLabelSelect}
          onLabelCreate={handleLabelCreate}
          onAnnotationSelect={setSelectedAnnotation}
            onAnnotationDelete={handleDelete}
            onAnnotationUpdate={handleUpdate}
            onLabelTypeChange={setActiveLabelTypeId}
            groupTypes={groupTypes}
            activeGroupTypeId={activeGroupTypeId}
            onGroupTypeChange={setActiveGroupTypeId}
            projectFlags={projectFlags}
            annotationFlagMap={annotationFlagMap}
            onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
              projectVariables={projectVariables}
              annotationVariableValueMap={annotationVariableValueMap}
              onAnnotationVariableValuesChange={(annId, values) => setAnnotationVariableValues.mutate({ annotationId: annId, values })}
          />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent container={portalContainer}>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this sub-task for QC?</AlertDialogTitle>
            <AlertDialogDescription>
              Once marked, this sub-task will be sent to the QC review pool and you will not be able to mark it again unless its status is changed. Make sure all annotations are finalized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onComplete();
              }}
            >
              Mark for QC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
