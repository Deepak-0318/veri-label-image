import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { McapIndexedReader } from "@mcap/core";
import * as fzstd from "fzstd";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { Annotation, AnnotationTool, TagColor, FrameLabelAnnotation, BoundingBoxAnnotation, PolygonAnnotation, VideoSegmentAnnotation } from "@/types/annotation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Loader2, Layers, Play, Pause, SkipBack, SkipForward, AlertTriangle, Maximize2, Minimize2, Frame, X, Database } from "lucide-react";
import { decodeCompressedVideoFrames, decodeImageMessage, isCompressedVideoSchema, isDecodeFailure, DecodedVideoFrameLite } from "./mcapDecoders";
import { getPerformanceProfile } from "@/hooks/usePerformanceSettings";
import { VideoSegmentTimeline } from "./VideoSegmentTimeline";
import {
  hashString,
  cacheFrame,
  cacheLiteFrame,
  loadAllCachedFrames,
  loadAllCachedLiteFrames,
  topicExistsInCache,
  clearTopicCache,
} from "../../services/mcapIndexedDbCache";
import { apiFetch } from "@/services/api";

interface McapFrame {
  topicName: string;
  frameIndex: number;
  timestamp: number;
  source: ImageBitmap;
  width: number;
  height: number;
}

interface McapLiteFrame {
  topicName: string;
  frameIndex: number;
  timestamp: number;
  dataUrl: string;
  width: number;
  height: number;
}

interface McapMessageRef {
  data: Uint8Array;
  timestamp: number;
}

interface McapTopic {
  name: string;
  schemaName: string;
  schemaEncoding: string;
  messageCount: number;
  isVideo: boolean;
}

interface McapAnnotationViewProps {
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

const IMAGE_SCHEMA_PATTERNS = [
  "sensor_msgs/Image",
  "sensor_msgs/CompressedImage",
  "sensor_msgs/msg/Image",
  "sensor_msgs/msg/CompressedImage",
  "foxglove.CompressedImage",
  "foxglove.RawImage",
  "foxglove.CompressedVideo",
  "foxglove_msgs/msg/CompressedVideo",
];

function isImageSchema(schemaName: string): boolean {
  return IMAGE_SCHEMA_PATTERNS.some(
    (p) => schemaName.includes(p) || schemaName.toLowerCase().includes("image")
  );
}

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4];

type IdbStatus = "checking" | "hit" | "miss" | "idle";

export function McapAnnotationView({
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
}: McapAnnotationViewProps) {
  const perfProfile = useMemo(() => getPerformanceProfile(), []);
  const FRAME_CACHE_SIZE = perfProfile.frameCacheSize;
  const DECODE_BATCH_SIZE = perfProfile.decodeBatchSize;
  const LOW_MEMORY = perfProfile.lowMemory;

  // Stable hash of the file URL — used as the IDB db-name suffix
  const fileHash = useMemo(() => hashString(fileUrl), [fileUrl]);

  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState<string>("Fetching file...");
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<McapTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [currentFrameUrl, setCurrentFrameUrl] = useState<string | null>(null);
  const [currentFrameBitmap, setCurrentFrameBitmap] = useState<ImageBitmap | null>(null);
  const [currentFrameSize, setCurrentFrameSize] = useState({ width: 0, height: 0 });
  const [decodingFrame, setDecodingFrame] = useState(false);

  const [topicReady, setTopicReady] = useState(false);
  const [topicFailed, setTopicFailed] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  const idbPersistedTopicsRef = useRef<Set<string>>(new Set());
  const [idbStatus, setIdbStatus] = useState<IdbStatus>("idle");

  const messagesByTopicRef = useRef<Map<string, McapMessageRef[]>>(new Map());
  const frameCacheRef = useRef<Map<string, string>>(new Map());
  const cacheOrderRef = useRef<string[]>([]);
  const decodingRef = useRef(false);
  const videoDecodedTopicsRef = useRef<Set<string>>(new Set());
  const videoFramesByTopicRef = useRef<Map<string, McapFrame[]>>(new Map());
  const videoLiteFramesByTopicRef = useRef<Map<string, McapLiteFrame[]>>(new Map());
  const videoDecodeControllerRef = useRef<AbortController | null>(null);
  const decodeSessionRef = useRef(0);

  const [videoDecodeProgress, setVideoDecodeProgress] = useState<{ current: number; total: number } | null>(null);
  const [frameLoadVersion, setFrameLoadVersion] = useState(0);
  const [displayFrameUrl, setDisplayFrameUrl] = useState<string | null>(null);
  const pendingFrameUrl = useRef<string | null>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null);
  const lastGoodFrameUrl = useRef<string | null>(null);

  const getCacheKey = (topic: string, index: number) => `${topic}:${index}`;

  const getCachedFrame = useCallback((topic: string, index: number): string | undefined => {
    return frameCacheRef.current.get(getCacheKey(topic, index));
  }, []);

  const setCachedFrame = useCallback((topic: string, index: number, url: string) => {
    const key = getCacheKey(topic, index);
    if (frameCacheRef.current.has(key)) {
      cacheOrderRef.current = cacheOrderRef.current.filter(k => k !== key);
      cacheOrderRef.current.push(key);
      return;
    }
    while (cacheOrderRef.current.length >= FRAME_CACHE_SIZE) {
      const oldKey = cacheOrderRef.current.shift();
      if (oldKey) {
        const oldUrl = frameCacheRef.current.get(oldKey);
        if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
        frameCacheRef.current.delete(oldKey);
      }
    }
    frameCacheRef.current.set(key, url);
    cacheOrderRef.current.push(key);
  }, [FRAME_CACHE_SIZE]);

  useEffect(() => {
    let cancelled = false;
    async function indexMcap() {
      setLoading(true);
      setLoadingPhase("Fetching file...");
      setError(null);

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Failed to fetch MCAP file");
        setLoadingPhase("Reading file into memory...");
        const arrayBuffer = await response.arrayBuffer();

        setLoadingPhase("Parsing MCAP index...");
        const decompressHandlers = {
          zstd: (buffer: Uint8Array, _decompressedSize: bigint) => fzstd.decompress(buffer),
        };

        const reader = await McapIndexedReader.Initialize({
          readable: {
            size: async () => BigInt(arrayBuffer.byteLength),
            read: async (offset: bigint, length: bigint) =>
              new Uint8Array(arrayBuffer, Number(offset), Number(length)),
          },
          decompressHandlers,
        });

        const visualChannels = new Map<number, { topicName: string; schemaName: string; schemaEncoding: string; isVideo: boolean }>();
        for (const channel of reader.channelsById.values()) {
          const schema = reader.schemasById.get(channel.schemaId);
          const schemaName = schema?.name ?? "";
          const schemaEncoding = schema?.encoding ?? "";
          const topicLower = channel.topic.toLowerCase();
          const isVideo = isCompressedVideoSchema(schemaName) || topicLower.includes("video");

          if (isImageSchema(schemaName) || isVideo || topicLower.includes("image") || topicLower.includes("camera")) {
            visualChannels.set(channel.id, { topicName: channel.topic, schemaName, schemaEncoding, isVideo });
          }
        }

        if (cancelled) return;

        if (visualChannels.size === 0) {
          setError("No image/video topics found. Supported: " + IMAGE_SCHEMA_PATTERNS.join(", "));
          setLoading(false);
          return;
        }

        setLoadingPhase("Indexing messages...");
        const messagesByTopic = new Map<string, McapMessageRef[]>();
        const topicInfoMap = new Map<string, { schemaName: string; schemaEncoding: string; isVideo: boolean }>();

        for (const [, info] of visualChannels) {
          if (!messagesByTopic.has(info.topicName)) {
            messagesByTopic.set(info.topicName, []);
            topicInfoMap.set(info.topicName, info);
          }
        }

        let msgCount = 0;
        for await (const message of reader.readMessages()) {
          if (cancelled) return;
          const channelInfo = visualChannels.get(message.channelId);
          if (!channelInfo) continue;
          messagesByTopic.get(channelInfo.topicName)!.push({
            data: message.data.slice(),
            timestamp: Number(message.logTime) / 1e9,
          });
          msgCount++;
          if (msgCount % 500 === 0) setLoadingPhase(`Indexing messages... ${msgCount} found`);
        }

        if (cancelled) return;

        messagesByTopicRef.current = messagesByTopic;

        const discoveredTopics: McapTopic[] = [];
        for (const [topicName, msgs] of messagesByTopic) {
          const info = topicInfoMap.get(topicName)!;
          discoveredTopics.push({
            name: topicName,
            schemaName: info.schemaName,
            schemaEncoding: info.schemaEncoding,
            messageCount: msgs.length,
            isVideo: info.isVideo,
          });
        }
        discoveredTopics.sort((a, b) => b.messageCount - a.messageCount);

        setTopics(discoveredTopics);
        if (discoveredTopics[0]) setSelectedTopic(discoveredTopics[0].name);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to parse MCAP file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    indexMcap();
    return () => { cancelled = true; };
  }, [fileUrl]);

  const totalFrames = useMemo(() => {
    const topic = topics.find(t => t.name === selectedTopic);
    if (!topic) return 0;
    if (topic.isVideo) {
      return LOW_MEMORY
        ? (videoLiteFramesByTopicRef.current.get(selectedTopic)?.length ?? 0)
        : (videoFramesByTopicRef.current.get(selectedTopic)?.length ?? 0);
    }
    return messagesByTopicRef.current.get(selectedTopic)?.length ?? 0;
  }, [selectedTopic, topics, frameLoadVersion, LOW_MEMORY]);

  useEffect(() => {
    const sessionId = ++decodeSessionRef.current;
    if (!selectedTopic || loading) return;

    const topic = topics.find(t => t.name === selectedTopic);
    if (!topic) return;

    if (!topic.isVideo) return; 

    if (videoDecodedTopicsRef.current.has(selectedTopic)) return;

    if (typeof VideoDecoder === "undefined") {
      setTopics(prev => prev.map(t => t.name === selectedTopic ? { ...t, isVideo: false } : t));
      setError("Browser does not support video decoding. Using image fallback.");
      return;
    }

    let cancelled = false;
    const messages = messagesByTopicRef.current.get(selectedTopic) ?? [];
    const controller = new AbortController();
    videoDecodeControllerRef.current?.abort();
    videoDecodeControllerRef.current = controller;

    (async () => {
      setIdbStatus("checking");
      setDecodingFrame(true);
      setTopicFailed(false);
      setCurrentFrameUrl(null);
      setCurrentFrameBitmap(null);

      const idbStore = LOW_MEMORY ? "liteFrames" : "frames";
      const existsInIdb = await topicExistsInCache(fileHash, selectedTopic, idbStore as any);

      if (cancelled || controller.signal.aborted || sessionId !== decodeSessionRef.current) return;

      if (existsInIdb) {
        setIdbStatus("hit");
        setVideoDecodeProgress(null);

        if (LOW_MEMORY) {
          const cached = await loadAllCachedLiteFrames(fileHash, selectedTopic);
          if (cancelled || sessionId !== decodeSessionRef.current) return;

          if (cached && cached.length > 0) {
            const liteFrames: McapLiteFrame[] = cached.map((f, i) => ({
              topicName: selectedTopic,
              frameIndex: i,
              timestamp: f.timestamp,
              dataUrl: f.dataUrl,
              width: f.width,
              height: f.height,
            }));
            videoLiteFramesByTopicRef.current.set(selectedTopic, liteFrames);
            videoDecodedTopicsRef.current.add(selectedTopic);
            idbPersistedTopicsRef.current.add(selectedTopic);
            setFrameLoadVersion(v => v + 1); 

            const first = liteFrames[0];
            setCurrentFrameUrl(first.dataUrl);
            setCurrentFrameSize({ width: first.width, height: first.height });
            setCurrentFrameBitmap(null);
            setDecodingFrame(false);
            setTopicReady(true);
            setError(null);
            setIdbStatus("idle");
            setDisplayFrameUrl(null); 
            return;
          }
        } else {
          const cached = await loadAllCachedFrames(fileHash, selectedTopic);
          if (cancelled || sessionId !== decodeSessionRef.current) return;

          if (cached && cached.length > 0) {
            const videoFrames: McapFrame[] = cached.map((f, i) => ({
              topicName: selectedTopic,
              frameIndex: i,
              timestamp: f.timestamp,
              source: f.bitmap,
              width: f.width,
              height: f.height,
            }));
            videoFramesByTopicRef.current.set(selectedTopic, videoFrames);
            videoDecodedTopicsRef.current.add(selectedTopic);
            idbPersistedTopicsRef.current.add(selectedTopic);
            setFrameLoadVersion(v => v + 1); 

            const first = videoFrames[0];
            setCurrentFrameBitmap(first.source);
            setCurrentFrameSize({ width: first.width, height: first.height });
            setCurrentFrameUrl(null);
            setDecodingFrame(false);
            setTopicReady(true);
            setError(null);
            setIdbStatus("idle");
            return;
          }
        }

      }

      setIdbStatus("miss");
      setVideoDecodeProgress({ current: 0, total: messages.length });

      if (LOW_MEMORY) {
        videoLiteFramesByTopicRef.current.set(selectedTopic, []);
      } else {
        videoFramesByTopicRef.current.set(selectedTopic, []);
      }

      let result;
      try {
        result = await decodeCompressedVideoFrames(messages, topic.schemaEncoding, {
          maxFrames: Infinity,
          signal: controller.signal,
          hardwareAcceleration: perfProfile.hardwareAcceleration,
          yieldInterval: perfProfile.yieldInterval,
          lowMemory: LOW_MEMORY,

          onLiteFrame: LOW_MEMORY ? (frame, index) => {
            if (cancelled || sessionId !== decodeSessionRef.current) return;
            const currentFrames = videoLiteFramesByTopicRef.current.get(selectedTopic) ?? [];
            currentFrames[index] = {
              topicName: selectedTopic,
              frameIndex: index,
              timestamp: frame.timestamp,
              dataUrl: frame.dataUrl,
              width: frame.width,
              height: frame.height,
            };
            videoLiteFramesByTopicRef.current.set(selectedTopic, currentFrames);

            // Persist to IDB (fire-and-forget)
            cacheLiteFrame(fileHash, selectedTopic, index, frame.timestamp, frame.dataUrl, frame.width, frame.height);

            if (index === 0) {
              setCurrentFrameUrl(frame.dataUrl);
              setCurrentFrameSize({ width: frame.width, height: frame.height });
              setCurrentFrameBitmap(null);
              setDecodingFrame(false);
              setTopicReady(true);
            }
            setVideoDecodeProgress(prev => prev ? { ...prev, current: index + 1 } : { current: index + 1, total: messages.length });
          } : undefined,

          onFrame: !LOW_MEMORY ? (frame, index) => {
            if (cancelled || sessionId !== decodeSessionRef.current) return;
            const currentFrames = videoFramesByTopicRef.current.get(selectedTopic) ?? [];
            currentFrames[index] = {
              topicName: selectedTopic,
              frameIndex: index,
              timestamp: frame.timestamp,
              source: frame.source,
              width: frame.width,
              height: frame.height,
            };
            videoFramesByTopicRef.current.set(selectedTopic, currentFrames);

            // Persist to IDB (fire-and-forget)
            cacheFrame(fileHash, selectedTopic, index, frame.timestamp, frame.source);

            if (index === 0) {
              setCurrentFrameBitmap(frame.source);
              setCurrentFrameSize({ width: frame.width, height: frame.height });
              setDecodingFrame(false);
              setTopicReady(true);
            }
            setVideoDecodeProgress(prev => prev ? { ...prev, current: index + 1 } : { current: index + 1, total: messages.length });
          } : undefined,
        });
      } catch (e: any) {
        if (cancelled || controller.signal.aborted) return;
        setDecodingFrame(false);
        setVideoDecodeProgress(null);
        const fallbackMsg = messages[0];
        if (fallbackMsg) {
          const decoded = decodeImageMessage(fallbackMsg.data, topic.schemaName, topic.schemaEncoding);
          if (!isDecodeFailure(decoded)) {
            setCurrentFrameUrl(decoded.url);
            setTopicReady(true);
            setError(null);
            setIdbStatus("idle");
            return;
          }
        }
        setTopicFailed(true);
        setError(`Video decode failed: ${e?.message ?? "Unknown error"}.`);
        setIdbStatus("idle");
        return;
      }

      if (cancelled || controller.signal.aborted) return;

      const frameCount = LOW_MEMORY
        ? (videoLiteFramesByTopicRef.current.get(selectedTopic)?.length ?? result.liteFrames.length)
        : (videoFramesByTopicRef.current.get(selectedTopic)?.length ?? result.frames.length);

      if (frameCount === 0) {
        setTopics(prev => prev.map(item =>
          item.name === selectedTopic ? { ...item, isVideo: false } : item
        ));
        videoDecodedTopicsRef.current.add(selectedTopic);
        setVideoDecodeProgress(null);
        setDecodingFrame(false);

        const firstMsg = messages[0];
        if (firstMsg) {
          const decoded = decodeImageMessage(firstMsg.data, topic.schemaName, topic.schemaEncoding);
          if (!isDecodeFailure(decoded)) {
            setCachedFrame(selectedTopic, 0, decoded.url);
            setCurrentFrameUrl(decoded.url);
            setTopicReady(true);
            setError(null);
            setCurrentFrameIndex(0);
            setIdbStatus("idle");
            return;
          }
        }

        setTopicFailed(true);
        setError(result.firstError ? `Could not decode topic: ${result.firstError}` : "No frames produced.");
        setIdbStatus("idle");
        return;
      }

      if (!LOW_MEMORY) {
        const frames = videoFramesByTopicRef.current.get(selectedTopic) ?? result.frames.map((f: any, i: number) => ({
          topicName: selectedTopic,
          frameIndex: i,
          timestamp: f.timestamp,
          source: f.source,
          width: f.width,
          height: f.height,
        }));
        videoFramesByTopicRef.current.set(selectedTopic, frames);
      }

      videoDecodedTopicsRef.current.add(selectedTopic);
      idbPersistedTopicsRef.current.add(selectedTopic);
      setFrameLoadVersion(v => v + 1); 
      setVideoDecodeProgress(null);
      setDecodingFrame(false);
      setError(null);
      setTopicReady(true);
      setIdbStatus("idle");
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedTopic, loading, topics, LOW_MEMORY, perfProfile, setCachedFrame, fileHash]);

  // ─── Frame display effect (image topics + video frame navigation) ─────────
  useEffect(() => {
    if (!selectedTopic || loading) return;
    const topic = topics.find(t => t.name === selectedTopic);
    if (!topic) return;

    if (topic.isVideo) {
      if (LOW_MEMORY) {
        const liteFrames = videoLiteFramesByTopicRef.current.get(selectedTopic);
        if (liteFrames?.[currentFrameIndex]) {
          const frame = liteFrames[currentFrameIndex];
          setCurrentFrameUrl(frame.dataUrl);
          setCurrentFrameSize({ width: frame.width, height: frame.height });
          setCurrentFrameBitmap(null);
        } else {
          if (currentFrameIndex === 0) {
            setCurrentFrameBitmap(null);
            setCurrentFrameUrl(null);
          }
        }
      } else {
        const videoFrames = videoFramesByTopicRef.current.get(selectedTopic);
        if (videoFrames?.[currentFrameIndex]) {
          const frame = videoFrames[currentFrameIndex];
          setCurrentFrameBitmap(frame.source);
          setCurrentFrameSize({ width: frame.width, height: frame.height });
          setCurrentFrameUrl(null);
        } else {
          if (currentFrameIndex === 0) {
            setCurrentFrameBitmap(null);
            setCurrentFrameUrl(null);
          }
        }
      }
      return;
    }

    // Image topic
    setCurrentFrameBitmap(null);

    const cached = getCachedFrame(selectedTopic, currentFrameIndex);
    if (cached) {
      setCurrentFrameUrl(cached);
      setTopicReady(true);
      return;
    }

    const messages = messagesByTopicRef.current.get(selectedTopic);
    if (!messages || !messages[currentFrameIndex]) {
      setCurrentFrameUrl(null);
      setTopicFailed(true);
      return;
    }

    if (decodingRef.current) return;
    decodingRef.current = true;
    setDecodingFrame(true);

    const startIdx = currentFrameIndex;
    const endIdx = Math.min(messages.length, startIdx + DECODE_BATCH_SIZE);

    requestAnimationFrame(() => {
      let firstUrl: string | null = null;
      for (let i = startIdx; i < endIdx; i++) {
        if (getCachedFrame(selectedTopic, i)) continue;
        const msg = messages[i];
        const result = decodeImageMessage(msg.data, topic.schemaName, topic.schemaEncoding);
        if (!isDecodeFailure(result)) {
          setCachedFrame(selectedTopic, i, result.url);
          if (i === startIdx) firstUrl = result.url;
        }
      }

      if (firstUrl) {
        setCurrentFrameUrl(firstUrl);
        setTopicReady(true);
        setTopicFailed(false);
      } else {
        const c = getCachedFrame(selectedTopic, currentFrameIndex);
        if (c) {
          setCurrentFrameUrl(c);
          setTopicReady(true);
          setTopicFailed(false);
        } else {
          setCurrentFrameUrl(null);
          setTopicFailed(true);
        }
      }

      decodingRef.current = false;
      setDecodingFrame(false);
    });
  }, [selectedTopic, currentFrameIndex, loading, topics, getCachedFrame, setCachedFrame, LOW_MEMORY, DECODE_BATCH_SIZE,topicReady]);

 useEffect(() => {
  if (!currentFrameUrl) {
    return;
  }

  if (currentFrameUrl.startsWith("data:")) {
    lastGoodFrameUrl.current = currentFrameUrl;
    setDisplayFrameUrl(currentFrameUrl);
    return;
  }

  const img = new Image();
  pendingFrameUrl.current = currentFrameUrl;

  img.onload = () => {
    if (pendingFrameUrl.current === currentFrameUrl) {
      lastGoodFrameUrl.current = currentFrameUrl;
      setDisplayFrameUrl(currentFrameUrl);
    }
  };

  img.onerror = () => {
    if (pendingFrameUrl.current === currentFrameUrl) {
      lastGoodFrameUrl.current = currentFrameUrl;
      setDisplayFrameUrl(currentFrameUrl);
    }
  };

  img.src = currentFrameUrl;
}, [currentFrameUrl]);

useEffect(() => {
  if (!isPlaying || !selectedTopic) return;
  const nextIndex = currentFrameIndex + 1;
  if (nextIndex >= totalFrames) return;

  const topic = topics.find(t => t.name === selectedTopic);
  if (!topic?.isVideo || !LOW_MEMORY) return;

  const liteFrames = videoLiteFramesByTopicRef.current.get(selectedTopic);
  const next = liteFrames?.[nextIndex];
  if (!next) return;

  const img = new Image();
  img.src = next.dataUrl;
}, [isPlaying, currentFrameIndex, selectedTopic, totalFrames, topics, LOW_MEMORY]);

  useEffect(() => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setVideoDecodeProgress(null);
    setError(null);
    setIdbStatus("idle");

    if (!selectedTopic) {
      setCurrentFrameUrl(null);
      setCurrentFrameBitmap(null);
      setTopicReady(false);
      setTopicFailed(false);
      setDecodingFrame(false);
      return;
    }

    // Check if this topic already has frames decoded in memory
    const topic = topics.find(t => t.name === selectedTopic);
    const alreadyDecoded = videoDecodedTopicsRef.current.has(selectedTopic);

    if (topic?.isVideo && alreadyDecoded) {
      // Re-hydrate from in-memory video frames
      if (LOW_MEMORY) {
        const liteFrames = videoLiteFramesByTopicRef.current.get(selectedTopic);
        const first = liteFrames?.[0];
        if (first) {
          setCurrentFrameUrl(first.dataUrl);
          setCurrentFrameBitmap(null);
          setCurrentFrameSize({ width: first.width, height: first.height });
          setTopicReady(true);
          setTopicFailed(false);
          setDecodingFrame(false);
          return;
        }
      } else {
        const videoFrames = videoFramesByTopicRef.current.get(selectedTopic);
        const first = videoFrames?.[0];
        if (first) {
          setCurrentFrameBitmap(first.source);
          setCurrentFrameUrl(null);
          setCurrentFrameSize({ width: first.width, height: first.height });
          setTopicReady(true);
          setTopicFailed(false);
          setDecodingFrame(false);
          return;
        }
      }
    }

    // For image topics: check the in-memory frame cache for frame 0
    if (topic && !topic.isVideo) {
      const cached = frameCacheRef.current.get(getCacheKey(selectedTopic, 0));
      if (cached) {
        setCurrentFrameUrl(cached);
        setCurrentFrameBitmap(null);
        setTopicReady(true);
        setTopicFailed(false);
        setDecodingFrame(false);
        return;
      }
    }

    setCurrentFrameUrl(null);
    setCurrentFrameBitmap(null);
    setTopicReady(false);
    setTopicFailed(false);
    setDecodingFrame(false);
  }, [selectedTopic]);

  useEffect(() => {
    return () => {
      videoDecodeControllerRef.current?.abort();
      for (const frames of videoFramesByTopicRef.current.values()) {
        frames.forEach(f => { try { f.source.close(); } catch { /* ignore */ } });
      }
    };
  }, []);

  const currentTimestamp = useMemo(() => {
    const topic = topics.find(t => t.name === selectedTopic);
    if (!topic) return 0;
    if (topic.isVideo) {
      if (LOW_MEMORY) {
        return videoLiteFramesByTopicRef.current.get(selectedTopic)?.[currentFrameIndex]?.timestamp ?? 0;
      }
      return videoFramesByTopicRef.current.get(selectedTopic)?.[currentFrameIndex]?.timestamp ?? 0;
    }
    return messagesByTopicRef.current.get(selectedTopic)?.[currentFrameIndex]?.timestamp ?? 0;
  }, [selectedTopic, currentFrameIndex, topics, LOW_MEMORY]);

  const frameAnnotations = useMemo(() => {
    const bboxAnns = annotations.filter(
      a => a.type === "boundingBox" &&
        (a as BoundingBoxAnnotation).topicName === selectedTopic &&
        (a as BoundingBoxAnnotation).frameIndex === currentFrameIndex
    );
    const polyAnns = annotations.filter(
      a => a.type === "polygon" &&
        (a as PolygonAnnotation).topicName === selectedTopic &&
        (a as PolygonAnnotation).frameIndex === currentFrameIndex
    );
    return [...bboxAnns, ...polyAnns] as Annotation[];
  }, [annotations, selectedTopic, currentFrameIndex]);

  const frameLabelAnnotations = useMemo(() => {
    return annotations.filter(
      a => a.type === "frameLabel" &&
        (a as FrameLabelAnnotation).topicName === selectedTopic &&
        (a as FrameLabelAnnotation).frameIndex === currentFrameIndex
    ) as FrameLabelAnnotation[];
  }, [annotations, selectedTopic, currentFrameIndex]);

  const videoSegments = useMemo(() => {
    return annotations.filter(
      (a): a is VideoSegmentAnnotation =>
        a.type === "videoSegment" &&
        ((a as VideoSegmentAnnotation).topicName === selectedTopic || !(a as VideoSegmentAnnotation).topicName)
    );
  }, [annotations, selectedTopic]);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  const { topicStartTimestamp, mcapTopicDuration } = useMemo(() => {
    const topic = topics.find(t => t.name === selectedTopic);
    if (!topic) return { topicStartTimestamp: 0, mcapTopicDuration: 0 };

    if (topic.isVideo) {
      const frames = videoFramesByTopicRef.current.get(selectedTopic);
      if (frames && frames.length > 0) {
        const start = frames[0].timestamp;
        const end = frames[frames.length - 1].timestamp;
        return { topicStartTimestamp: start, mcapTopicDuration: Math.max(0, end - start) };
      }
    }

    const msgs = messagesByTopicRef.current.get(selectedTopic);
    if (msgs && msgs.length > 0) {
      const start = msgs[0].timestamp;
      const end = msgs[msgs.length - 1].timestamp;
      return { topicStartTimestamp: start, mcapTopicDuration: Math.max(0, end - start) };
    }
    return { topicStartTimestamp: 0, mcapTopicDuration: totalFrames / 30 };
  }, [selectedTopic, topics, totalFrames,frameLoadVersion]);

  const normalizeSegmentTime = useCallback((time: number) => {
    if (topicStartTimestamp > 0 && time >= topicStartTimestamp) return Math.max(0, time - topicStartTimestamp);
    return Math.max(0, time);
  }, [topicStartTimestamp]);

  const currentTimelineTime = useMemo(() => normalizeSegmentTime(currentTimestamp), [currentTimestamp, normalizeSegmentTime]);

  const timelineSegments = useMemo(() => {
    return videoSegments
      .map(s => ({ ...s, startTime: normalizeSegmentTime(s.startTime), endTime: normalizeSegmentTime(s.endTime) }))
      .filter(s => s.endTime > s.startTime);
  }, [videoSegments, normalizeSegmentTime]);

  const findFrameIndexForTimelineTime = useCallback((time: number) => {
    const targetTimestamp = topicStartTimestamp + Math.max(0, time);
    const topic = topics.find(item => item.name === selectedTopic);
    if (!topic) return 0;

    const timestamps = topic.isVideo
      ? (videoFramesByTopicRef.current.get(selectedTopic) ?? []).map(f => f.timestamp)
      : (messagesByTopicRef.current.get(selectedTopic) ?? []).map(m => m.timestamp);

    if (timestamps.length === 0) return 0;

    let low = 0, high = timestamps.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (timestamps[mid] < targetTimestamp) low = mid + 1;
      else high = mid;
    }

    if (low > 0 && Math.abs(timestamps[low - 1] - targetTimestamp) <= Math.abs(timestamps[low] - targetTimestamp))
      return low - 1;
    return low;
  }, [selectedTopic, topicStartTimestamp, topics]);

  useEffect(() => {
    if (!selectedAnnotation) return;
    const ann = annotations.find(a => a.id === selectedAnnotation);
    if (!ann) return;

    if (ann.type === "videoSegment") {
      const seg = ann as VideoSegmentAnnotation;
      setIsPlaying(false);
      setSelectedSegmentId(seg.id);
      if (seg.topicName && seg.topicName !== selectedTopic) { setSelectedTopic(seg.topicName); return; }
      setCurrentFrameIndex(Math.max(0, Math.min(totalFrames - 1, findFrameIndexForTimelineTime(normalizeSegmentTime(seg.startTime)))));
      return;
    }

    let targetTopicName: string | undefined;
    let targetFrameIndex: number | undefined;

    if (ann.type === "boundingBox" || ann.type === "frameLabel") {
      const fa = ann as BoundingBoxAnnotation | FrameLabelAnnotation;
      targetTopicName = fa.topicName; targetFrameIndex = fa.frameIndex;
    } else if (ann.type === "polygon") {
      const pa = ann as PolygonAnnotation;
      targetTopicName = pa.topicName; targetFrameIndex = pa.frameIndex;
    }

    if (!targetTopicName || targetFrameIndex === undefined) return;
    if (targetTopicName !== selectedTopic) { setIsPlaying(false); setSelectedTopic(targetTopicName); return; }
    setIsPlaying(false);
    setCurrentFrameIndex(targetFrameIndex);
  }, [annotations, findFrameIndexForTimelineTime, normalizeSegmentTime, selectedAnnotation, selectedTopic, totalFrames]);

  useEffect(() => {
  if (!isPlaying || totalFrames <= 1) return;

  const msPerFrame = (1000 / 30) / playbackSpeed;
  let lastTime = performance.now();
  let rafId: number;

  const tick = (now: number) => {
    const elapsed = now - lastTime;
    if (elapsed >= msPerFrame) {
      lastTime = now - (elapsed % msPerFrame);
      setCurrentFrameIndex(prev => {
        if (prev >= totalFrames - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}, [isPlaying, playbackSpeed, totalFrames]);

  const togglePlayback = useCallback(() => {
    onAnnotationSelect(null);
    if (currentFrameIndex >= totalFrames - 1) { setCurrentFrameIndex(0); setIsPlaying(true); }
    else setIsPlaying(prev => !prev);
  }, [currentFrameIndex, totalFrames, onAnnotationSelect]);

  const skipFrames = useCallback((count: number) => {
    setIsPlaying(false);
    setCurrentFrameIndex(prev => Math.max(0, Math.min(totalFrames - 1, prev + count)));
  }, [totalFrames]);

  const handleFrameLabelCreate = useCallback(() => {
    if ((!currentFrameUrl && !currentFrameBitmap) || !selectedTopic) return;
    setIsPlaying(false);
    onAnnotationCreate({
      id: crypto.randomUUID(), type: "frameLabel",
      topicName: selectedTopic, frameIndex: currentFrameIndex,
      timestamp: currentTimestamp, label: activeLabel, color: activeColor,
    } as FrameLabelAnnotation);
  }, [selectedTopic, currentFrameIndex, currentTimestamp, currentFrameUrl, currentFrameBitmap, activeLabel, activeColor, onAnnotationCreate]);

  const handleMcapSegmentCreate = useCallback(() => {
    if (!selectedTopic) return;
    setIsPlaying(false);
    const startTime = currentTimelineTime;
    const endTime = Math.min(startTime + 5, mcapTopicDuration || startTime + 5);
    const segment: VideoSegmentAnnotation = {
      id: crypto.randomUUID(), type: "videoSegment",
      startTime, endTime, label: activeLabel, color: activeColor, topicName: selectedTopic,
    };
    onAnnotationCreate(segment);
    setSelectedSegmentId(segment.id);
  }, [selectedTopic, currentTimelineTime, mcapTopicDuration, activeLabel, activeColor, onAnnotationCreate]);

  const handleMcapSegmentDragEnd = useCallback((id: string, start: number, end: number) => {
    const seg = videoSegments.find(s => s.id === id);
    if (!seg) return;
    onAnnotationUpdate({ ...seg, startTime: start, endTime: end });
  }, [videoSegments, onAnnotationUpdate]);

  const handleMcapSegmentSeek = useCallback((t: number) => {
    setIsPlaying(false);
    setCurrentFrameIndex(Math.max(0, Math.min(totalFrames - 1, findFrameIndexForTimelineTime(t))));
  }, [findFrameIndexForTimelineTime, totalFrames]);

  const handleAnnotationCreate = useCallback((annotation: Annotation) => {
    if (!currentFrameUrl && !currentFrameBitmap) return;
    setIsPlaying(false);
    if (annotation.type === "boundingBox") {
      onAnnotationCreate({
        id: annotation.id, type: "boundingBox",
        topicName: selectedTopic, frameIndex: currentFrameIndex, timestamp: currentTimestamp,
        x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height,
        label: annotation.label, color: annotation.color,
      } as BoundingBoxAnnotation);
    } else if (annotation.type === "polygon") {
      onAnnotationCreate({ ...annotation, topicName: selectedTopic, frameIndex: currentFrameIndex, timestamp: currentTimestamp } as PolygonAnnotation);
    } else {
      onAnnotationCreate(annotation);
    }
  }, [selectedTopic, currentFrameIndex, currentTimestamp, currentFrameUrl, currentFrameBitmap, onAnnotationCreate]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) fullscreenRef.current?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
    setIsFullscreen(prev => !prev);
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const hasFrame = Boolean(currentFrameUrl || currentFrameBitmap);
const isDecoding = decodingFrame || (!!videoDecodeProgress && !topicReady);
  const controlsDisabled = !topicReady || topicFailed;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-lg font-medium">Parsing MCAP file...</p>
        <p className="text-sm">{loadingPhase}</p>
      </div>
    );
  }

  if (error && topics.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Layers className="h-12 w-12 opacity-40" />
        <p className="text-lg font-medium">MCAP Error</p>
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

          {/* Topic selector */}
          <div className="flex items-center gap-4 flex-wrap shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger className="w-[480px] max-w-[60vw]">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map(topic => (
                    <SelectItem key={topic.name} value={topic.name}>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm">{topic.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {topic.messageCount} messages · {topic.schemaName}
                          {topic.isVideo ? " (video)" : ""}
                          {idbPersistedTopicsRef.current.has(topic.name) ? " · cached" : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-xs text-muted-foreground ml-auto">
              {frameAnnotations.length + frameLabelAnnotations.length} annotation
              {(frameAnnotations.length + frameLabelAnnotations.length) !== 1 ? "s" : ""} on this frame
            </span>

          </div>

          {/* IDB cache status banners */}
          {idbStatus === "checking" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground shrink-0">
              <Database className="h-3.5 w-3.5 shrink-0 animate-pulse" />
              Checking local cache…
            </div>
          )}
          {idbStatus === "hit" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/30 text-xs text-green-700 dark:text-green-400 shrink-0">
              <Database className="h-3.5 w-3.5 shrink-0" />
              Restoring frames from local cache — no re-decode needed.
            </div>
          )}

          {/* Video decode progress bar (only while decoding, before first frame) */}
          {videoDecodeProgress && !topicReady && (
            <div className="flex items-center gap-3 px-2 shrink-0">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              <div className="flex-1">
                <Progress
                  value={(videoDecodeProgress.current / Math.max(videoDecodeProgress.total, 1)) * 100}
                  className="h-2"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Decoding {videoDecodeProgress.current} / {videoDecodeProgress.total} frames…
              </span>
            </div>
          )}

          {/* Progress bar after first frame (smaller, non-blocking) */}
          {videoDecodeProgress && topicReady && (
            <div className="flex items-center gap-2 px-2 shrink-0">
              <div className="flex-1">
                <Progress
                  value={(videoDecodeProgress.current / Math.max(videoDecodeProgress.total, 1)) * 100}
                  className="h-1"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {videoDecodeProgress.current}/{videoDecodeProgress.total}
              </span>
            </div>
          )}

          {/* Error banner */}
          {error && topics.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-sm shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-muted-foreground text-xs">{error}</p>
            </div>
          )}

          {/* Playback controls */}
          <div className="flex items-center gap-3 px-2 shrink-0">
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => skipFrames(-10)} disabled={controlsDisabled || currentFrameIndex === 0}
              title="Back 10 frames">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1))}
              disabled={controlsDisabled || currentFrameIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant={isPlaying ? "default" : "outline"} size="icon" className="h-9 w-9"
              onClick={togglePlayback} disabled={controlsDisabled || totalFrames <= 1}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setCurrentFrameIndex(Math.min(totalFrames - 1, currentFrameIndex + 1))}
              disabled={controlsDisabled || currentFrameIndex >= totalFrames - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => skipFrames(10)} disabled={controlsDisabled || currentFrameIndex >= totalFrames - 1}
              title="Forward 10 frames">
              <SkipForward className="h-4 w-4" />
            </Button>

            <span className="text-sm text-muted-foreground min-w-[80px] text-center font-mono">
              {topicReady && totalFrames > 0 ? `${currentFrameIndex + 1} / ${totalFrames}` : "—"}
            </span>

            {currentTimestamp > 0 && (
              <span className="text-xs text-muted-foreground font-mono">
                t = {currentTimestamp.toFixed(3)}s
              </span>
            )}

            <Select value={String(playbackSpeed)} onValueChange={v => setPlaybackSpeed(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAYBACK_SPEEDS.map(speed => (
                  <SelectItem key={speed} value={String(speed)}>{speed}×</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isDecoding && !topicReady && !topicFailed && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Frame scrubber */}
          {topicReady && totalFrames > 1 && (
            <div className="shrink-0 px-2">
              <Slider
                value={[currentFrameIndex]}
                onValueChange={([v]) => { onAnnotationSelect(null); setIsPlaying(false); setCurrentFrameIndex(v); }}
                min={0} max={totalFrames - 1} step={1} className="w-full"
              />
            </div>
          )}

          {/* Video segment timeline */}
          {(activeTool === "videoSegment" || videoSegments.length > 0) && mcapTopicDuration > 0 && (
            <div className="shrink-0 px-2">
              <VideoSegmentTimeline
                duration={mcapTopicDuration}
                currentTime={currentTimelineTime}
                segments={timelineSegments}
                selectedId={selectedSegmentId}
                onSeek={handleMcapSegmentSeek}
                onSegmentClick={id => { setSelectedSegmentId(id); onAnnotationSelect(id); }}
                onSegmentDragEnd={handleMcapSegmentDragEnd}
                onSegmentCreate={handleMcapSegmentCreate}
                onSegmentDelete={id => { onAnnotationDelete?.(id); if (selectedSegmentId === id) setSelectedSegmentId(null); }}
              />
            </div>
          )}

          {/* Frame label badges */}
          {(frameLabelAnnotations.length > 0 || activeTool === "frameLabel") && (
            <div className="flex items-center gap-2 px-2 shrink-0 flex-wrap">
              {frameLabelAnnotations.map(fl => (
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
                      onClick={e => { e.stopPropagation(); onAnnotationDelete(fl.id); }}
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
              {activeTool === "frameLabel" && hasFrame && (
                <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={handleFrameLabelCreate}>
                  <Frame className="h-3.5 w-3.5" />
                  Label Frame as "{activeLabel}"
                </Button>
              )}
            </div>
          )}

         <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
  {topicFailed ? (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 opacity-40" />
      <p className="text-sm">Could not decode frames for this topic.</p>
    </div>
  ) : !topicReady && isDecoding ? (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">
        {idbStatus === "hit"
          ? "Restoring from cache…"
          : videoDecodeProgress
          ? `Decoding frames… ${videoDecodeProgress.current} / ${videoDecodeProgress.total}`
          : "Loading frame…"}
      </p>
    </div>
  ) : !topicReady && !isDecoding && !topicFailed ? (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <Layers className="h-8 w-8 opacity-40" />
      <p className="text-sm">No frames available for this topic.</p>
    </div>
  ) : (
    <AnnotationCanvas
      imageSrc={displayFrameUrl ?? lastGoodFrameUrl.current ?? undefined}
      frameSource={currentFrameBitmap}
      frameSize={currentFrameBitmap ? currentFrameSize : undefined}
      frameVersion={currentFrameBitmap ? currentFrameIndex : undefined}
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
  )}
</div>
        </div>

        {isFullscreen && renderSidebar && renderSidebar()}
      </div>
    </div>
  );
}