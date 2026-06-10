import { useEffect, useRef, useState } from "react";
import { Annotation, TagColor, BoundingBoxAnnotation, FrameLabelAnnotation, PolygonAnnotation, VideoSegmentAnnotation } from "@/types/annotation";
import { ProjectLabelType } from "@/hooks/useProjectLabels";
import { ProjectFlag } from "@/hooks/useProjectFlags";
import { Button } from "@/components/ui/button";
import { Trash2, Square, Pentagon, Highlighter, Edit2, TableProperties, MessageSquare, Frame, AlertTriangle, Flag, Scissors, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface AnnotationListProps {
  annotations: Annotation[];
  selectedAnnotation: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onEdit: (annotation: Annotation) => void;
  projectLabelTypes?: ProjectLabelType[];
  projectFlags?: ProjectFlag[];
  annotationFlagMap?: Record<string, string[]>;
  projectGroupTypes?: { id: string; name: string }[];
}

const colorMap: Record<TagColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
  cyan: 'bg-cyan-500',
  red: 'bg-red-500',
};

function getIcon(type: Annotation['type']) {
  switch (type) {
    case 'boundingBox': return Square;
    case 'polygon': return Pentagon;
    case 'textHighlight': return Highlighter;
    case 'rowAnnotation': return TableProperties;
    case 'frameLabel': return Frame;
    case 'videoSegment': return Scissors;
    case 'boundingBox3d': return Box;
    default: return Square;
  }
}

function getHoverInfo(annotation: Annotation, projectLabelTypes: { id: string; name: string }[] = [], projectGroupTypes: { id: string; name: string }[] = []): { channel?: string; time?: string; bbox?: string; points?: number; labelType?: string; groupType?: string } | null {
  const base: { channel?: string; time?: string; bbox?: string; points?: number; labelType?: string; groupType?: string } = {};
  const ltName = annotation.labelTypeName || (annotation.labelTypeId ? projectLabelTypes.find(lt => lt.id === annotation.labelTypeId)?.name : undefined);
  if (ltName) base.labelType = ltName;
  const gtName = annotation.groupTypeName || (annotation.groupTypeId ? projectGroupTypes.find(gt => gt.id === annotation.groupTypeId)?.name : undefined);
  if (gtName) base.groupType = gtName;

  if (annotation.type === 'frameLabel') {
    const a = annotation as FrameLabelAnnotation;
    return { ...base, channel: a.topicName, time: `Frame ${a.frameIndex} · t=${a.timestamp.toFixed(3)}s` };
  }
  if (annotation.type === 'videoSegment') {
    const a = annotation as VideoSegmentAnnotation;
    return { ...base, channel: a.topicName, time: `${a.startTime.toFixed(2)}s → ${a.endTime.toFixed(2)}s` };
  }
  if (annotation.type === 'boundingBox') {
    const a = annotation as BoundingBoxAnnotation;
    if (a.topicName && a.frameIndex !== undefined && a.timestamp !== undefined) {
      return { ...base, channel: a.topicName, time: `Frame ${a.frameIndex} · t=${a.timestamp.toFixed(3)}s`, bbox: `x:${Math.round(a.x)} y:${Math.round(a.y)} w:${Math.round(a.width)} h:${Math.round(a.height)}` };
    }
  }
  if (annotation.type === 'polygon') {
    const a = annotation as PolygonAnnotation;
    if (a.topicName && a.frameIndex !== undefined && a.timestamp !== undefined) {
      return { ...base, channel: a.topicName, time: `Frame ${a.frameIndex} · t=${a.timestamp.toFixed(3)}s`, points: a.points.length };
    }
  }
  // Return base if it has labelType info
  return Object.keys(base).length > 0 ? base : null;
}

export function AnnotationList({
  annotations,
  selectedAnnotation,
  onSelect,
  onDelete,
  onEdit,
  projectLabelTypes = [],
  projectFlags = [],
  annotationFlagMap = {},
  projectGroupTypes = [],
}: AnnotationListProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const handler = () => {
      setPortalContainer(document.fullscreenElement as HTMLElement | null);
    };
    document.addEventListener("fullscreenchange", handler);
    setPortalContainer(document.fullscreenElement as HTMLElement | null);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (selectedAnnotation) {
      const el = itemRefs.current.get(selectedAnnotation);
      if (el) {
        // Scroll within the nearest scrollable ancestor only, avoiding page scroll
        const scrollParent = (() => {
          let p: HTMLElement | null = el.parentElement;
          while (p) {
            const style = getComputedStyle(p);
            if (/(auto|scroll|overlay)/.test(style.overflowY)) return p;
            p = p.parentElement;
          }
          return null;
        })();
        if (scrollParent) {
          const elRect = el.getBoundingClientRect();
          const parentRect = scrollParent.getBoundingClientRect();
          const offset = (elRect.top - parentRect.top) - (parentRect.height / 2 - elRect.height / 2);
          scrollParent.scrollTo({ top: scrollParent.scrollTop + offset, behavior: "smooth" });
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, [selectedAnnotation]);

  if (annotations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No annotations yet. Use the tools above to start annotating.
      </div>
    );
  }

  return (
    <>
    <div className="space-y-2 p-2">
      {annotations.map((annotation) => {
        const Icon = getIcon(annotation.type);
        const isSelected = annotation.id === selectedAnnotation;
        const mcapInfo = getHoverInfo(annotation, projectLabelTypes, projectGroupTypes);

        const qcStatus = (annotation as any).qc_status;
        const qcComment = (annotation as any).qc_comment;
        const isRework = qcStatus === "rework";

        const itemContent = (
          <div
            onClick={() => onSelect(annotation.id)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
              isRework
                ? "bg-orange-500/10 border border-orange-500/30 ring-1 ring-orange-500/20"
                : isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-secondary/50 hover:bg-secondary border border-transparent"
            )}
          >
            <div className={cn("w-3 h-3 rounded-full shrink-0", colorMap[annotation.color])} />
            {isRework ? (
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
            ) : (
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{annotation.label}</p>
                {isRework && (
                  <Badge variant="outline" className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30 shrink-0">Rework</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground capitalize">
                  {annotation.type === 'boundingBox' && 'Bounding Box'}
                  {annotation.type === 'polygon' && 'Polygon'}
                  {annotation.type === 'textHighlight' && 'Text Highlight'}
                  {annotation.type === 'rowAnnotation' && 'Row Annotation'}
                  {annotation.type === 'frameLabel' && 'Frame'}
                  {annotation.type === 'videoSegment' && 'Video Segment'}
                  {annotation.type === 'boundingBox3d' && '3D Bounding Box'}
                </p>
                {annotation.comment && (
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              {/* Flag badges */}
              {(() => {
                const flagIds = annotationFlagMap[annotation.id] || [];
                const flagNames = flagIds
                  .map(fid => projectFlags.find(f => f.id === fid)?.name)
                  .filter(Boolean);
                return flagNames.length > 0 ? (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {flagNames.map((name, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5 border-muted-foreground/30">
                        <Flag className="h-2.5 w-2.5" />
                        {name}
                      </Badge>
                    ))}
                  </div>
                ) : null;
              })()}
              {isRework && qcComment && (
                <p className="text-xs text-orange-400 mt-1 line-clamp-2">{qcComment}</p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(annotation);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget({ id: annotation.id, label: annotation.label });
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );

        return mcapInfo ? (
          <HoverCard key={annotation.id} openDelay={300}>
            <HoverCardTrigger asChild>
              <div ref={(el) => { if (el) itemRefs.current.set(annotation.id, el); else itemRefs.current.delete(annotation.id); }}>
                {itemContent}
              </div>
            </HoverCardTrigger>
            <HoverCardContent side="left" className="w-72 text-xs space-y-1.5">
              <p className="font-medium text-sm">{annotation.label}</p>
              <div className="space-y-1 text-muted-foreground">
                {mcapInfo.labelType && <p><span className="font-medium text-foreground">Label Type:</span> {mcapInfo.labelType}</p>}
                {mcapInfo.groupType && <p><span className="font-medium text-foreground">Group Type:</span> {mcapInfo.groupType}</p>}
                {mcapInfo.channel && <p><span className="font-medium text-foreground">Channel:</span> <span className="font-mono">{mcapInfo.channel}</span></p>}
                {mcapInfo.time && <p><span className="font-medium text-foreground">Time:</span> {mcapInfo.time}</p>}
                {mcapInfo.bbox && <p><span className="font-medium text-foreground">BBox:</span> <span className="font-mono">{mcapInfo.bbox}</span></p>}
                {mcapInfo.points !== undefined && <p><span className="font-medium text-foreground">Points:</span> {mcapInfo.points}</p>}
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <div key={annotation.id} ref={(el) => { if (el) itemRefs.current.set(annotation.id, el); else itemRefs.current.delete(annotation.id); }}>
            {itemContent}
          </div>
        );
      })}
    </div>

    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
      <AlertDialogContent container={portalContainer}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Annotation</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the annotation "{deleteTarget?.label}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (deleteTarget) {
                try {
                  onDelete(deleteTarget.id);
                  toast.success("Annotation deleted successfully");
                } catch {
                  toast.error("Failed to delete annotation");
                }
                setDeleteTarget(null);
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
