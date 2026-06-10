import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { Annotation, AnnotationTool, TagColor, FrameLabelAnnotation, BoundingBoxAnnotation, PolygonAnnotation, VideoSegmentAnnotation } from "@/types/annotation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, Loader2, Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, Frame, X } from "lucide-react";
import { VideoSegmentTimeline } from "./VideoSegmentTimeline";

const VIDEO_TOPIC = "video";
const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4];
const DEFAULT_FPS = 30;

interface VideoAnnotationViewProps {
  fileUrl: string;
  annotations: Annotation[];
  activeTool: AnnotationTool;
  selectedAnnotation: string | null;
  activeLabel: string;
  activeColor: TagColor;
  zoom: number;
  onAnnotationCreate: (annotation: Annotation) => void;
  onAnnotationSelect: (id: string | null) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
  onAnnotationDelete?: (id: string) => void;
  renderToolbar?: (ctx?: { isFullscreen: boolean; toggleFullscreen: () => void }) => React.ReactNode;
  renderSidebar?: () => React.ReactNode;
}

export function VideoAnnotationView({
  fileUrl,
  annotations,
  activeTool,
  selectedAnnotation,
  activeLabel,
  activeColor,
  zoom,
  onAnnotationCreate,
  onAnnotationSelect,
  onAnnotationUpdate,
  onAnnotationDelete,
  renderToolbar,
  renderSidebar,
}: VideoAnnotationViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFrameSize, setVideoFrameSize] = useState({ width: 0, height: 0 });
  const [videoFrameVersion, setVideoFrameVersion] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [duration, setDuration] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const currentFrameRef = useRef(0);

  const pendingSeekRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);

  const sliderRafRef = useRef<number | null>(null);

  const fpsRef = useRef(DEFAULT_FPS);
  const totalFramesRef = useRef(0);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);

  useEffect(() => { fpsRef.current = fps; }, [fps]);
  useEffect(() => { totalFramesRef.current = totalFrames; }, [totalFrames]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const frameCacheRef = useRef<Map<number, ImageBitmap>>(new Map());
  const WINDOW_SIZE = 10;
  const MAX_CONCURRENT = 3;

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const decodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const decodingRef = useRef(false);
  const canRenderFrame =
  videoRef.current &&
  videoReady &&
  videoRef.current.readyState >= 2 &&
  !videoRef.current.seeking;

  

  useEffect(() => {
    ctxRef.current = canvasRef.current.getContext("2d");
  }, []);

const lastFrameImageRef = useRef<HTMLCanvasElement | null>(null);

useEffect(() => {
  const handleVisibility = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.hidden) {
      // ✅ CAPTURE LAST FRAME BEFORE TAB FREEZE
      if (video.readyState >= 2) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          lastFrameImageRef.current = canvas;
        }
      }

      video.pause();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setIsPlaying(false);

    } else {
      const frame = currentFrameRef.current;
      const exactTime = frame / fpsRef.current;

      isSeekingRef.current = true;
      video.currentTime = exactTime;

      video.addEventListener(
        "seeked",
        () => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              isSeekingRef.current = false;
              setVideoFrameVersion((v) => v + 1);
              lastFrameImageRef.current = null;
            });
          });
        },
        { once: true }
      );
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  return () => document.removeEventListener("visibilitychange", handleVisibility);
}, []);

  async function decodeFrame(frameIndex: number): Promise<ImageBitmap> {
    const video = decodeVideoRef.current!;
    const fps = fpsRef.current;

    if (video.readyState < 2) {
      await new Promise((res) =>
        video.addEventListener("loadeddata", res, { once: true })
      );
    }
    if (frameCacheRef.current.has(frameIndex)) {
      return frameCacheRef.current.get(frameIndex)!;
    }
    while (decodingRef.current) {
      await new Promise((r) => setTimeout(r, 5));
    }

    decodingRef.current = true;
    const targetTime = frameIndex / fps;

    if (Math.abs(video.currentTime - targetTime) < 0.001) {
      const bitmap = await createImageBitmap(video);
      decodingRef.current = false;
      return bitmap;
    }

    return new Promise((resolve, reject) => {
      const onSeeked = async () => {
        try {
          video.removeEventListener("seeked", onSeeked);
          if (canvasRef.current.width !== video.videoWidth) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
          }
          const ctx = ctxRef.current!;
          ctx.drawImage(video, 0, 0);
          const bitmap = await createImageBitmap(canvasRef.current);
          decodingRef.current = false;
          resolve(bitmap);
          clearTimeout(timeout);
        } catch (err) {
          decodingRef.current = false;
          reject(err);
        }
      };

      const timeout = setTimeout(() => {
        video.removeEventListener("seeked", onSeeked);
        decodingRef.current = false;
        reject(new Error("Seek timeout"));
      }, 1000);
      video.addEventListener("seeked", onSeeked);
      video.currentTime = targetTime;
    });
  }

  async function ensureFrames(currentFrame: number) {
    const start = Math.max(0, currentFrame - WINDOW_SIZE);
    const end = Math.min(totalFramesRef.current - 1, currentFrame + WINDOW_SIZE);
    const framesToDecode: number[] = [];
    for (let i = start; i <= end; i++) {
      if (!frameCacheRef.current.has(i)) framesToDecode.push(i);
    }
    for (let i = 0; i < framesToDecode.length; i += MAX_CONCURRENT) {
      const batch = framesToDecode.slice(i, i + MAX_CONCURRENT);
      await Promise.all(
        batch.map((idx) =>
          decodeFrame(idx).then((frame) => {
            frameCacheRef.current.set(idx, frame);
          })
        )
      );
    }
  }

  function cleanupCache(currentFrame: number) {
    for (const key of frameCacheRef.current.keys()) {
      if (Math.abs(key - currentFrame) > WINDOW_SIZE) {
        const frame = frameCacheRef.current.get(key);
        frame?.close?.();
        frameCacheRef.current.delete(key);
      }
    }
  }
  

  useEffect(() => {
    if (isPlaying) return;
    let cancelled = false;
    (async () => {
      await ensureFrames(currentFrameIndex);
      if (!cancelled) cleanupCache(currentFrameIndex);
    })();
    return () => { cancelled = true; };
  }, [currentFrameIndex, isPlaying]);

  useEffect(() => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    videoRef.current = video;

    const decodeVideo = document.createElement("video");
    decodeVideo.preload = "auto";
    decodeVideo.muted = true;
    decodeVideo.src = fileUrl;
    decodeVideoRef.current = decodeVideo;
    decodeVideo.addEventListener("loadedmetadata", () => {
      decodeVideo.currentTime = 0;
    });

    const updateRenderableFrame = () => {
      if (video.videoWidth && video.videoHeight) {
        setVideoFrameSize({ width: video.videoWidth, height: video.videoHeight });
      }
      if (video.readyState >= 2) {
        setVideoReady(true);
        setVideoFrameVersion((prev) => prev + 1);
      }
    };

    const handleLoadedMetadata = () => {
      const dur = video.duration;
      setDuration(dur);
      durationRef.current = dur;
      const estimatedFps = DEFAULT_FPS;
      setFps(estimatedFps);
      fpsRef.current = estimatedFps;
      const frames = Math.ceil(dur * estimatedFps);
      setTotalFrames(frames);
      totalFramesRef.current = frames;
      setVideoFrameSize({ width: video.videoWidth, height: video.videoHeight });
      setLoading(false);
      video.currentTime = 0;
    };

    const handleSeeked = () => {
       if (document.hidden) return; //
     const pending = pendingSeekRef.current;
     pendingSeekRef.current = null;
     isSeekingRef.current = false; // unlock before next seek
     if (pending !== null) {
       doSeekVideo(pending); // skip rendering stale frame, jump straight to latest
     } else {
       setVideoFrameVersion((prev) => prev + 1);
       updateRenderableFrame();
     }
   };

    const handleTimeUpdate = () => {
      if (!isPlayingRef.current) {
        setVideoFrameVersion((prev) => prev + 1);
      }
    };

    const handleCanPlay = () => updateRenderableFrame();
    const handlePlaying = () => setVideoReady(true);
    const handleError = () => {
      setError("Failed to load video file. The format may not be supported by your browser.");
      setLoading(false);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleCanPlay);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("error", handleError);

    video.src = fileUrl;

    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleCanPlay);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", handleError);
      video.removeAttribute("src");
      video.load();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [fileUrl]);

  const doSeekVideo = useCallback((frame: number) => {
    const video = videoRef.current;
    if (!video) return;

    const targetTime = frame / fpsRef.current;

    if (isSeekingRef.current) {
      pendingSeekRef.current = frame;
      return;
    }

    if (Math.abs(video.currentTime - targetTime) < 0.5 / fpsRef.current) {
      setVideoFrameVersion((prev) => prev + 1);
      return;
    }

    isSeekingRef.current = true;
    video.currentTime = targetTime;
  }, []);

  const seekToFrame = useCallback((frame: number) => {
    const clamped = Math.max(0, Math.min(totalFramesRef.current - 1, frame));
    currentFrameRef.current = clamped;
    setCurrentFrameIndex(clamped);
    doSeekVideo(clamped);
  }, [doSeekVideo]);

  useEffect(() => {
    if (!isPlaying || !videoRef.current) return;

    const video = videoRef.current;
    video.playbackRate = playbackSpeed;

    const startFrame = currentFrameRef.current;
    const startTime = startFrame / fpsRef.current;

    let started = false;
    let lastFrameIdx = startFrame;

    const startPlay = () => {
      video.currentTime = startTime;
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        video.play().catch(() => setIsPlaying(false));
        started = true;
        animFrameRef.current = requestAnimationFrame(tick);
      };
      if (Math.abs(video.currentTime - startTime) < 0.5 / fpsRef.current) {
        video.play().catch(() => setIsPlaying(false));
        started = true;
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        video.addEventListener("seeked", onSeeked, { once: true });
      }
    };

    const tick = () => {
      if (!isPlayingRef.current) return;

      const frameIdx = Math.floor(video.currentTime * fpsRef.current);

      if (video.ended || video.currentTime >= durationRef.current) {
        currentFrameRef.current = totalFramesRef.current - 1;
        setCurrentFrameIndex(totalFramesRef.current - 1);
        setIsPlaying(false);
        return;
      }

      if (frameIdx !== lastFrameIdx) {
        lastFrameIdx = frameIdx;
        currentFrameRef.current = frameIdx;
        setCurrentFrameIndex(frameIdx);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    startPlay();

    return () => {
      video.pause();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed]);

  const togglePlayback = useCallback(async () => {
    onAnnotationSelect(null);

    if (isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const video = videoRef.current;
      if (!video) { setIsPlaying(false); return; }

      video.pause();
      await new Promise<void>((resolve) => {
        if (video.paused) { resolve(); return; }
        video.addEventListener("pause", () => resolve(), { once: true });
      });

      const exactFrame = Math.floor(video.currentTime * fpsRef.current);
      const exactTime = exactFrame / fpsRef.current;

      currentFrameRef.current = exactFrame;

      isSeekingRef.current = true;
      video.currentTime = exactTime;
      await new Promise<void>((resolve) => {
        if (Math.abs(video.currentTime - exactTime) < 0.5 / fpsRef.current) { resolve(); return; }
        video.addEventListener("seeked", () => resolve(), { once: true });
      });
      isSeekingRef.current = false;

      setCurrentFrameIndex(exactFrame);
      setVideoFrameVersion((prev) => prev + 1);
      setIsPlaying(false);

    } else {
      if (currentFrameIndex >= totalFrames - 1) {
        currentFrameRef.current = totalFrames - 2; // stay near end
      }
      if (currentFrameIndex >= totalFrames - 1) {
        setCurrentFrameIndex(0);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentFrameIndex, totalFrames, onAnnotationSelect]);

  const skipFrames = useCallback((delta: number) => {
    seekToFrame(currentFrameRef.current + delta);
  }, [seekToFrame]);

  const currentTimestamp = useMemo(() => currentFrameIndex / fps, [currentFrameIndex, fps]);

  const frameAnnotations = useMemo(() => {
    const bboxAnns = annotations.filter(
      (a) =>
        a.type === "boundingBox" &&
        (a as BoundingBoxAnnotation).topicName === VIDEO_TOPIC &&
        (a as BoundingBoxAnnotation).frameIndex === currentFrameIndex
    );
    const polyAnns = annotations.filter(
      (a) =>
        a.type === "polygon" &&
        (a as PolygonAnnotation).topicName === VIDEO_TOPIC &&
        (a as PolygonAnnotation).frameIndex === currentFrameIndex
    );
    return [...bboxAnns, ...polyAnns] as Annotation[];
  }, [annotations, currentFrameIndex]);

  const frameLabelAnnotations = useMemo(() => {
    return annotations.filter(
      (a) =>
        a.type === "frameLabel" &&
        (a as FrameLabelAnnotation).topicName === VIDEO_TOPIC &&
        (a as FrameLabelAnnotation).frameIndex === currentFrameIndex
    ) as FrameLabelAnnotation[];
  }, [annotations, currentFrameIndex]);

  const videoSegments = useMemo(() => {
    return annotations.filter(
      (a): a is VideoSegmentAnnotation => a.type === 'videoSegment'
    );
  }, [annotations]);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAnnotation) return;
    const ann = annotations.find((a) => a.id === selectedAnnotation);
    if (!ann) return;

    if (ann.type === 'videoSegment') {
      const seg = ann as VideoSegmentAnnotation;
      setIsPlaying(false);
      setSelectedSegmentId(seg.id);
      seekToFrame(Math.round(seg.startTime * fpsRef.current));
      return;
    }

    let targetFrameIndex: number | undefined;
    if (ann.type === "boundingBox" || ann.type === "frameLabel") {
      targetFrameIndex = (ann as BoundingBoxAnnotation | FrameLabelAnnotation).frameIndex;
    } else if (ann.type === "polygon") {
      const polyAnn = ann as PolygonAnnotation;
      targetFrameIndex = polyAnn.frameIndex ?? (polyAnn.timestamp !== undefined ? Math.round(polyAnn.timestamp * fpsRef.current) : undefined);
    }

    if (targetFrameIndex === undefined) return;
    setIsPlaying(false);
    seekToFrame(targetFrameIndex);
  }, [selectedAnnotation]);

  const handleFrameLabelCreate = useCallback(() => {
    if (!videoReady) return;
    setIsPlaying(false);
    const frameLabelAnnotation: FrameLabelAnnotation = {
      id: crypto.randomUUID(),
      type: "frameLabel",
      topicName: VIDEO_TOPIC,
      frameIndex: currentFrameIndex,
      timestamp: currentTimestamp,
      label: activeLabel,
      color: activeColor,
    };
    onAnnotationCreate(frameLabelAnnotation);
  }, [currentFrameIndex, currentTimestamp, videoReady, activeLabel, activeColor, onAnnotationCreate]);

  const handleSegmentCreate = useCallback(() => {
    setIsPlaying(false);
    const startTime = currentTimestamp;
    const endTime = Math.min(startTime + 5, durationRef.current);
    const segment: VideoSegmentAnnotation = {
      id: crypto.randomUUID(),
      type: 'videoSegment',
      startTime,
      endTime,
      label: activeLabel,
      color: activeColor,
      topicName: VIDEO_TOPIC,
    };
    onAnnotationCreate(segment);
    setSelectedSegmentId(segment.id);
  }, [currentTimestamp, activeLabel, activeColor, onAnnotationCreate]);

  const handleSegmentDragEnd = useCallback((id: string, start: number, end: number) => {
    const seg = videoSegments.find(s => s.id === id);
    if (!seg) return;
    onAnnotationUpdate({ ...seg, startTime: start, endTime: end });
  }, [videoSegments, onAnnotationUpdate]);

  const handleSegmentSeek = useCallback((t: number) => {
    setIsPlaying(false);
    seekToFrame(Math.max(0, Math.min(totalFramesRef.current - 1, Math.round(t * fpsRef.current))));
  }, [seekToFrame]);

  const handleAnnotationCreate = useCallback(
    (annotation: Annotation) => {
      if (!videoReady) return;
      setIsPlaying(false);
      if (annotation.type === "boundingBox") {
        const videoAnnotation: BoundingBoxAnnotation = {
          id: annotation.id,
          type: "boundingBox",
          topicName: VIDEO_TOPIC,
          frameIndex: currentFrameIndex,
          timestamp: currentTimestamp,
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          label: annotation.label,
          color: annotation.color,
        };
        onAnnotationCreate(videoAnnotation);
      } else if (annotation.type === "polygon") {
        const polyAnnotation: PolygonAnnotation = {
          ...annotation,
          topicName: VIDEO_TOPIC,
          frameIndex: currentFrameIndex,
          timestamp: currentTimestamp,
        };
        onAnnotationCreate(polyAnnotation);
      } else {
        onAnnotationCreate(annotation);
      }
    },
    [currentFrameIndex, currentTimestamp, videoReady, onAnnotationCreate]
  );

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      fullscreenRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setIsFullscreen((prev) => !prev);
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-lg font-medium">Loading video...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p className="text-lg font-medium">Video Error</p>
        <p className="text-sm max-w-md text-center">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={fullscreenRef}
      className={cn(
        "flex-1 flex flex-col gap-2 min-h-0 overflow-hidden",
        isFullscreen && "bg-background w-full h-full"
      )}
    >
      {isFullscreen && renderToolbar && (
        <div className="px-4 py-2 border-b border-border flex justify-center shrink-0">
          {renderToolbar({ isFullscreen, toggleFullscreen })}
        </div>
      )}

      <div className={cn("flex-1 min-h-0 flex overflow-hidden", isFullscreen ? "" : "flex-col gap-2")}>
        <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-2 p-2 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 flex-wrap shrink-0">
            <span className="text-xs text-muted-foreground ml-auto">
              {frameAnnotations.length + frameLabelAnnotations.length} annotation
              {frameAnnotations.length + frameLabelAnnotations.length !== 1 ? "s" : ""} on this frame
            </span>
            {!isFullscreen && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3 px-2 shrink-0">
            {/* FIX: Back 10 was calling skipFrames(-10) for both back AND forward */}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => skipFrames(-10)} disabled={currentFrameIndex === 0} title="Back 10 frames">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => skipFrames(-1)} disabled={currentFrameIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant={isPlaying ? "default" : "outline"} size="icon" className="h-9 w-9" onClick={togglePlayback} disabled={totalFrames <= 1}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => skipFrames(1)} disabled={currentFrameIndex >= totalFrames - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {/* FIX: Forward 10 was also calling skipFrames(-10) — now +10 */}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => skipFrames(10)} disabled={currentFrameIndex >= totalFrames - 1} title="Forward 10 frames">
              <SkipForward className="h-4 w-4" />
            </Button>

            <span className="text-sm text-muted-foreground min-w-[80px] text-center font-mono">
              {totalFrames > 0 ? `${currentFrameIndex + 1} / ${totalFrames}` : "No frames"}
            </span>

            {currentTimestamp > 0 && (
              <span className="text-xs text-muted-foreground font-mono">
                t = {currentTimestamp.toFixed(3)}s
              </span>
            )}

            <Select value={String(playbackSpeed)} onValueChange={(v) => setPlaybackSpeed(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYBACK_SPEEDS.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {speed}×
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frame scrubber */}
          {totalFrames > 1 && (
            <div className="shrink-0 px-2">
              <Slider
                value={[currentFrameIndex]}
                onValueChange={([v]) => {
                  onAnnotationSelect(null);
                  setIsPlaying(false);
                  currentFrameRef.current = v;
                  setCurrentFrameIndex(v);
                  if (sliderRafRef.current !== null) cancelAnimationFrame(sliderRafRef.current);
                  sliderRafRef.current = requestAnimationFrame(() => {
                    sliderRafRef.current = null;
                    doSeekVideo(v);
                  });
                }}
                min={0}
                max={totalFrames - 1}
                step={1}
                className="w-full"
              />
            </div>
          )}

          {/* Video Segment Timeline */}
          {(activeTool === 'videoSegment' || videoSegments.length > 0) && duration > 0 && (
            <div className="shrink-0 px-2">
              <VideoSegmentTimeline
                duration={duration}
                currentTime={currentTimestamp}
                segments={videoSegments}
                selectedId={selectedSegmentId}
                onSeek={handleSegmentSeek}
                onSegmentClick={(id) => {
                  setSelectedSegmentId(id);
                  onAnnotationSelect(id);
                }}
                onSegmentDragEnd={handleSegmentDragEnd}
                onSegmentCreate={handleSegmentCreate}
                onSegmentDelete={(id) => {
                  onAnnotationDelete?.(id);
                  if (selectedSegmentId === id) setSelectedSegmentId(null);
                }}
              />
            </div>
          )}

          {/* Frame label badges + apply button */}
          {(frameLabelAnnotations.length > 0 || activeTool === "frameLabel") && (
            <div className="flex items-center gap-2 px-2 shrink-0 flex-wrap">
              {frameLabelAnnotations.map((fl) => (
                <div key={fl.id} className="inline-flex items-center gap-0 relative">
                  <button
                    onClick={() => onAnnotationSelect(fl.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all",
                      onAnnotationDelete ? "rounded-r-none border-r-0" : "",
                      selectedAnnotation === fl.id && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                    style={{
                      borderColor: `hsl(var(--${fl.color === "blue" ? "primary" : "accent"}))`,
                      background: `hsl(var(--${fl.color === "blue" ? "primary" : "accent"}) / 0.15)`,
                    }}
                  >
                    <span className={cn("w-2 h-2 rounded-full", `bg-${fl.color}-500`)} />
                    {fl.label}
                  </button>
                  {onAnnotationDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnnotationDelete(fl.id);
                      }}
                      className="inline-flex items-center justify-center px-1.5 py-1 rounded-r-full border text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      style={{
                        borderColor: `hsl(var(--${fl.color === "blue" ? "primary" : "accent"}))`,
                        background: `hsl(var(--${fl.color === "blue" ? "primary" : "accent"}) / 0.15)`,
                      }}
                      title="Delete frame label"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {activeTool === "frameLabel" && videoReady && (
                <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={handleFrameLabelCreate}>
                  <Frame className="h-3.5 w-3.5" />
                  Label Frame as "{activeLabel}"
                </Button>
              )}
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
            {videoRef.current && videoReady && videoRef.current.readyState >= 2 ? (
              <AnnotationCanvas
                frameSource={videoRef.current}
                frameSize={videoFrameSize}
                frameVersion={videoFrameVersion }
                annotations={frameAnnotations}
                activeTool={activeTool === "frameLabel" || activeTool === "videoSegment" ? "select" : activeTool}
                selectedAnnotation={selectedAnnotation}
                activeLabel={activeLabel}
                activeColor={activeColor}
                zoom={zoom}
                onAnnotationCreate={handleAnnotationCreate}
                onAnnotationSelect={onAnnotationSelect}
                onAnnotationUpdate={onAnnotationUpdate}
                onAnnotationDelete={onAnnotationDelete}
                fitToContainer
              />
            ) : (
              <div className="flex items-center justify-center text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p>Loading frame...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {isFullscreen && renderSidebar && renderSidebar()}
      </div>
    </div>
  );
}