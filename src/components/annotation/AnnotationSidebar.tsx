import { Annotation, TagColor } from "@/types/annotation";
import { Label } from "@/hooks/useLabels";
import { ProjectLabelType, ProjectLabel } from "@/hooks/useProjectLabels";
import { GroupType } from "@/hooks/useGroupTypes";
import { ProjectFlag } from "@/hooks/useProjectFlags";
import { ProjectVariable } from "@/hooks/useProjectVariables";
import { AnnotationVariableValue } from "@/hooks/useAnnotationVariables";
import { LabelSelector } from "./LabelSelector";
import { AnnotationList } from "./AnnotationList";
import { AnnotationEditDialog } from "./AnnotationEditDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AnnotationSidebarProps {
  labels: Label[];
  annotations: Annotation[];
  activeLabel: string;
  activeLabelId?: string;
  activeColor: TagColor;
  selectedAnnotation: string | null;
  labelsDefaultOpen?: boolean;
  annotationsDefaultOpen?: boolean;
  projectLabelTypes?: ProjectLabelType[];
  projectLabels?: ProjectLabel[];
  activeLabelTypeId?: string;
  readOnly?: boolean;
  groupTypes?: GroupType[];
  activeGroupTypeId?: string;
  projectFlags?: ProjectFlag[];
  annotationFlagMap?: Record<string, string[]>;
  projectVariables?: ProjectVariable[];
  annotationVariableValueMap?: Record<string, Record<string, AnnotationVariableValue>>;
  onLabelSelect: (label: string, color: TagColor, labelId?: string) => void;
  onLabelCreate: (label: Label) => void;
  onAnnotationSelect: (id: string | null) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
  onLabelTypeChange?: (labelTypeId: string | undefined) => void;
  onProjectLabelDelete?: (id: string) => void;
  onGroupTypeChange?: (groupTypeId: string | undefined) => void;
  onAnnotationFlagsChange?: (annotationId: string, flagIds: string[]) => void;
  onAnnotationVariableValuesChange?: (annotationId: string, values: Record<string, AnnotationVariableValue>) => void;
}

export function AnnotationSidebar({
  labels,
  annotations,
  activeLabel,
  activeLabelId,
  activeColor,
  selectedAnnotation,
  labelsDefaultOpen = true,
  annotationsDefaultOpen = true,
  projectLabelTypes = [],
  projectLabels = [],
  activeLabelTypeId,
  readOnly = false,
  groupTypes = [],
  activeGroupTypeId,
  projectFlags = [],
  annotationFlagMap = {},
  projectVariables = [],
  annotationVariableValueMap = {},
  onLabelSelect,
  onLabelCreate,
  onAnnotationSelect,
  onAnnotationDelete,
  onAnnotationUpdate,
  onLabelTypeChange,
  onProjectLabelDelete,
  onGroupTypeChange,
  onAnnotationFlagsChange,
  onAnnotationVariableValuesChange,
}: AnnotationSidebarProps) {
  const [labelsOpen, setLabelsOpen] = useState(labelsDefaultOpen);
  const [annotationsOpen, setAnnotationsOpen] = useState(annotationsDefaultOpen);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  // Detect fullscreen and use fullscreen element as portal container
  useEffect(() => {
    const handler = () => {
      setPortalContainer(document.fullscreenElement as HTMLElement | null);
    };
    document.addEventListener("fullscreenchange", handler);
    // Set initial state
    setPortalContainer(document.fullscreenElement as HTMLElement | null);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Filter project labels by selected label type
  const filteredProjectLabels = activeLabelTypeId
    ? projectLabels.filter(l => l.label_type_id === activeLabelTypeId)
    : projectLabels;

  // When project has label types, always show project labels; otherwise show personal labels
  const hasProjectLabelTypes = projectLabelTypes.length > 0;
  const displayLabels = hasProjectLabelTypes
    ? filteredProjectLabels.map(pl => {
        const typeName = projectLabelTypes.find(lt => lt.id === pl.label_type_id)?.name;
        return { id: pl.id, name: pl.name, color: pl.color, labelTypeName: typeName };
      })
    : labels;

  const handleEdit = (annotation: Annotation) => {
    setEditingAnnotation(annotation);
    setEditDialogOpen(true);
  };

  const handleEditSave = (updated: { label: string; color: TagColor; labelTypeId?: string; comment?: string; groupTypeId?: string; flagIds?: string[]; variableValues?: Record<string, AnnotationVariableValue> }) => {
    if (!editingAnnotation) return;
    onAnnotationUpdate({
      ...editingAnnotation,
      label: updated.label,
      color: updated.color,
      labelTypeId: updated.labelTypeId,
      labelTypeName: updated.labelTypeId ? projectLabelTypes.find(lt => lt.id === updated.labelTypeId)?.name : undefined,
      comment: updated.comment,
      groupTypeId: updated.groupTypeId,
      groupTypeName: updated.groupTypeId ? groupTypes.find(gt => gt.id === updated.groupTypeId)?.name : undefined,
    });
    // Update flags separately
    if (updated.flagIds !== undefined && onAnnotationFlagsChange) {
      onAnnotationFlagsChange(editingAnnotation.id, updated.flagIds);
    }
    // Update variable values separately
    if (updated.variableValues !== undefined && onAnnotationVariableValuesChange) {
      onAnnotationVariableValuesChange(editingAnnotation.id, updated.variableValues);
    }
    setEditingAnnotation(null);
  };

  return (
    <div className="w-80 border-l border-border bg-card/50 flex flex-col shrink-0 min-h-0 h-full overflow-hidden">
      {/* Label Type Selector - only if project has label types */}
      {projectLabelTypes.length > 0 && (
        <div className="p-4 border-b border-border space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Label Type</h3>
          <Select
            value={activeLabelTypeId || "all"}
            onValueChange={(val) => onLabelTypeChange?.(val === "all" ? undefined : val)}
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

      {/* Group Type Selector - only if project has group types */}
      {groupTypes.length > 0 && (
        <div className="p-4 border-b border-border space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Group Type</h3>
          <Select
            value={activeGroupTypeId || "default"}
            onValueChange={(val) => onGroupTypeChange?.(val === "default" ? undefined : val)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select group type" />
            </SelectTrigger>
            <SelectContent container={portalContainer}>
              <SelectItem value="default">Default</SelectItem>
              {groupTypes.map((gt) => (
                <SelectItem key={gt.id} value={gt.id}>{gt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Labels - Collapsible */}
      <Collapsible
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        className="shrink-0 overflow-hidden"
      >
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
          <h3 className="text-sm font-medium text-muted-foreground">Labels ({displayLabels.length})</h3>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", labelsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="max-h-64 overflow-hidden">
          <div className="max-h-64 overflow-y-auto border-b border-border p-4">
            <LabelSelector
              labels={displayLabels}
              activeLabel={activeLabel}
              activeLabelId={activeLabelId}
              activeColor={activeColor}
              onLabelSelect={onLabelSelect}
              onLabelCreate={onLabelCreate}
              onLabelDelete={onProjectLabelDelete}
              readOnly={readOnly}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Annotations - Collapsible */}
      <Collapsible
        open={annotationsOpen}
        onOpenChange={setAnnotationsOpen}
        className="flex flex-1 min-h-0 flex-col overflow-hidden"
      >
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 border-b border-border hover:bg-muted/50 transition-colors">
          <h3 className="text-sm font-medium text-muted-foreground">
            Annotations ({annotations.length})
          </h3>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", annotationsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full min-h-0 overflow-y-auto">
            <AnnotationList
              annotations={annotations}
              selectedAnnotation={selectedAnnotation}
              onSelect={onAnnotationSelect}
              onDelete={onAnnotationDelete}
              onEdit={handleEdit}
              projectLabelTypes={projectLabelTypes}
              projectFlags={projectFlags}
              annotationFlagMap={annotationFlagMap}
              projectGroupTypes={groupTypes}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Edit Dialog */}
      <AnnotationEditDialog
        annotation={editingAnnotation}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleEditSave}
        projectLabelTypes={projectLabelTypes}
        projectLabels={projectLabels}
        groupTypes={groupTypes}
        projectFlags={projectFlags}
        annotationFlagIds={editingAnnotation ? (annotationFlagMap[editingAnnotation.id] || []) : []}
        projectVariables={projectVariables}
        annotationVariableValues={editingAnnotation ? (annotationVariableValueMap[editingAnnotation.id] || {}) : {}}
        portalContainer={portalContainer}
      />
    </div>
  );
}
