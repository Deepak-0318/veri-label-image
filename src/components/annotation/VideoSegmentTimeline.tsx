import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { VideoSegmentAnnotation, TagColor } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const TAG_COLORS: Record<TagColor, string> = {
  blue:   'hsla(217, 91%, 60%, 0.25)',
  green:  'hsla(142, 71%, 45%, 0.25)',
  yellow: 'hsla(45,  93%, 47%, 0.25)',
  purple: 'hsla(262, 83%, 58%, 0.25)',
  pink:   'hsla(330, 81%, 60%, 0.25)',
  orange: 'hsla(25,  95%, 53%, 0.25)',
  cyan:   'hsla(188, 78%, 41%, 0.25)',
  red:    'hsla(0,   84%, 60%, 0.25)',
};

const TAG_BORDER_COLORS: Record<TagColor, string> = {
  blue:   'hsla(217, 91%, 60%, 0.8)',
  green:  'hsla(142, 71%, 45%, 0.8)',
  yellow: 'hsla(45,  93%, 47%, 0.8)',
  purple: 'hsla(262, 83%, 58%, 0.8)',
  pink:   'hsla(330, 81%, 60%, 0.8)',
  orange: 'hsla(25,  95%, 53%, 0.8)',
  cyan:   'hsla(188, 78%, 41%, 0.8)',
  red:    'hsla(0,   84%, 60%, 0.8)',
};

const TAG_COLOR_DOT: Record<TagColor, string> = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink:   'bg-pink-500',
  orange: 'bg-orange-500',
  cyan:   'bg-cyan-500',
  red:    'bg-red-500',
};

const HANDLE_PX = 6;
const MIN_REGION_S = 0.1;
const TIMELINE_HEIGHT = 32;
const LAYER_HEIGHT = 22;
const MAX_TICK_COUNT = 500;

function clampFinite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function computeLayers(segments: VideoSegmentAnnotation[]): Map<string, number> {
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
  const layers = new Map<string, number>();
  const layerEnds: number[] = [];

  for (const seg of sorted) {
    let placed = false;
    for (let l = 0; l < layerEnds.length; l++) {
      if (seg.startTime >= layerEnds[l]) {
        layers.set(seg.id, l);
        layerEnds[l] = seg.endTime;
        placed = true;
        break;
      }
    }
    if (!placed) {
      layers.set(seg.id, layerEnds.length);
      layerEnds.push(seg.endTime);
    }
  }
  return layers;
}

/** Resolve a CSS custom property to a usable color string */
function resolveColor(el: HTMLElement, varName: string, alpha?: number): string {
  const raw = getComputedStyle(el).getPropertyValue(varName).trim();
  if (!raw) return alpha !== undefined ? `rgba(128,128,128,${alpha})` : '#888';
  // raw is typically "H S% L%" from shadcn
  if (alpha !== undefined) return `hsla(${raw}, ${alpha})`;
  return `hsl(${raw})`;
}

interface VideoSegmentTimelineProps {
  duration: number;
  currentTime: number;
  segments: VideoSegmentAnnotation[];
  selectedId: string | null;
  onSeek: (t: number) => void;
  onSegmentClick: (id: string) => void;
  onSegmentDragEnd: (id: string, start: number, end: number) => void;
  onSegmentCreate: () => void;
  onSegmentDelete: (id: string) => void;
}

function TimelineCanvas({
  duration,
  currentTime,
  segments,
  selectedId,
  onSeek,
  onSegmentClick,
  onSegmentDragEnd,
}: Omit<VideoSegmentTimelineProps, 'onSegmentCreate' | 'onSegmentDelete'>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOverridesRef = useRef<Map<string, { startTime: number; endTime: number }>>(new Map());
  const [renderTick, setRenderTick] = useState(0);
  const rafRef = useRef(0);
  const safeDuration = useMemo(() => Math.max(0, clampFinite(duration)), [duration]);
  const safeCurrentTime = useMemo(() => Math.max(0, Math.min(clampFinite(currentTime), safeDuration)), [currentTime, safeDuration]);

  type DragState = {
    type: 'seek' | 'move' | 'resize-left' | 'resize-right';
    regionId?: string;
    startClientX: number;
    startTime: number;
    origStart?: number;
    origEnd?: number;
  };
  const dragRef = useRef<DragState | null>(null);

  const mergedSegments = useMemo(() => {
    // renderTick dependency forces recalc during drag
    void renderTick;
    const overrides = dragOverridesRef.current;
    return segments.map(seg => {
      const override = overrides.get(seg.id);
      const next = override ? { ...seg, ...override } : seg;
      return {
        ...next,
        startTime: Math.max(0, Math.min(clampFinite(next.startTime), safeDuration)),
        endTime: Math.max(0, Math.min(clampFinite(next.endTime), safeDuration)),
      };
    }).filter((seg) => seg.endTime > seg.startTime);
  }, [segments, safeDuration, renderTick]);

  const layerMap = useMemo(() => computeLayers(mergedSegments), [mergedSegments]);
  const maxLayer = useMemo(() => {
    let max = 0;
    layerMap.forEach(l => { if (l > max) max = l; });
    return max;
  }, [layerMap]);

  const totalHeight = TIMELINE_HEIGHT + (maxLayer + 1) * LAYER_HEIGHT;

  // Sync canvas buffer size with container — no transform here, draw() handles it
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const syncSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = totalHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    };
    syncSize();
    const ro = new ResizeObserver(() => { syncSize(); });
    ro.observe(container);
    return () => ro.disconnect();
  }, [totalHeight]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    if (W === 0 || H === 0) return;

    // Reset transform and fully clear the buffer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const timeToX = (t: number) => safeDuration > 0 ? (t / safeDuration) * W : 0;
    const playedX = timeToX(safeCurrentTime);

    // Resolve theme colors from CSS variables
    const el = canvas.parentElement || document.documentElement;
    const mutedBg = resolveColor(el, '--muted', 0.5);
    const mutedFg = resolveColor(el, '--muted-foreground', 0.4);

    // Timeline track background
    ctx.fillStyle = mutedBg;
    ctx.fillRect(0, 0, W, TIMELINE_HEIGHT);

    // Time ticks
    if (safeDuration > 0) {
      const baseTickInterval = safeDuration <= 10 ? 1 : safeDuration <= 60 ? 5 : safeDuration <= 300 ? 15 : 30;
      const tickInterval = Math.max(baseTickInterval, safeDuration / MAX_TICK_COUNT);
      ctx.fillStyle = mutedFg;
      ctx.font = '9px monospace';
      for (let t = 0; t <= safeDuration; t += tickInterval) {
        const x = timeToX(t);
        ctx.fillRect(x, TIMELINE_HEIGHT - 8, 1, 8);
        if (t > 0 && t < safeDuration) {
          ctx.fillText(formatTime(t), x + 2, TIMELINE_HEIGHT - 10);
        }
      }
    }

    // Keep header neutral; use only cursor + lane blocks for emphasis

    // Determine label text color based on theme
    const bgRaw = getComputedStyle(el).getPropertyValue('--background').trim();
    const isLightTheme = bgRaw ? parseFloat(bgRaw.split(/\s+/)[2] || '50') > 50 : false;
    const labelTextColor = isLightTheme ? '#1a1a1a' : '#ffffff';

    // Segment regions on lanes
    mergedSegments.forEach((seg) => {
      const color = (seg.color ?? 'blue') as TagColor;
      const x1 = timeToX(seg.startTime);
      const x2 = timeToX(seg.endTime);
      const isSelected = seg.id === selectedId;
      const layer = layerMap.get(seg.id) ?? 0;

      // Lane segment
      const laneY = TIMELINE_HEIGHT + layer * LAYER_HEIGHT;
      const laneH = LAYER_HEIGHT - 2;
      ctx.fillStyle = TAG_COLORS[color] ?? TAG_COLORS.blue;
      ctx.fillRect(x1, laneY, x2 - x1, laneH);

      ctx.strokeStyle = TAG_BORDER_COLORS[color] ?? TAG_BORDER_COLORS.blue;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(x1, laneY, x2 - x1, laneH);

      // Handles
      ctx.fillStyle = TAG_BORDER_COLORS[color] ?? TAG_BORDER_COLORS.blue;
      ctx.fillRect(x1, laneY, HANDLE_PX, laneH);
      ctx.fillRect(x2 - HANDLE_PX, laneY, HANDLE_PX, laneH);

      // Label text
      const labelText = seg.label || '';
      if (labelText && (x2 - x1) > 30) {
        ctx.fillStyle = labelTextColor;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(labelText, x1 + HANDLE_PX + 2, laneY + laneH / 2 + 4, x2 - x1 - HANDLE_PX * 2 - 4);
      }
    });

    ctx.globalAlpha = 1;

    // Playback cursor — hardcoded teal for visibility in both light & dark
    const cursorColor = 'hsl(174, 72%, 46%)';
    ctx.strokeStyle = cursorColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playedX, 0);
    ctx.lineTo(playedX, H);
    ctx.stroke();

    // Cursor triangle
    ctx.fillStyle = cursorColor;
    ctx.beginPath();
    ctx.moveTo(playedX - 5, 0);
    ctx.lineTo(playedX + 5, 0);
    ctx.lineTo(playedX, 8);
    ctx.closePath();
    ctx.fill();
  }, [safeDuration, safeCurrentTime, mergedSegments, selectedId, layerMap, totalHeight]);

  useEffect(() => { draw(); }, [draw]);

  const clientXToTime = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas || safeDuration === 0) return 0;
    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(safeDuration, ((clientX - rect.left) / rect.width) * safeDuration));
  }, [safeDuration]);

  type HitResult =
    | { type: 'resize-left' | 'resize-right' | 'move'; regionId: string }
    | { type: 'seek' };

  const hitTest = useCallback((clientX: number, clientY: number): HitResult => {
    const canvas = canvasRef.current;
    if (!canvas || safeDuration === 0) return { type: 'seek' };
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const W = rect.width;
    const toX = (t: number) => (t / safeDuration) * W;

    for (let i = mergedSegments.length - 1; i >= 0; i--) {
      const seg = mergedSegments[i];
      const x1 = toX(seg.startTime);
      const x2 = toX(seg.endTime);
      const layer = layerMap.get(seg.id) ?? 0;
      const laneY = TIMELINE_HEIGHT + layer * LAYER_HEIGHT;
      const laneH = LAYER_HEIGHT - 2;

      const inLane = py >= laneY && py <= laneY + laneH && px >= x1 - 2 && px <= x2 + 2;
      const inTimeline = py < TIMELINE_HEIGHT && px >= x1 && px <= x2;

      if (inLane || inTimeline) {
        const inLeft = px >= x1 - 2 && px <= x1 + HANDLE_PX + 2;
        const inRight = px >= x2 - HANDLE_PX - 2 && px <= x2 + 2;
        if (inLeft && inRight) {
          // For very small segments both handle zones overlap; pick the closer edge
          return Math.abs(px - x2) <= Math.abs(px - x1)
            ? { type: 'resize-right', regionId: seg.id }
            : { type: 'resize-left', regionId: seg.id };
        }
        if (inLeft) return { type: 'resize-left', regionId: seg.id };
        if (inRight) return { type: 'resize-right', regionId: seg.id };
        return { type: 'move', regionId: seg.id };
      }
    }
    return { type: 'seek' };
  }, [mergedSegments, safeDuration, layerMap]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (safeDuration === 0) return;
    const t = clientXToTime(e.clientX);
    const hit = hitTest(e.clientX, e.clientY);

    if (hit.type === 'seek') {
      onSeek(t);
      dragRef.current = { type: 'seek', startClientX: e.clientX, startTime: t };
      return;
    }

    const seg = mergedSegments.find(a => a.id === hit.regionId)!;
    dragRef.current = {
      type: hit.type,
      regionId: hit.regionId,
      startClientX: e.clientX,
      startTime: t,
      origStart: seg.startTime,
      origEnd: seg.endTime,
    };
    onSegmentClick(hit.regionId);
    e.stopPropagation();
  }, [safeDuration, clientXToTime, hitTest, onSeek, mergedSegments, onSegmentClick]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update cursor directly on the element to avoid React re-renders
    const canvas = canvasRef.current;
    if (canvas) {
      const hit = hitTest(e.clientX, e.clientY);
      const cur = hit.type === 'resize-left' || hit.type === 'resize-right' ? 'ew-resize'
        : hit.type === 'move' ? 'grab' : 'pointer';
      canvas.style.cursor = cur;
    }

    const drag = dragRef.current;
    if (!drag) return;

    const t = clientXToTime(e.clientX);
    const dt = t - drag.startTime;

    if (drag.type === 'seek') { onSeek(t); return; }
    if (!drag.regionId) return;

    const origStart = drag.origStart!;
    const origEnd = drag.origEnd!;
    let newStart = origStart;
    let newEnd = origEnd;

    if (drag.type === 'move') {
      const len = origEnd - origStart;
      newStart = Math.max(0, Math.min(safeDuration - len, origStart + dt));
      newEnd = newStart + len;
    } else if (drag.type === 'resize-left') {
      newStart = Math.max(0, Math.min(origEnd - MIN_REGION_S, origStart + dt));
      newEnd = origEnd;
    } else if (drag.type === 'resize-right') {
      newEnd = Math.max(origStart + MIN_REGION_S, Math.min(safeDuration, origEnd + dt));
      newStart = origStart;
    }

    dragOverridesRef.current.set(drag.regionId, { startTime: newStart, endTime: newEnd });

    // Batch redraws with rAF
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setRenderTick(t => t + 1);
      });
    }
  }, [clientXToTime, hitTest, onSeek, safeDuration]);

  const onMouseUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;

    if (!drag || drag.type === 'seek' || !drag.regionId) {
      dragOverridesRef.current.clear();
      setRenderTick(t => t + 1);
      return;
    }

    const override = dragOverridesRef.current.get(drag.regionId);
    if (override) {
      onSegmentDragEnd(drag.regionId, override.startTime, override.endTime);
    }
    dragOverridesRef.current.clear();
    setRenderTick(t => t + 1);
  }, [onSegmentDragEnd]);

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div ref={containerRef} className="w-full" style={{ height: totalHeight }}>
      <canvas
        ref={canvasRef}
        style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
    </div>
  );
}

export function VideoSegmentTimeline({
  duration,
  currentTime,
  segments,
  selectedId,
  onSeek,
  onSegmentClick,
  onSegmentDragEnd,
  onSegmentCreate,
  onSegmentDelete,
}: VideoSegmentTimelineProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setCollapsed(prev => !prev)}>
        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Video Segments ({segments.length})
        </h4>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {selectedId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onSegmentDelete(selectedId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete segment</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onSegmentCreate}>
                <Plus className="h-3.5 w-3.5" />
                New Segment
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create segment at current position</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {!collapsed && <div className="rounded-lg overflow-hidden border border-border">
        <TimelineCanvas
          duration={duration}
          currentTime={currentTime}
          segments={segments}
          selectedId={selectedId}
          onSeek={onSeek}
          onSegmentClick={onSegmentClick}
          onSegmentDragEnd={onSegmentDragEnd}
        />
      </div>}
    </div>
  );
}
