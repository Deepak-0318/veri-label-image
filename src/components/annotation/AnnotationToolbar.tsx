import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  MousePointer2, 
  Square, 
  Pentagon, 
  Highlighter,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Frame,
  Scissors,
  Maximize2,
  Minimize2,
  Focus,
  ArrowDownToLine,
  ArrowRightToLine,
  ArrowUpFromLine
} from "lucide-react";
import { AnnotationTool } from "@/types/annotation";
import { cn } from "@/lib/utils";

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  isTextFile?: boolean;
  isMcapFile?: boolean;
  isVideoFile?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  isPointCloudFile?: boolean;
  onResetView?: () => void;
  onTopView?: () => void;
  onFrontView?: () => void;
  onSideView?: () => void;
}

const tools: { id: AnnotationTool; icon: typeof MousePointer2; label: string; imageOnly?: boolean; textOnly?: boolean; mcapOnly?: boolean; videoOnly?: boolean }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'boundingBox', icon: Square, label: 'Bounding Box', imageOnly: true },
  { id: 'polygon', icon: Pentagon, label: 'Polygon', imageOnly: true },
  { id: 'textHighlight', icon: Highlighter, label: 'Text Highlight', textOnly: true },
  { id: 'frameLabel', icon: Frame, label: 'Frame Label', mcapOnly: true },
  { id: 'videoSegment', icon: Scissors, label: 'Video Segment', videoOnly: true },
];

export function AnnotationToolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  canUndo,
  canRedo,
  zoom,
  isTextFile = false,
  isMcapFile = false,
  isVideoFile = false,
  onToggleFullscreen,
  isFullscreen = false,
  isPointCloudFile = false,
  onResetView,
  onTopView,
  onFrontView,
  onSideView,
}: AnnotationToolbarProps) {
  const filteredTools = tools.filter(tool => {
    if (tool.mcapOnly && !isMcapFile) return false;
    if (tool.videoOnly && !isVideoFile && !isMcapFile) return false;
    if (isTextFile) return !tool.imageOnly && !tool.mcapOnly && !tool.videoOnly;
    return !tool.textOnly;
  });

  return (
    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1 pr-3 border-r border-border">
        {filteredTools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? "default" : "ghost"}
                size="icon"
                onClick={() => onToolChange(tool.id)}
                className={cn(
                  "h-9 w-9",
                  activeTool === tool.id && "bg-primary text-primary-foreground"
                )}
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* History Controls */}
      <div className="flex items-center gap-1 pr-3 border-r border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-9 w-9"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-9 w-9"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Zoom Controls */}
      {!isTextFile && (
        <div className="flex items-center gap-1 pr-3 border-r border-border">
          {!isPointCloudFile && (
          <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onZoomOut}
                className="h-9 w-9"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom Out</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onZoomIn}
                className="h-9 w-9"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom In</p>
            </TooltipContent>
          </Tooltip>
          </>
          )}
          {isPointCloudFile ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onResetView} className="h-9 w-9">
                    <Focus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Reset View</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onTopView} className="h-9 w-9">
                    <ArrowDownToLine className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Top View</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onFrontView} className="h-9 w-9">
                    <ArrowUpFromLine className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Front View</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onSideView} className="h-9 w-9">
                    <ArrowRightToLine className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Side View</p></TooltipContent>
              </Tooltip>
            </>
          ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onResetZoom}
                className="h-9 w-9"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset Zoom</p>
            </TooltipContent>
          </Tooltip>
          )}
          {onToggleFullscreen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleFullscreen}
                  className="h-9 w-9"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

    </div>
  );
}
