import { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { AnnotationTool, Annotation, BoundingBoxAnnotation, PolygonAnnotation, Point, TagColor } from "@/types/annotation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnnotationCanvasProps {
  imageSrc?: string;
  annotations: Annotation[];
  activeTool: AnnotationTool;
  selectedAnnotation: string | null;
  activeLabel: string;
  activeColor: TagColor;
  zoom: number;
  frameSource?: CanvasImageSource | null;
  frameSize?: { width: number; height: number } | null;
  frameVersion?: number;
  onAnnotationCreate: (annotation: Annotation) => void;
  onAnnotationSelect: (id: string | null) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
  onAnnotationDelete?: (id: string) => void;
  fitToContainer?: boolean;
  onZoomChange?: (updater: (z: number) => number) => void;
}

const colorMap: Record<TagColor, string> = {
  blue: 'hsl(217, 91%, 60%)',
  green: 'hsl(142, 71%, 45%)',
  yellow: 'hsl(45, 93%, 47%)',
  purple: 'hsl(271, 91%, 65%)',
  pink: 'hsl(330, 81%, 60%)',
  orange: 'hsl(24, 95%, 53%)',
  cyan: 'hsl(186, 91%, 50%)',
  red: 'hsl(0, 84%, 60%)',
};

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_SIZE = 8;

function getHandleRects(x: number, y: number, w: number, h: number): Record<ResizeHandle, { x: number; y: number; w: number; h: number }> {
  const hs = HANDLE_SIZE;
  return {
    nw: { x: x - hs / 2, y: y - hs / 2, w: hs, h: hs },
    n:  { x: x + w / 2 - hs / 2, y: y - hs / 2, w: hs, h: hs },
    ne: { x: x + w - hs / 2, y: y - hs / 2, w: hs, h: hs },
    e:  { x: x + w - hs / 2, y: y + h / 2 - hs / 2, w: hs, h: hs },
    se: { x: x + w - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    s:  { x: x + w / 2 - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    sw: { x: x - hs / 2, y: y + h - hs / 2, w: hs, h: hs },
    w:  { x: x - hs / 2, y: y + h / 2 - hs / 2, w: hs, h: hs },
  };
}

function hitTestHandles(point: Point, x: number, y: number, w: number, h: number): ResizeHandle | null {
  const handles = getHandleRects(x, y, w, h);
  for (const [key, r] of Object.entries(handles)) {
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) {
      return key as ResizeHandle;
    }
  }
  return null;
}

function getHandleCursor(handle: ResizeHandle): string {
  const map: Record<ResizeHandle, string> = {
    nw: 'nwse-resize', ne: 'nesw-resize', se: 'nwse-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  };
  return map[handle];
}

function computeResizedRect(
  orig: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
) {
  let { x: nx, y: ny, width: nw, height: nh } = orig;
  if (handle.includes('w')) { nx += dx; nw -= dx; }
  if (handle.includes('e')) { nw += dx; }
  if (handle.includes('n')) { ny += dy; nh -= dy; }
  if (handle.includes('s')) { nh += dy; }
  if (nw < 5) { nx = nx + nw - 5; nw = 5; }
  if (nh < 5) { ny = ny + nh - 5; nh = 5; }
  return { x: nx, y: ny, width: nw, height: nh };
}

export function AnnotationCanvas({
  imageSrc,
  annotations,
  activeTool,
  selectedAnnotation,
  activeLabel,
  activeColor,
  zoom,
  frameSource,
  frameSize,
  frameVersion,
  onAnnotationCreate,
  onAnnotationSelect,
  onAnnotationUpdate,
  onAnnotationDelete,
  fitToContainer = false,
  onZoomChange,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<string>('');

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const innerRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{
    active: boolean;
    pending: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    deselectId: string | null;
  }>({ active: false, pending: false, startX: 0, startY: 0, origX: 0, origY: 0, deselectId: null });
  const pendingZoomRef = useRef<{ fx: number; fy: number; clientX: number; clientY: number } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgReadyRef = useRef(false);

  const interactionRef = useRef<{
    mode: 'none' | 'moving' | 'resizing' | 'movingPolygon' | 'resizingVertex';
    handle: ResizeHandle | null;
    dragStart: Point | null;
    original: { x: number; y: number; width: number; height: number } | null;
    current: { x: number; y: number; width: number; height: number } | null;
    originalPoints?: Point[] | null;
    currentPoints?: Point[] | null;
    vertexIndex?: number | null;
  }>({ mode: 'none', handle: null, dragStart: null, original: null, current: null, originalPoints: null, currentPoints: null, vertexIndex: null });

  const rafRef = useRef<number | null>(null);
  const pendingSrcRef = useRef<string>('');
  const [imageSwapCount, setImageSwapCount] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerSize({ width: el.clientWidth, height: el.clientHeight });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frameSource || !frameSize?.width || !frameSize?.height) return;

    pendingSrcRef.current = '';
    imgRef.current = null;
    imgReadyRef.current = false;
    setImageError(false);

    if (canvas.width !== frameSize.width || canvas.height !== frameSize.height) {
      canvas.width = frameSize.width;
      canvas.height = frameSize.height;
    }

    setImageSize({ width: frameSize.width, height: frameSize.height });
    setImageLoaded(true);
  }, [frameSource, frameSize?.width, frameSize?.height, frameVersion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frameSource || !imageSrc) return;

    if (pendingSrcRef.current === imageSrc && imgReadyRef.current) return;
    pendingSrcRef.current = imageSrc;

    setImageError(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (pendingSrcRef.current !== imageSrc) return;

      imgRef.current = img;
      imgReadyRef.current = true;

      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      console.log("IMAGE NATURAL", {
        width: img.naturalWidth,
        height: img.naturalHeight,
      });

      console.log("CANVAS", {
        width: canvas.width,
        height: canvas.height,
      });

      setImageSize({ width: img.width, height: img.height });
      setImageLoaded(true);
      setImageSwapCount(c => c + 1);
    };
    img.onerror = () => {
      if (pendingSrcRef.current !== imageSrc) return;
      setImageError(true);
    };
    img.src = imageSrc;
  }, [imageSrc, frameSource]);

  const redrawImmediate = useCallback(() => {
    const canvas = canvasRef.current;
    const source = frameSource ?? (imgReadyRef.current ? imgRef.current : null);
    if (!canvas || !source) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const interaction = interactionRef.current;
    console.log(
      "CANVAS SIZE",
      canvas.width,
      canvas.height
    );

    annotations.forEach((annotation) => {
      const isSelected = annotation.id === selectedAnnotation;
      console.log("ANNOTATION", annotation);
      console.log("ANNOTATION COLOR", annotation.color);
      console.log("COLORMAP VALUE", colorMap[annotation.color]);
      const color =annotation.color?.startsWith("#") ? activeColor : colorMap[activeColor as TagColor] || "hsl(160, 80%, 45%)";

      const drawingData = annotation.type === 'boundingBox'
        ? {
            x: annotation.x,
            y: annotation.y,
            width: annotation.width,
            height: annotation.height,
            type: annotation.type,
            annotation,
          }
        : {
            type: annotation.type,
            annotation,
          };
      console.log("DRAWING", drawingData);

      if (annotation.type === 'boundingBox') {
        console.log(
          "DRAWING",
          annotation.id,
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );

        console.log("FULL ANNOTATION",JSON.stringify(annotation, null, 2));

        let ax = annotation.x, ay = annotation.y, aw = annotation.width, ah = annotation.height;
        if (isSelected && interaction.mode !== 'none' && interaction.current) {
          ax = interaction.current.x;
          ay = interaction.current.y;
          aw = interaction.current.width;
          ah = interaction.current.height;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.setLineDash(isSelected ? [5, 5] : []);
        console.log(
          "CANVAS",
          canvas.width,
          canvas.height
        );

        console.log(
          "RECT",
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
        console.log("ANNOTATION", annotation);
        console.log("COLOR", color);
        const safeColor = color || "hsl(160, 80%, 45%)";

        ctx.fillStyle = safeColor
        .replace(")", ", 0.15)")
        .replace("hsl", "hsla");
        ctx.fillRect(ax, ay, aw, ah);

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        ctx.strokeRect(ax,ay,aw,ah);

        if (isSelected) {
          const handles = getHandleRects(ax, ay, aw, ah);
          ctx.setLineDash([]);
          for (const r of Object.values(handles)) {
            const safeColor = color || "hsl(160, 80%, 45%)";

            ctx.fillStyle = safeColor
              .replace(")", ", 0.15)")
              .replace("hsl", "hsla");
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = color;
            ctx.lineWidth = 8;
            ctx.strokeStyle = "red";
            ctx.strokeRect(r.x, r.y, r.w, r.h);
          }
        }
      } else if (annotation.type === 'polygon') {
        let pts = annotation.points;
        if (isSelected && interaction.mode !== 'none' && interaction.currentPoints) {
          pts = interaction.currentPoints;
        }
        if (pts.length > 0) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          pts.forEach((point, i) => {
            if (i > 0) ctx.lineTo(point.x, point.y);
          });
          ctx.closePath();
          ctx.strokeStyle = color;
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.setLineDash(isSelected ? [5, 5] : []);
          ctx.stroke();
          const safeColor = color || "hsl(160, 80%, 45%)";
          ctx.fillStyle = safeColor.replace(')', ', 0.15)').replace('hsl', 'hsla');
          ctx.fill();
          ctx.setLineDash([]);
          pts.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, isSelected ? 6 : 4, 0, Math.PI * 2);
            if (isSelected) {
              ctx.fillStyle = 'hsl(0, 0%, 100%)';
              ctx.fill();
              ctx.strokeStyle = color;
              ctx.lineWidth = 2;
              ctx.stroke();
            } else {
              ctx.fillStyle = color;
              ctx.fill();
            }
          });
        }
      }
    });

    ctx.setLineDash([]);
    if (isDrawing && activeTool === 'boundingBox' && startPoint && currentPoint) {
      const color =activeColor?.startsWith("#") ? activeColor : colorMap[activeColor as TagColor] || "hsl(160, 80%, 45%)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        Math.min(startPoint.x, currentPoint.x),
        Math.min(startPoint.y, currentPoint.y),
        Math.abs(currentPoint.x - startPoint.x),
        Math.abs(currentPoint.y - startPoint.y)
      );
      ctx.fillStyle = color.replace(')', ', 0.15)').replace('hsl', 'hsla');
      ctx.fillRect(
        Math.min(startPoint.x, currentPoint.x),
        Math.min(startPoint.y, currentPoint.y),
        Math.abs(currentPoint.x - startPoint.x),
        Math.abs(currentPoint.y - startPoint.y)
      );
    }

    if (polygonPoints.length > 0 && activeTool === 'polygon') {
      const color = activeColor?.startsWith("#") ? activeColor : colorMap[activeColor as TagColor] || "hsl(160, 80%, 45%)";
      ctx.beginPath();
      ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
      polygonPoints.forEach((point, i) => {
        if (i > 0) ctx.lineTo(point.x, point.y);
      });
      if (currentPoint) ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      polygonPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }
  }, [annotations, selectedAnnotation, isDrawing, startPoint, currentPoint, polygonPoints, activeTool, activeColor, imageLoaded, imageSwapCount, frameSource, frameVersion]);

  useEffect(() => {
    redrawImmediate();
  }, [redrawImmediate]);

  const getCanvasCoordinates = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const point = getCanvasCoordinates(e);

    // Middle-mouse always pans
    if (e.button === 1) {
      e.preventDefault();
      panStateRef.current = {
        active: true, pending: false,
        startX: e.clientX, startY: e.clientY,
        origX: pan.x, origY: pan.y, deselectId: null,
      };
      setCursorStyle('grabbing');
      return;
    }

    if (activeTool === 'select') {
      if (selectedAnnotation) {
        const selAnn = annotations.find(a => a.id === selectedAnnotation);
        if (selAnn && selAnn.type === 'boundingBox') {
          const handle = hitTestHandles(point, selAnn.x, selAnn.y, selAnn.width, selAnn.height);
          if (handle) {
            interactionRef.current = {
              mode: 'resizing', handle, dragStart: point,
              original: { x: selAnn.x, y: selAnn.y, width: selAnn.width, height: selAnn.height },
              current: { x: selAnn.x, y: selAnn.y, width: selAnn.width, height: selAnn.height },
            };
            return;
          }
          if (
            point.x >= selAnn.x && point.x <= selAnn.x + selAnn.width &&
            point.y >= selAnn.y && point.y <= selAnn.y + selAnn.height
          ) {
            interactionRef.current = {
              mode: 'moving', handle: null, dragStart: point,
              original: { x: selAnn.x, y: selAnn.y, width: selAnn.width, height: selAnn.height },
              current: { x: selAnn.x, y: selAnn.y, width: selAnn.width, height: selAnn.height },
            };
            return;
          }
        }
        if (selAnn && selAnn.type === 'polygon') {
          // vertex hit-test
          const vIdx = selAnn.points.findIndex(p => {
            const dx = p.x - point.x; const dy = p.y - point.y;
            return dx * dx + dy * dy <= 64; // 8px radius
          });
          if (vIdx >= 0) {
            interactionRef.current = {
              mode: 'resizingVertex', handle: null, dragStart: point,
              original: null, current: null,
              originalPoints: selAnn.points.map(p => ({ ...p })),
              currentPoints: selAnn.points.map(p => ({ ...p })),
              vertexIndex: vIdx,
            };
            return;
          }
          if (isPointInPolygon(point, selAnn.points)) {
            interactionRef.current = {
              mode: 'movingPolygon', handle: null, dragStart: point,
              original: null, current: null,
              originalPoints: selAnn.points.map(p => ({ ...p })),
              currentPoints: selAnn.points.map(p => ({ ...p })),
              vertexIndex: null,
            };
            return;
          }
        }
      }

      const clicked = annotations.find((ann) => {
        if (ann.type === 'boundingBox') {
          return point.x >= ann.x && point.x <= ann.x + ann.width &&
                 point.y >= ann.y && point.y <= ann.y + ann.height;
        } else if (ann.type === 'polygon') {
          return isPointInPolygon(point, ann.points);
        }
        return false;
      });
      if (clicked) {
        onAnnotationSelect(clicked.id);
      } else {
        // Empty-area click: arm potential pan; commit deselect on mouseup if no drag
        panStateRef.current = {
          active: false, pending: true,
          startX: e.clientX, startY: e.clientY,
          origX: pan.x, origY: pan.y,
          deselectId: selectedAnnotation,
        };
      }
      return;
    }

    if (activeTool === 'boundingBox') {
      setIsDrawing(true);
      setStartPoint(point);
    } else if (activeTool === 'polygon') {
      if (polygonPoints.length >= 3) {
        const firstPoint = polygonPoints[0];
        const distance = Math.sqrt(
          Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.y - firstPoint.y, 2)
        );
        if (distance < 15) {
          onAnnotationCreate({
            id: crypto.randomUUID(), type: 'polygon',
            points: [...polygonPoints], label: activeLabel, color: activeColor,
          } as PolygonAnnotation);
          setPolygonPoints([]);
          return;
        }
      }
      setPolygonPoints([...polygonPoints, point]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const ps = panStateRef.current;
    if (ps.active || ps.pending) {
      const dx = e.clientX - ps.startX;
      const dy = e.clientY - ps.startY;
      if (ps.pending && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        ps.active = true;
        ps.pending = false;
        setCursorStyle('grabbing');
      }
      if (ps.active) {
        setPan({ x: ps.origX + dx, y: ps.origY + dy });
        return;
      }
    }
    const point = getCanvasCoordinates(e);
    const interaction = interactionRef.current;

    if (interaction.mode !== 'none' && interaction.dragStart) {
      const dx = point.x - interaction.dragStart.x;
      const dy = point.y - interaction.dragStart.y;

      if (interaction.mode === 'moving' && interaction.original) {
        interaction.current = {
          x: interaction.original.x + dx,
          y: interaction.original.y + dy,
          width: interaction.original.width,
          height: interaction.original.height,
        };
        setCursorStyle('move');
      } else if (interaction.mode === 'resizing' && interaction.handle && interaction.original) {
        interaction.current = computeResizedRect(interaction.original, interaction.handle, dx, dy);
        setCursorStyle(getHandleCursor(interaction.handle));
      } else if (interaction.mode === 'movingPolygon' && interaction.originalPoints) {
        interaction.currentPoints = interaction.originalPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
        setCursorStyle('move');
      } else if (interaction.mode === 'resizingVertex' && interaction.originalPoints && interaction.vertexIndex != null) {
        interaction.currentPoints = interaction.originalPoints.map((p, i) =>
          i === interaction.vertexIndex ? { x: p.x + dx, y: p.y + dy } : { ...p }
        );
        setCursorStyle('nwse-resize');
      }

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          redrawImmediate();
        });
      }
      return;
    }

    setCurrentPoint(point);

    if (activeTool === 'select' && selectedAnnotation) {
      const selAnn = annotations.find(a => a.id === selectedAnnotation);
      if (selAnn && selAnn.type === 'boundingBox') {
        const handle = hitTestHandles(point, selAnn.x, selAnn.y, selAnn.width, selAnn.height);
        if (handle) {
          setCursorStyle(getHandleCursor(handle));
        } else if (
          point.x >= selAnn.x && point.x <= selAnn.x + selAnn.width &&
          point.y >= selAnn.y && point.y <= selAnn.y + selAnn.height
        ) {
          setCursorStyle('move');
        } else {
          setCursorStyle('');
        }
      } else {
        if (selAnn && selAnn.type === 'polygon') {
          const onVertex = selAnn.points.some(p => {
            const dx = p.x - point.x; const dy = p.y - point.y;
            return dx * dx + dy * dy <= 64;
          });
          if (onVertex) setCursorStyle('nwse-resize');
          else if (isPointInPolygon(point, selAnn.points)) setCursorStyle('move');
          else setCursorStyle('');
        } else {
          setCursorStyle('');
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const ps = panStateRef.current;
    if (ps.active) {
      ps.active = false;
      ps.pending = false;
      setCursorStyle('');
      return;
    }
    if (ps.pending) {
      // Treat as click on empty area → deselect
      ps.pending = false;
      onAnnotationSelect(null);
      return;
    }
    const interaction = interactionRef.current;

    if (interaction.mode !== 'none' && selectedAnnotation && (interaction.current || interaction.currentPoints)) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const selAnn = annotations.find(a => a.id === selectedAnnotation);
      if (selAnn && selAnn.type === 'boundingBox' && interaction.current) {
        onAnnotationUpdate({
          ...selAnn,
          x: interaction.current.x, y: interaction.current.y,
          width: interaction.current.width, height: interaction.current.height,
        } as Annotation);
      } else if (selAnn && selAnn.type === 'polygon' && interaction.currentPoints) {
        onAnnotationUpdate({
          ...selAnn,
          points: interaction.currentPoints,
        } as Annotation);
      }
      interactionRef.current = { mode: 'none', handle: null, dragStart: null, original: null, current: null, originalPoints: null, currentPoints: null, vertexIndex: null };
      setCursorStyle('');
      return;
    }

    if (activeTool === 'boundingBox' && isDrawing && startPoint) {
      const endPoint = getCanvasCoordinates(e);
      const width = Math.abs(endPoint.x - startPoint.x);
      const height = Math.abs(endPoint.y - startPoint.y);
      if (width > 5 && height > 5) {
        onAnnotationCreate({
          id: crypto.randomUUID(), type: 'boundingBox',
          x: Math.min(startPoint.x, endPoint.x),
          y: Math.min(startPoint.y, endPoint.y),
          width, height, label: activeLabel, color: activeColor,
        } as BoundingBoxAnnotation);
      }
    }
    setIsDrawing(false);
    setStartPoint(null);
  };

  const handleDoubleClick = () => {
    if (activeTool === 'polygon' && polygonPoints.length >= 3) {
      onAnnotationCreate({
        id: crypto.randomUUID(), type: 'polygon',
        points: [...polygonPoints], label: activeLabel, color: activeColor,
      } as PolygonAnnotation);
      setPolygonPoints([]);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && activeTool === 'polygon') setPolygonPoints([]);
  }, [activeTool]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset pan when zoom returns to 1
  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  useEffect(() => {
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Wheel: ctrl/pinch → zoom-at-cursor. Plain wheel/two-finger scroll → pan.
  useEffect(() => {
    if (!onZoomChange) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Wheel / trackpad scroll / pinch → zoom centered on cursor
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          pendingZoomRef.current = {
            fx: (e.clientX - rect.left) / rect.width,
            fy: (e.clientY - rect.top) / rect.height,
            clientX: e.clientX,
            clientY: e.clientY,
          };
        }
      }
      const factor = e.ctrlKey ? 0.01 : 0.0015;
      const step = -e.deltaY * factor;
      onZoomChange(z => Math.min(5, Math.max(0.1, z * (1 + step))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as EventListener);
  }, [onZoomChange, imageSize.width]);

  // After zoom changes, adjust pan so the point under cursor stays put.
  useLayoutEffect(() => {
    const pending = pendingZoomRef.current;
    if (!pending) return;
    const canvas = canvasRef.current;
    if (!canvas) { pendingZoomRef.current = null; return; }
    const rect = canvas.getBoundingClientRect();
    const projectedX = rect.left + pending.fx * rect.width;
    const projectedY = rect.top + pending.fy * rect.height;
    const dx = pending.clientX - projectedX;
    const dy = pending.clientY - projectedY;
    pendingZoomRef.current = null;
    if (dx !== 0 || dy !== 0) {
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }
  }, [zoom, imageSize.width]);

  // ── fitScale: now uses reactive containerSize, not a one-shot clientWidth ─
  const fitScale = useMemo(() => {
    if (!fitToContainer || !imageSize.width || !imageSize.height) return 1;
    const { width: cw, height: ch } = containerSize;
    const availW = cw - 32;
    const availH = ch - 32;
    if (availW <= 0 || availH <= 0) return 1;
    return Math.min(availW / imageSize.width, availH / imageSize.height);
  }, [fitToContainer, imageSize.width, imageSize.height, containerSize]);

  const effectiveZoom = fitToContainer ? fitScale * zoom : zoom;

  const deleteButtonPos = useMemo(() => {
    if (!selectedAnnotation || !onAnnotationDelete || !imageLoaded) return null;
    const ann = annotations.find(a => a.id === selectedAnnotation);
    if (!ann) return null;
    if (ann.type === 'boundingBox') return { x: ann.x + ann.width, y: ann.y };
    if (ann.type === 'polygon' && ann.points.length > 0) {
      return { x: Math.max(...ann.points.map(p => p.x)), y: Math.min(...ann.points.map(p => p.y)) };
    }
    return null;
  }, [selectedAnnotation, annotations, onAnnotationDelete, imageLoaded]);

  const canvasCursor = useMemo(() => {
    if (panStateRef.current.active) return 'grabbing';
    if (zoom > 1 && activeTool === 'select') return 'grab';
    if (cursorStyle && activeTool === 'select') return cursorStyle;
    if (activeTool === 'select') return 'pointer';
    return 'crosshair';
  }, [activeTool, cursorStyle, zoom]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-auto bg-secondary/30 rounded-lg flex-1",
        fitToContainer && "flex items-center justify-center"
      )}
      style={fitToContainer ? undefined : { maxHeight: 'calc(100vh - 280px)' }}
    >
      <div
        ref={innerRef}
        className={cn("inline-block p-4 relative", !fitToContainer && "min-w-full min-h-full")}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveZoom})`,
          transformOrigin: fitToContainer ? 'center center' : 'top left',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => { if (panStateRef.current.active) handleMouseUp(e); }}
          onContextMenu={(e) => { if (panStateRef.current.active) e.preventDefault(); }}
          onDoubleClick={handleDoubleClick}
          className="rounded-lg shadow-lg"
          style={{ display: 'block', cursor: canvasCursor }}
        />
        {deleteButtonPos && imageLoaded && (
          <button
            onClick={(e) => { e.stopPropagation(); onAnnotationDelete!(selectedAnnotation!); }}
            className="absolute z-10 flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 transition-colors"
            style={{ left: `${deleteButtonPos.x + 16}px`, top: `${deleteButtonPos.y + 16 - 10}px` }}
            title="Delete annotation"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {!imageLoaded && !imageError && (
          <div className="flex items-center justify-center h-96 text-muted-foreground" />
        )}
        {imageError && (
          <div className="flex items-center justify-center h-96 text-destructive">
            Failed to load frame image. The data may be corrupt or in an unsupported format.
          </div>
        )}
      </div>
    </div>
  );
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}
