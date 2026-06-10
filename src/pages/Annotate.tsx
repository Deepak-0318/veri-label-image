import { useState, useCallback, useEffect, useMemo } from "react";
import { inferFileType } from "@/lib/fileTypeUtils";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download, ChevronLeft, ChevronRight, LogIn, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnotationToolbar } from "@/components/annotation/AnnotationToolbar";
import { AnnotationCanvas } from "@/components/annotation/AnnotationCanvas";
import { TextAnnotationView } from "@/components/annotation/TextAnnotationView";
import { SpreadsheetAnnotationView } from "@/components/annotation/SpreadsheetAnnotationView";
import { AudioAnnotationView } from "@/components/annotation/AudioAnnotationView";
import { PdfAnnotationView } from "@/components/annotation/PdfAnnotationView";
import { McapAnnotationView } from "@/components/annotation/McapAnnotationView";
import { VideoAnnotationView } from "@/components/annotation/VideoAnnotationView";
import { AnnotationSidebar } from "@/components/annotation/AnnotationSidebar";
import { Annotation, AnnotationTool, TagColor, TextHighlightAnnotation } from "@/types/annotation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAnnotations } from "@/hooks/useAnnotations";
import { useLabels, Label } from "@/hooks/useLabels";
import { useFiles } from "@/hooks/useFiles";
import { useProjectLabelTypes, useProjectLabels } from "@/hooks/useProjectLabels";
import { useGroupTypes } from "@/hooks/useGroupTypes";
import { useProjectFlags } from "@/hooks/useProjectFlags";
import { useAnnotationFlags } from "@/hooks/useAnnotationFlags";

export default function Annotate() {
  const { fileId, projectId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { files } = useFiles(user?.id);
  
  // Find current file
  const currentIndex = files.findIndex(f => f.id === fileId);
  const file = files[currentIndex] || files[0];
  const effectiveType = useMemo(() => file ? inferFileType(file.name, file.type) : "", [file]);
  const isTextFile = !!(effectiveType.startsWith("text") || file?.content);
  const isAudioFile = !!effectiveType.startsWith("audio");
  const isSpreadsheetFile = useMemo(() => {
    if (!file) return false;
    return effectiveType === "application/spreadsheet";
  }, [file, effectiveType]);
  const isPdfFile = effectiveType === "application/pdf";
  const isMcapFile = effectiveType === "application/mcap";
  const isVideoFile = effectiveType.startsWith("video");
  const isImageFile = effectiveType.startsWith("image") && !!file?.thumbnail_url;
  const isDemoFile = file?.id.startsWith("demo-");

  // Use database annotations for real files, local state for demo
  const { 
    annotations: dbAnnotations, 
    isLoading: annotationsLoading,
    createAnnotation,
    updateAnnotation: updateDbAnnotation,
    deleteAnnotation,
    deleteAllAnnotations,
  } = useAnnotations(isDemoFile ? undefined : fileId, projectId);

  const { labels, createLabel } = useLabels(user?.id);
  const { labelTypes: projectLabelTypes } = useProjectLabelTypes(projectId);
  const { projectLabels, deleteLabel: deleteProjectLabel } = useProjectLabels(projectId);
  const { groupTypes } = useGroupTypes(projectId);
  const { flags: projectFlags } = useProjectFlags(projectId);

  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [activeLabel, setActiveLabel] = useState(labels[0]?.name || 'Object');
  const [activeColor, setActiveColor] = useState<TagColor>(labels[0]?.color || 'blue');
  const [activeLabelId, setActiveLabelId] = useState<string | undefined>(undefined);
  const [activeLabelTypeId, setActiveLabelTypeId] = useState<string | undefined>(undefined);
  const [activeGroupTypeId, setActiveGroupTypeId] = useState<string | undefined>(undefined);

  // Use database annotations or local state depending on auth status
  const annotations = user && !isDemoFile ? dbAnnotations : localAnnotations;

  const annotationIds = useMemo(() => annotations.map(a => a.id), [annotations]);
  const { annotationFlags: annFlags, setFlags: setAnnotationFlags } = useAnnotationFlags(annotationIds);
  const annotationFlagMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const af of annFlags) {
      if (!map[af.annotation_id]) map[af.annotation_id] = [];
      map[af.annotation_id].push(af.flag_id);
    }
    return map;
  }, [annFlags]);

  // Update active label when labels change
  useEffect(() => {
    if (labels.length > 0 && !labels.find(l => l.name === activeLabel)) {
      setActiveLabel(labels[0].name);
      setActiveColor(labels[0].color);
    }
  }, [labels, activeLabel]);

  const addToHistory = useCallback((newAnnotations: Annotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleAnnotationCreate = useCallback((annotation: Annotation) => {
    // Attach active label type and group type if set
    const enriched = {
      ...annotation,
      labelTypeId: activeLabelTypeId,
      labelTypeName: activeLabelTypeId ? projectLabelTypes.find(lt => lt.id === activeLabelTypeId)?.name : undefined,
      groupTypeId: activeGroupTypeId,
      groupTypeName: activeGroupTypeId ? groupTypes.find(gt => gt.id === activeGroupTypeId)?.name : undefined,
    };
    if (user && !isDemoFile) {
      createAnnotation.mutate({ annotation: enriched, userId: user.id });
    } else {
      const newAnnotations = [...localAnnotations, enriched];
      setLocalAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    }
    setSelectedAnnotation(enriched.id);
    toast.success(`${annotation.type === 'boundingBox' ? 'Bounding box' : annotation.type === 'polygon' ? 'Polygon' : 'Text highlight'} created`);
  }, [user, isDemoFile, createAnnotation, localAnnotations, addToHistory]);

  const handleAnnotationUpdate = useCallback((annotation: Annotation) => {
    if (user && !isDemoFile) {
      updateDbAnnotation.mutate({ annotation, userId: user.id });
    } else {
      const newAnnotations = localAnnotations.map(a => a.id === annotation.id ? annotation : a);
      setLocalAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    }
  }, [user, isDemoFile, updateDbAnnotation, localAnnotations, addToHistory]);

  const handleAnnotationDelete = useCallback((id: string) => {
    if (user && !isDemoFile) {
      deleteAnnotation.mutate({ annotationId: id, userId: user.id });
    } else {
      const newAnnotations = localAnnotations.filter(a => a.id !== id);
      setLocalAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    }
    if (selectedAnnotation === id) {
      setSelectedAnnotation(null);
    }
    toast.success("Annotation deleted");
  }, [user, isDemoFile, deleteAnnotation, localAnnotations, selectedAnnotation, addToHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setLocalAnnotations(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setLocalAnnotations(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  const handleClear = useCallback(() => {
    if (user && !isDemoFile) {
      deleteAllAnnotations.mutate();
    } else {
      setLocalAnnotations([]);
      addToHistory([]);
    }
    setSelectedAnnotation(null);
    toast.success("All annotations cleared");
  }, [user, isDemoFile, deleteAllAnnotations, addToHistory]);

  const handleSave = useCallback(() => {
    if (!user) {
      toast.error("Sign in to save annotations");
      return;
    }
    // Annotations are auto-saved to database
    toast.success("Annotations saved successfully!");
  }, [user]);
  console.log("dbAnnotations", dbAnnotations.length);
  console.log("localAnnotations", localAnnotations.length);
  console.log("annotations", annotations.length);

  const handleExport = useCallback(() => {
    const exportData = {
      file: {
        id: file.id,
        name: file.name,
        type: file.type,
      },
      annotations,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.split('.')[0]}_annotations.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Annotations exported!");
  }, [annotations, file]);

  const handleLabelSelect = useCallback((label: string, color: TagColor, labelId?: string) => {
    setActiveLabel(label);
    setActiveColor(color);
    setActiveLabelId(labelId);
    // Auto-set the label type when selecting a project label
    if (labelId) {
      const matchedProjectLabel = projectLabels.find(pl => pl.id === labelId);
      if (matchedProjectLabel) {
        setActiveLabelTypeId(matchedProjectLabel.label_type_id);
      }
    }
  }, [projectLabels]);

  const handleLabelCreate = useCallback((label: Label) => {
    if (user) {
      createLabel.mutate({ label: { name: label.name, color: label.color }, userId: user.id });
    }
    setActiveLabel(label.name);
    setActiveColor(label.color);
  }, [user, createLabel]);

  const handleUpdateLabel = useCallback((id: string, newLabel: string) => {
    const annotation = annotations.find(a => a.id === id);
    if (annotation) {
      handleAnnotationUpdate({ ...annotation, label: newLabel });
    }
  }, [annotations, handleAnnotationUpdate]);

  const handleAnnotationCommentUpdate = useCallback((id: string, comment: string) => {
    const annotation = annotations.find(a => a.id === id);
    if (annotation) {
      handleAnnotationUpdate({ ...annotation, comment });
    }
  }, [annotations, handleAnnotationUpdate]);

  const navigateFile = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < files.length) {
      navigate(projectId ? `/annotate/${projectId}/${files[newIndex].id}` : `/annotate/${files[newIndex].id}`);
      setLocalAnnotations([]);
      setHistory([[]]);
      setHistoryIndex(0);
    }
  };

  const textAnnotations = annotations.filter(
    (a): a is TextHighlightAnnotation => a.type === 'textHighlight'
  );

  if (!file) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">File not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{file.name}</h1>
              <p className="text-xs text-muted-foreground">
                {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                {isDemoFile && !user && " (demo mode - sign in to save)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateFile('prev')}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {currentIndex + 1} / {files.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateFile('next')}
              disabled={currentIndex === files.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {!user && (
              <Button variant="outline" onClick={() => navigate('/auth')}>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            )}
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleSave} disabled={!user || isDemoFile}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </header>

      {/* Toolbar - shown for all formats except audio (has its own transport) */}
      {!isAudioFile && (
        <div className="px-6 py-3 border-b border-border flex justify-center">
          <AnnotationToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={handleClear}
            onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
            onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
            onResetZoom={() => setZoom(1)}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            zoom={zoom}
            isTextFile={isTextFile}
            isMcapFile={isMcapFile || isVideoFile}
            isVideoFile={isMcapFile || isVideoFile}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Canvas/Content Area */}
        <div className="flex-1 p-6 flex flex-col min-w-0 min-h-0">
          {annotationsLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Loading annotations...
            </div>
          ) : isMcapFile && file.thumbnail_url ? (
            <McapAnnotationView
              fileUrl={file.thumbnail_url}
              annotations={annotations}
              activeTool={activeTool}
              selectedAnnotation={selectedAnnotation}
              activeLabel={activeLabel}
              activeColor={activeColor}
              zoom={zoom}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationSelect={setSelectedAnnotation}
              onAnnotationUpdate={handleAnnotationUpdate}
              onAnnotationDelete={handleAnnotationDelete}
              renderToolbar={(ctx) => (
                <AnnotationToolbar
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onClear={handleClear}
                  onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
                  onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                  onResetZoom={() => setZoom(1)}
                  canUndo={historyIndex > 0}
                  canRedo={historyIndex < history.length - 1}
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
                  onLabelSelect={handleLabelSelect}
                  onLabelCreate={handleLabelCreate}
                  onAnnotationSelect={setSelectedAnnotation}
                  onAnnotationDelete={handleAnnotationDelete}
                  onAnnotationUpdate={handleAnnotationUpdate}
                  onLabelTypeChange={setActiveLabelTypeId}
                  onProjectLabelDelete={(id) => deleteProjectLabel.mutate(id)}
                  groupTypes={groupTypes}
                  activeGroupTypeId={activeGroupTypeId}
                  onGroupTypeChange={setActiveGroupTypeId}
                  projectFlags={projectFlags}
                  annotationFlagMap={annotationFlagMap}
                  onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
                />
              )}
            />
          ) : isVideoFile && file.thumbnail_url ? (
            <VideoAnnotationView
              fileUrl={file.thumbnail_url}
              annotations={annotations}
              activeTool={activeTool}
              selectedAnnotation={selectedAnnotation}
              activeLabel={activeLabel}
              activeColor={activeColor}
              zoom={zoom}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationSelect={setSelectedAnnotation}
              onAnnotationUpdate={handleAnnotationUpdate}
              onAnnotationDelete={handleAnnotationDelete}
              renderToolbar={(ctx) => (
                <AnnotationToolbar
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onClear={handleClear}
                  onZoomIn={() => setZoom(z => Math.min(z + 0.25, 3))}
                  onZoomOut={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                  onResetZoom={() => setZoom(1)}
                  canUndo={historyIndex > 0}
                  canRedo={historyIndex < history.length - 1}
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
                  onLabelSelect={handleLabelSelect}
                  onLabelCreate={handleLabelCreate}
                  onAnnotationSelect={setSelectedAnnotation}
                  onAnnotationDelete={handleAnnotationDelete}
                  onAnnotationUpdate={handleAnnotationUpdate}
                  onLabelTypeChange={setActiveLabelTypeId}
                  onProjectLabelDelete={(id) => deleteProjectLabel.mutate(id)}
                  groupTypes={groupTypes}
                  activeGroupTypeId={activeGroupTypeId}
                  onGroupTypeChange={setActiveGroupTypeId}
                  projectFlags={projectFlags}
                  annotationFlagMap={annotationFlagMap}
                  onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
                />
              )}
            />
          ) : isAudioFile && file.thumbnail_url ? (
            <AudioAnnotationView
              audioUrl={file.thumbnail_url}
              fileId={file.id}
              annotations={annotations}
              labels={labels}
              activeLabel={activeLabel}
              activeColor={activeColor}
              selectedAnnotation={selectedAnnotation}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationUpdate={handleAnnotationUpdate}
              onAnnotationDelete={handleAnnotationDelete}
              onAnnotationSelect={setSelectedAnnotation}
              onLabelCreate={handleLabelCreate}
              projectLabels={projectLabels}
              projectLabelTypes={projectLabelTypes}
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
                  onLabelSelect={handleLabelSelect}
                  onLabelCreate={handleLabelCreate}
                  onAnnotationSelect={setSelectedAnnotation}
                  onAnnotationDelete={handleAnnotationDelete}
                  onAnnotationUpdate={handleAnnotationUpdate}
                  onLabelTypeChange={setActiveLabelTypeId}
                  onProjectLabelDelete={(id) => deleteProjectLabel.mutate(id)}
                  groupTypes={groupTypes}
                  activeGroupTypeId={activeGroupTypeId}
                  onGroupTypeChange={setActiveGroupTypeId}
                  projectFlags={projectFlags}
                  annotationFlagMap={annotationFlagMap}
                  onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
                />
              )}
            />
          ) : isSpreadsheetFile && file.content ? (
            <SpreadsheetAnnotationView
              content={file.content}
              fileName={file.name}
              annotations={annotations}
              labels={labels}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationDelete={handleAnnotationDelete}
              onLabelCreate={handleLabelCreate}
            />
          ) : isPdfFile && file.thumbnail_url ? (
            <PdfAnnotationView
              pdfUrl={file.thumbnail_url}
              annotations={annotations}
              activeTool={activeTool}
              selectedAnnotation={selectedAnnotation}
              activeLabel={activeLabel}
              activeColor={activeColor}
              zoom={zoom}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationSelect={setSelectedAnnotation}
              onAnnotationUpdate={handleAnnotationUpdate}
            />
          ) : isTextFile && file.content ? (
            <TextAnnotationView
              content={file.content}
              annotations={textAnnotations}
              activeLabel={activeLabel}
              activeColor={activeColor}
              selectedAnnotation={selectedAnnotation}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationSelect={setSelectedAnnotation}
            />
          ) : file.thumbnail_url ? (
            <AnnotationCanvas
              imageSrc={file.thumbnail_url}
              annotations={annotations}
              activeTool={activeTool}
              selectedAnnotation={selectedAnnotation}
              activeLabel={activeLabel}
              activeColor={activeColor}
              zoom={zoom}
              onAnnotationCreate={handleAnnotationCreate}
              onAnnotationSelect={setSelectedAnnotation}
              onAnnotationUpdate={handleAnnotationUpdate}
              onAnnotationDelete={handleAnnotationDelete}
              fitToContainer
              onZoomChange={setZoom}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <FileText className="h-16 w-16 opacity-40" />
              <p className="text-lg font-medium">No preview available</p>
              <p className="text-sm">This file type doesn't support inline preview or annotation yet.</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - for formats that don't render their own sidebar */}
        {!isMcapFile && !isVideoFile && !isAudioFile && (
          <AnnotationSidebar
            labels={labels}
            annotations={annotations}
            activeLabel={activeLabel}
            activeLabelId={activeLabelId}
            activeColor={activeColor}
            selectedAnnotation={selectedAnnotation}
            labelsDefaultOpen
            projectLabelTypes={projectLabelTypes}
            projectLabels={projectLabels}
            activeLabelTypeId={activeLabelTypeId}
            onLabelSelect={handleLabelSelect}
            onLabelCreate={handleLabelCreate}
            onAnnotationSelect={setSelectedAnnotation}
            onAnnotationDelete={handleAnnotationDelete}
            onAnnotationUpdate={handleAnnotationUpdate}
            onLabelTypeChange={setActiveLabelTypeId}
            onProjectLabelDelete={(id) => deleteProjectLabel.mutate(id)}
            groupTypes={groupTypes}
            activeGroupTypeId={activeGroupTypeId}
            onGroupTypeChange={setActiveGroupTypeId}
            projectFlags={projectFlags}
            annotationFlagMap={annotationFlagMap}
            onAnnotationFlagsChange={(annId, flagIds) => setAnnotationFlags.mutate({ annotationId: annId, flagIds })}
          />
        )}
      </div>
    </div>
  );
}
