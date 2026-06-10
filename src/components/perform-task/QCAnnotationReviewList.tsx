import { useState, useEffect, useRef } from "react";
import { Annotation, TagColor, BoundingBoxAnnotation, FrameLabelAnnotation, PolygonAnnotation } from "@/types/annotation";
import { ProjectLabelType } from "@/hooks/useProjectLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  CheckCircle2,
  Wrench,
  RotateCcw,
  Trash2,
  Square,
  Pentagon,
  Highlighter,
  TableProperties,
  Video,
  Frame,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export type QCAction = "approved" | "rework";

interface QCAnnotationReviewListProps {
  annotations: Annotation[];
  onAccept: (id: string, comment?: string) => void;
  onRework: (id: string, comment: string) => void;
  onDelete: (id: string) => void;
  onRectify: (annotation: Annotation) => void;
  onCommentUpdate: (id: string, comment: string) => void;
  selectedAnnotation: string | null;
  onSelect: (id: string | null) => void;
  projectLabelTypes?: ProjectLabelType[];
}

const colorMap: Record<TagColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  cyan: "bg-cyan-500",
  red: "bg-red-500",
};

const qcStatusConfig: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  rework: { label: "Rework", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
};

function getIcon(type: Annotation["type"]) {
  switch (type) {
    case "boundingBox": return Square;
    case "polygon": return Pentagon;
    case "textHighlight": return Highlighter;
    case "rowAnnotation": return TableProperties;
    
    case "frameLabel": return Frame;
    default: return Square;
  }
}

function getTypeLabel(type: Annotation["type"]) {
  switch (type) {
    case "boundingBox": return "Bounding Box";
    case "polygon": return "Polygon";
    case "textHighlight": return "Text Highlight";
    case "rowAnnotation": return "Row Annotation";
    
    case "frameLabel": return "Frame";
    default: return type;
  }
}


function getHoverInfo(annotation: Annotation, projectLabelTypes: { id: string; name: string }[] = []): { channel?: string; time?: string; bbox?: string; points?: number; labelType?: string } | null {
  const base: { channel?: string; time?: string; bbox?: string; points?: number; labelType?: string } = {};
  const ltName = annotation.labelTypeName || (annotation.labelTypeId ? projectLabelTypes.find(lt => lt.id === annotation.labelTypeId)?.name : undefined);
  if (ltName) base.labelType = ltName;

  if (annotation.type === 'frameLabel') {
    const a = annotation as FrameLabelAnnotation;
    return { ...base, channel: a.topicName, time: `Frame ${a.frameIndex} \u00b7 t=${a.timestamp.toFixed(3)}s` };
  }
  if (annotation.type === 'boundingBox') {
    const a = annotation as BoundingBoxAnnotation;
    if (a.topicName && a.frameIndex !== undefined && a.timestamp !== undefined) {
      return { ...base, channel: a.topicName, time: `Frame ${a.frameIndex} \u00b7 t=${a.timestamp.toFixed(3)}s`, bbox: `x:${Math.round(a.x)} y:${Math.round(a.y)} w:${Math.round(a.width)} h:${Math.round(a.height)}` };
    }
  }
  if (annotation.type === 'polygon') {
    const a = annotation as PolygonAnnotation;
    if (a.topicName && a.frameIndex !== undefined && a.timestamp !== undefined) {
      return { ...base, channel: a.topicName, time: `Frame ${a.frameIndex} \u00b7 t=${a.timestamp.toFixed(3)}s`, points: a.points.length };
    }
  }
  return Object.keys(base).length > 0 ? base : null;
}

export function QCAnnotationReviewList({
  annotations,
  onAccept,
  onRework,
  onDelete,
  onRectify,
  onCommentUpdate,
  selectedAnnotation,
  onSelect,
  projectLabelTypes = [],
}: QCAnnotationReviewListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!selectedAnnotation) return;
    const el = itemRefs.current.get(selectedAnnotation);
    if (!el) return;
    let p: HTMLElement | null = el.parentElement;
    let scrollParent: HTMLElement | null = null;
    while (p) {
      const style = getComputedStyle(p);
      if (/(auto|scroll|overlay)/.test(style.overflowY)) { scrollParent = p; break; }
      p = p.parentElement;
    }
    if (scrollParent) {
      const elRect = el.getBoundingClientRect();
      const parentRect = scrollParent.getBoundingClientRect();
      const offset = (elRect.top - parentRect.top) - (parentRect.height / 2 - elRect.height / 2);
      scrollParent.scrollTo({ top: scrollParent.scrollTop + offset, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedAnnotation]);

  useEffect(() => {
    const handler = () => setPortalContainer(document.fullscreenElement as HTMLElement | null);
    document.addEventListener("fullscreenchange", handler);
    setPortalContainer(document.fullscreenElement as HTMLElement | null);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (annotations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No annotations to review.
      </div>
    );
  }

  const reviewed = annotations.filter(a => (a as any).qc_status && (a as any).qc_status !== "pending").length;

  return (
    <div className="space-y-1">
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {reviewed}/{annotations.length} reviewed
      </div>
      {annotations.map((annotation) => {
        const Icon = getIcon(annotation.type);
        const isSelected = annotation.id === selectedAnnotation;
        const isExpanded = expandedId === annotation.id;
        const qcStatus = (annotation as any).qc_status || "pending";
        const qcComment = (annotation as any).qc_comment || "";
        const statusCfg = qcStatusConfig[qcStatus] || qcStatusConfig.pending;
        const draft = commentDrafts[annotation.id] ?? qcComment;
        const hoverInfo = getHoverInfo(annotation, projectLabelTypes);

        const itemContent = (
          <div
            key={annotation.id}
            className="px-2"
            ref={(el) => {
              if (el) itemRefs.current.set(annotation.id, el);
              else itemRefs.current.delete(annotation.id);
            }}
          >
            <div
              onClick={() => {
                onSelect(annotation.id);
                setExpandedId(isExpanded ? null : annotation.id);
              }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-secondary/50 hover:bg-secondary border border-transparent"
              )}
            >
              <div className={cn("w-3 h-3 rounded-full shrink-0", colorMap[annotation.color])} />
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{annotation.label}</p>
                <p className="text-xs text-muted-foreground">{getTypeLabel(annotation.type)}</p>
              </div>
              <Badge variant="outline" className={cn("text-[10px] shrink-0", statusCfg.className)}>
                {statusCfg.label}
              </Badge>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </div>

            {isExpanded && (
              <div className="ml-4 mr-2 mt-1 mb-2 p-3 rounded-lg bg-card border border-border space-y-3">
                {/* Comment */}
                {annotation.comment && (
                  <div className="text-xs">
                    <span className="font-medium text-muted-foreground">Annotator note: </span>
                    <span>{annotation.comment}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    <MessageSquare className="h-3 w-3 inline mr-1" />
                    QC Comment
                  </label>
                  <Textarea
                    value={draft}
                    onChange={(e) =>
                      setCommentDrafts((prev) => ({ ...prev, [annotation.id]: e.target.value }))
                    }
                    onBlur={() => {
                      if (draft !== qcComment) {
                        onCommentUpdate(annotation.id, draft);
                      }
                    }}
                    placeholder="Add review comment..."
                    className="min-h-[60px] text-xs"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant={qcStatus === "approved" ? "default" : "outline"}
                    className="gap-1 text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept(annotation.id, draft || undefined);
                    }}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRectify(annotation);
                    }}
                  >
                    <Wrench className="h-3 w-3" />
                    Rectify
                  </Button>
                  <Button
                    size="sm"
                    variant={qcStatus === "rework" ? "secondary" : "outline"}
                    className="gap-1 text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!draft) return;
                      onRework(annotation.id, draft);
                    }}
                    disabled={!draft}
                    title={!draft ? "Add a comment before requesting rework" : ""}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Rework
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-xs h-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(annotation.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

        return hoverInfo ? (
          <HoverCard key={annotation.id} openDelay={300}>
            <HoverCardTrigger asChild>
              {itemContent}
            </HoverCardTrigger>
            <HoverCardContent side="left" className="w-72 text-xs space-y-1.5">
              <p className="font-medium text-sm">{annotation.label}</p>
              <div className="space-y-1 text-muted-foreground">
                {hoverInfo.labelType && <p><span className="font-medium text-foreground">Label Type:</span> {hoverInfo.labelType}</p>}
                {hoverInfo.channel && <p><span className="font-medium text-foreground">Channel:</span> <span className="font-mono">{hoverInfo.channel}</span></p>}
                {hoverInfo.time && <p><span className="font-medium text-foreground">Time:</span> {hoverInfo.time}</p>}
                {hoverInfo.bbox && <p><span className="font-medium text-foreground">BBox:</span> <span className="font-mono">{hoverInfo.bbox}</span></p>}
                {hoverInfo.points !== undefined && <p><span className="font-medium text-foreground">Points:</span> {hoverInfo.points}</p>}
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <div key={annotation.id}>
            {itemContent}
          </div>
        );
      })}

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent container={portalContainer}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete annotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the annotation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) onDelete(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
