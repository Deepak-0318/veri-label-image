import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Annotation, AudioRegionAnnotation, TagColor } from "@/types/annotation";
import { Label } from "@/hooks/useLabels";
import { ProjectLabel, ProjectLabelType } from "@/hooks/useProjectLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward, Plus, Keyboard, AlertTriangle, Trash2, Filter, ZoomIn, Maximize2, Minimize2, Repeat, Undo2, Redo2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { AudioTimeRuler } from "./AudioTimeRuler";
import { RulerPlayhead } from "./RulerPlayhead";

interface AudioAnnotationViewProps {
  audioUrl: string;
   fileId: string; 
  annotations: Annotation[];
  labels: Label[];
  activeLabel: string;
  activeColor: TagColor;
  selectedAnnotation: string | null;
  onAnnotationCreate: (annotation: Annotation) => void;
  onAnnotationUpdate: (annotation: Annotation) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationSelect: (id: string | null) => void;
  onLabelCreate: (label: Label) => void;
  renderSidebar?: () => React.ReactNode;
  renderToolbar?: () => React.ReactNode;
  projectLabels?: ProjectLabel[];
  projectLabelTypes?: ProjectLabelType[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Arabic', 'Hindi', 'Portuguese', 'Russian'];
const EMOTIONS = ['neutral', 'happy', 'angry', 'sad'];

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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function parseTimeString(str: string): number | null {
  const parts = str.trim().split(':');
  let minutes = 0;
  let rest = parts[0];
  if (parts.length === 2) {
    minutes = parseInt(parts[0]) || 0;
    rest = parts[1];
  }
  const secParts = rest.split('.');
  const secs = parseInt(secParts[0]) || 0;
  const centis = secParts.length > 1 ? parseInt(secParts[1].padEnd(2, '0').slice(0, 2)) : 0;
  const total = minutes * 60 + secs + centis / 100;
  return isNaN(total) ? null : total;
}

const BAR_WIDTH = 2;
const BAR_GAP = 1;
const BAR_UNIT = BAR_WIDTH + BAR_GAP;
const HANDLE_PX = 6;
const MIN_REGION_S = 0.05;
const CHANNEL_HEIGHT = 100;
const CHANNEL_GAP = 4;
const LAYER_HEIGHT = 28;


const TARGET_SAMPLES = 10_000;
const LS_PREFIX      = 'wfkey:';
const isBlobUrl = (url: string) => url.startsWith('blob:') || url.startsWith('data:');

interface WaveformData {
  duration: number;
  channels: Float32Array[];
}

function lsGetHash(url: string): string | null {
  if (isBlobUrl(url)) return null;
  try { return localStorage.getItem(LS_PREFIX + url); } catch { return null; }
}
function lsSetHash(url: string, hash: string): void {
  if (isBlobUrl(url)) return;
  try { localStorage.setItem(LS_PREFIX + url, hash); } catch { /* quota */ }
}

const memoryCache = new Map<string, WaveformData>();
const inflightMap = new Map<string, Promise<WaveformData>>();

// Per-channel volume control overlay rendered to the left of the waveform.
// Vertical slider lets the annotator drag up to amplify or down (to 0) to mute.
function ChannelVolumeOverlay({
  channelVolumes,
  onChange,
  rulerHeight,
}: {
  channelVolumes: number[];
  onChange: (channelIndex: number, value: number) => void;
  rulerHeight: number;
}) {
  return (
    <div
      className="flex flex-col shrink-0 mr-2"
      style={{ width: 44 }}
      aria-label="Per-channel volume controls"
    >
      {/* Spacer to align the first slider with the start of channel 0,
          accounting for the time ruler above the waveform. */}
      <div style={{ height: rulerHeight }} aria-hidden="true" />
      {channelVolumes.map((vol, i) => {
        const muted = vol <= 0.001;
        return (
          <div
            key={i}
            className="flex items-center justify-center rounded-md border border-border/50 bg-background/60"
            style={{
              height: CHANNEL_HEIGHT,
              marginTop: i === 0 ? 0 : CHANNEL_GAP,
              padding: '6px 4px',
            }}
            title={`Channel ${i + 1} volume: ${Math.round(vol * 100)}%`}
          >
            <div className="flex flex-col items-center justify-between h-full gap-1 w-full">
              <button
                type="button"
                onClick={() => onChange(i, muted ? 1 : 0)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label={muted ? `Unmute channel ${i + 1}` : `Mute channel ${i + 1}`}
              >
                {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-h-0 flex items-center justify-center py-1">
                <Slider
                  orientation="vertical"
                  value={[vol]}
                  onValueChange={([v]) => onChange(i, v)}
                  min={0}
                  max={1.5}
                  step={0.01}
                  className="h-full"
                  aria-label={`Channel ${i + 1} volume`}
                />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground tabular-nums shrink-0">
                {Math.round(vol * 100)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const urlToStableKey = new Map<string, string>();

let _sharedAudioContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!_sharedAudioContext || _sharedAudioContext.state === 'closed') {
    _sharedAudioContext = new AudioContext();
  }
  return _sharedAudioContext;
}


const IDB_DB_NAME = 'audio-waveform-cache-v5';
const IDB_VERSION = 2;
const IDB_WAVEFORM_STORE = 'waveforms';
const IDB_AUDIO_STORE = 'audio-files';
const IDB_MAPPING_STORE = 'file-map';

interface IDBEntry {
  key: string;           
  duration: number;
  buffers: ArrayBuffer[]; 
  cachedAt: number;
}

const _dbReady: Promise<IDBDatabase> = new Promise((resolve, reject) => {
  try {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_WAVEFORM_STORE)) {
        db.createObjectStore(IDB_WAVEFORM_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(IDB_AUDIO_STORE)) {
        db.createObjectStore(IDB_AUDIO_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(IDB_MAPPING_STORE)) {
          db.createObjectStore(IDB_MAPPING_STORE, { keyPath: 'fileId' });
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  } catch (e) { reject(e); }
});
_dbReady.catch(() => {}); 

async function idbGetHash(fileId: string): Promise<string | null> {
   if (!fileId) return null; 
  const db = await _dbReady;
  return new Promise(resolve => {
    const req = db.transaction(IDB_MAPPING_STORE, 'readonly')
      .objectStore(IDB_MAPPING_STORE)
      .get(fileId);

    req.onsuccess = () => resolve(req.result?.hash ?? null);
    req.onerror = () => resolve(null);
  });
}

function idbSetHash(fileId: string, hash: string) {
  _dbReady.then(db => {
    const tx = db.transaction(IDB_MAPPING_STORE, 'readwrite');
    tx.objectStore(IDB_MAPPING_STORE).put({
      fileId,
      hash,
      updatedAt: Date.now()
    });
  });
}

async function idbGetAudio(key: string): Promise<Blob | null> {
  const db = await _dbReady;
  return new Promise((resolve) => {
    const req = db.transaction('audio-files', 'readonly')
      .objectStore('audio-files')
      .get(key);

    req.onsuccess = () => resolve(req.result?.blob ?? null);
    req.onerror = () => resolve(null);
  });
}

function idbPutAudio(key: string, blob: Blob): void {
  _dbReady.then(db => new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
    tx.objectStore(IDB_AUDIO_STORE).put({
      key,
      blob,
      cachedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  })).catch(() => {});
}

function idbGet(key: string): Promise<IDBEntry | null> {
  return _dbReady
    .then((db): Promise<IDBEntry | null> =>
      new Promise((resolve) => {
        const req = db
          .transaction(IDB_WAVEFORM_STORE, 'readonly')
          .objectStore(IDB_WAVEFORM_STORE)
          .get(key);
        req.onsuccess = () => resolve((req.result as IDBEntry) ?? null);
        req.onerror   = () => resolve(null);
      })
    )
    .catch(() => null);
}

function idbPut(entry: IDBEntry): void {
  _dbReady
    .then(db => new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_WAVEFORM_STORE, 'readwrite');
      tx.objectStore(IDB_WAVEFORM_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve();
    }))
    .catch(() => {});
}

function downsample(raw: Float32Array, targetLen: number): Float32Array {
  const step = Math.max(1, Math.floor(raw.length / targetLen));
  const out  = new Float32Array(targetLen); 
  for (let i = 0; i < targetLen; i++) {
    let peak = 0;
    const base = i * step;
    for (let j = 0; j < step; j++) {
      const v = Math.abs(raw[base + j] ?? 0);
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}

async function sha256hex(buf: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const PLAYBACK_PREFIX = 'audio-pos:';

function savePlaybackPosition(fileId: string, time: number) {
  try {
    localStorage.setItem(PLAYBACK_PREFIX + fileId, time.toString());
  } catch {}
}

function loadPlaybackPosition(fileId: string): number {
  try {
    const v = localStorage.getItem(PLAYBACK_PREFIX + fileId);
    return v ? parseFloat(v) : 0;
  } catch {
    return 0;
  }
}

async function idbLoad(hash: string): Promise<WaveformData | null> {
  const entry = await idbGet(hash);
  if (!entry) return null;
  const channels: Float32Array[] = [];
  for (const ab of entry.buffers) {
    if (!ab || ab.byteLength === 0 || ab.byteLength % 4 !== 0) return null; 
    channels.push(new Float32Array(ab));
  }
  if (channels.length === 0) return null;
  return { duration: entry.duration, channels };
}

function loadWaveform(url: string, fileId: string): Promise<WaveformData> {

  const urlKey = `file:${fileId}`;
  const inflight = inflightMap.get(urlKey);
  if (inflight) return inflight;

  const promise = (async (): Promise<WaveformData> => {

    let rawBuf: ArrayBuffer | null = null;
    let blob: Blob | null = null;

    let hash: string | null = await idbGetHash(fileId);

    if (hash) {
      const mem = memoryCache.get(hash);
      if (mem) {
        inflightMap.delete(urlKey);
        return mem;
      }
    }

    if (hash) {
      const idbData = await idbLoad(hash);
      if (idbData) {
        memoryCache.set(hash, idbData);
        inflightMap.delete(urlKey);
        return idbData; 
      }
    }

    if (hash) {
      const cachedBlob = await idbGetAudio(hash);
      if (cachedBlob) {
        blob = cachedBlob;
        rawBuf = await blob.arrayBuffer();
      }
    }

    if (!blob) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      blob = await resp.blob();
      rawBuf = await blob.arrayBuffer();
      hash = await sha256hex(rawBuf);
      await idbSetHash(fileId, hash);
      idbPutAudio(hash, blob);
    }

    const ac = getAudioContext();
    const audioBuffer = await ac.decodeAudioData(rawBuf!.slice(0));

    const dur = audioBuffer.duration;
    const targetLen = Math.min(
      TARGET_SAMPLES,
      audioBuffer.getChannelData(0).length
    );

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      channels.push(
        downsample(audioBuffer.getChannelData(ch), targetLen)
      );
    }

    const data: WaveformData = { duration: dur, channels };

    memoryCache.set(hash!, data);

    idbPut({
      key: hash!,
      duration: dur,
      buffers: channels.map(ch => ch.slice().buffer),
      cachedAt: Date.now(),
    });

    inflightMap.delete(urlKey);

    return data;
  })();

  inflightMap.set(urlKey, promise);
  promise.catch(() => inflightMap.delete(urlKey));

  return promise;
}


function computeLayers(annotations: AudioRegionAnnotation[]): Map<string, number> {
  const sorted = [...annotations].sort((a, b) => a.startTime - b.startTime);
  const layers = new Map<string, number>();
  const layerEnds: number[] = [];
  for (const ann of sorted) {
    let placed = false;
    for (let l = 0; l < layerEnds.length; l++) {
      if (ann.startTime >= layerEnds[l]) {
        layers.set(ann.id, l);
        layerEnds[l] = ann.endTime;
        placed = true;
        break;
      }
    }
    if (!placed) {
      layers.set(ann.id, layerEnds.length);
      layerEnds.push(ann.endTime);
    }
  }
  return layers;
}

interface WaveformCanvasProps {
  channelSamples: Float32Array[];
  duration: number;
  currentTime: number;
  annotations: AudioRegionAnnotation[];
  selectedId: string | null;
  verticalZoom: number;
  zoomLevel: number;
  onSeek: (t: number) => void;
  onRegionClick: (id: string) => void;
  onRegionDragEnd: (id: string, start: number, end: number) => void;
}

function WaveformCanvas({
  channelSamples,
  duration,
  currentTime,
  annotations,
  selectedId,
  verticalZoom,
  zoomLevel,
  onSeek,
  onRegionClick,
  onRegionDragEnd,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const [dragOverrides, setDragOverrides] = useState<Map<string, { startTime: number; endTime: number }>>(new Map());

  const [themeKey, setThemeKey] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeKey(k => k + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  const colors = useMemo(() => {
    const el = document.documentElement;
    const style = getComputedStyle(el);
    const primary = style.getPropertyValue('--primary').trim();
    const mutedFg = style.getPropertyValue('--muted-foreground').trim();
    const border = style.getPropertyValue('--border').trim();
    return {
      primary: primary ? `hsl(${primary})` : '#3b82f6',
      mutedFg30: mutedFg ? `hsla(${mutedFg}, 0.3)` : 'rgba(150,150,150,0.3)',
      mutedFg40: mutedFg ? `hsla(${mutedFg}, 0.4)` : 'rgba(150,150,150,0.4)',
      mutedFg20: mutedFg ? `hsla(${mutedFg}, 0.2)` : 'rgba(150,150,150,0.2)',
      border50: border ? `hsla(${border}, 0.5)` : 'rgba(150,150,150,0.5)',
    };
  }, [themeKey]);

  type DragState = {
    type: 'seek' | 'move' | 'resize-left' | 'resize-right';
    regionId?: string;
    startClientX: number;
    startTime: number;
    origStart?: number;
    origEnd?: number;
  };
  const dragRef = useRef<DragState | null>(null);

  const numChannels = Math.max(1, channelSamples.length);
  const waveformHeight = numChannels * CHANNEL_HEIGHT + (numChannels - 1) * CHANNEL_GAP;

  const mergedAnnotations = useMemo(() => {
    return annotations.map(ann => {
      const override = dragOverrides.get(ann.id);
      return override ? { ...ann, ...override } : ann;
    });
  }, [annotations, dragOverrides]);

  const layerMap = useMemo(() => computeLayers(mergedAnnotations), [mergedAnnotations]);
  const maxLayer = useMemo(() => {
    let max = 0;
    layerMap.forEach(l => { if (l > max) max = l; });
    return max;
  }, [layerMap]);

  const totalHeight = waveformHeight + (maxLayer + 1) * LAYER_HEIGHT;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver(([entry]) => {
      const dpr = window.devicePixelRatio || 1;
      const w = entry.contentRect.width;
      if (w === 0) return;
      const h = totalHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx?.scale(dpr, dpr);
      drawRef.current?.();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [totalHeight]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = parseFloat(canvas.style.width) || canvas.width / dpr;
    const H = totalHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const timeToX = (t: number) => duration > 0 ? (t / duration) * W : 0;
    const playedX = timeToX(currentTime);

    for (let ch = 0; ch < numChannels; ch++) {
      const samples = channelSamples[ch];
      const chY = ch * (CHANNEL_HEIGHT + CHANNEL_GAP);
      const chH = CHANNEL_HEIGHT;

      if (numChannels > 1) {
        ctx.fillStyle = colors.mutedFg40;
        ctx.font = '10px sans-serif';
        ctx.fillText(`Ch ${ch + 1}`, 4, chY + 12);
      }

      if (ch > 0) {
        ctx.strokeStyle = colors.border50;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, chY - CHANNEL_GAP / 2);
        ctx.lineTo(W, chY - CHANNEL_GAP / 2);
        ctx.stroke();
      }

      if (samples && samples.length > 0) {
        // Compute bar buckets against the BASELINE (un-zoomed) width so the
        // waveform shape stays identical at every zoom level — bars just
        // stretch horizontally. This keeps the waveform perfectly aligned
        // with segment overlays, which use the same (t / duration) * W mapping.
        const safeZoom = Math.max(1e-6, zoomLevel || 1);
        const baseW = W / safeZoom;
        const numBars = Math.max(1, Math.floor(baseW / BAR_UNIT));
        const stride = Math.max(1, Math.floor(samples.length / numBars));
        const slotW = W / numBars;
        const barW = Math.max(1, (BAR_WIDTH / BAR_UNIT) * slotW);
        for (let i = 0; i < numBars; i++) {
          let peak = 0;
          const base = i * stride;
          for (let j = 0; j < stride; j++) {
            const v = Math.abs(samples[base + j] ?? 0);
            if (v > peak) peak = v;
          }
          const scaledPeak = Math.min(1, peak * verticalZoom);
          const barH = Math.max(2, scaledPeak * chH * 0.85);
          const x = i * slotW;
          const played = x + barW <= playedX;
          ctx.fillStyle = played ? colors.primary : colors.mutedFg30;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, chY + (chH - barH) / 2, barW, barH, 1);
          } else {
            ctx.rect(x, chY + (chH - barH) / 2, barW, barH);
          }
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = colors.mutedFg20;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, chY + chH / 2);
        ctx.lineTo(W, chY + chH / 2);
        ctx.stroke();
      }
    }

    mergedAnnotations.forEach((ann) => {
      const color = (ann.color ?? 'blue') as TagColor;
      const x1 = timeToX(ann.startTime);
      const x2 = timeToX(ann.endTime);
      const isSelected = ann.id === selectedId;
      const layer = layerMap.get(ann.id) ?? 0;

      ctx.globalAlpha = 1;
      ctx.fillStyle = TAG_COLORS[color] ?? TAG_COLORS.blue;
      ctx.fillRect(x1, 0, x2 - x1, waveformHeight);

      const laneY = waveformHeight + layer * LAYER_HEIGHT;
      const laneH = LAYER_HEIGHT - 2;
      ctx.fillStyle = TAG_COLORS[color] ?? TAG_COLORS.blue;
      ctx.fillRect(x1, laneY, x2 - x1, laneH);

      ctx.strokeStyle = TAG_BORDER_COLORS[color] ?? TAG_BORDER_COLORS.blue;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(x1, laneY, x2 - x1, laneH);

      ctx.fillStyle = TAG_BORDER_COLORS[color] ?? TAG_BORDER_COLORS.blue;
      ctx.fillRect(x1, laneY, HANDLE_PX, laneH);
      ctx.fillRect(x2 - HANDLE_PX, laneY, HANDLE_PX, laneH);

      const labelText = ann.label || ann.speaker || '';
      if (labelText && (x2 - x1) > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.fillText(labelText, x1 + HANDLE_PX + 2, laneY + laneH / 2 + 4, x2 - x1 - HANDLE_PX * 2 - 4);
      }

      ctx.strokeStyle = TAG_BORDER_COLORS[color] ?? TAG_BORDER_COLORS.blue;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.setLineDash(isSelected ? [4, 4] : []);
      ctx.strokeRect(x1, 0, x2 - x1, waveformHeight);
      ctx.setLineDash([]);
    });

    ctx.globalAlpha = 1;

    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playedX, 0);
    ctx.lineTo(playedX, waveformHeight);
    ctx.stroke();

    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(playedX - 5, 0);
    ctx.lineTo(playedX + 5, 0);
    ctx.lineTo(playedX, 8);
    ctx.closePath();
    ctx.fill();
  }, [channelSamples, duration, currentTime, mergedAnnotations, selectedId, layerMap, totalHeight, verticalZoom, zoomLevel, numChannels, waveformHeight, colors]);

  useEffect(() => { drawRef.current = draw; }, [draw]);
  useEffect(() => { draw(); }, [draw]);

  const clientXToTime = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return 0;
    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  }, [duration]);

  type HitResult =
    | { type: 'resize-left' | 'resize-right' | 'move'; regionId: string }
    | { type: 'seek' };

  const hitTest = useCallback((clientX: number, clientY: number): HitResult => {
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return { type: 'seek' };
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const W = rect.width;
    const toX = (t: number) => (t / duration) * W;

    for (let i = mergedAnnotations.length - 1; i >= 0; i--) {
      const ann = mergedAnnotations[i];
      const x1 = toX(ann.startTime);
      const x2 = toX(ann.endTime);
      const layer = layerMap.get(ann.id) ?? 0;
      const laneY = waveformHeight + layer * LAYER_HEIGHT;
      const laneH = LAYER_HEIGHT - 2;

      const inLane = py >= laneY && py <= laneY + laneH && px >= x1 - 4 && px <= x2 + 4;
      const inWave = py < waveformHeight && px >= x1 - 4 && px <= x2 + 4;

      if (inLane || inWave) {
        const inLeft = px >= x1 - 4 && px <= x1 + HANDLE_PX + 2;
        const inRight = px >= x2 - HANDLE_PX - 2 && px <= x2 + 4;
        if (inLeft && inRight) {
          // For very small regions both handle zones overlap; pick the closer edge
          return Math.abs(px - x2) <= Math.abs(px - x1)
            ? { type: 'resize-right', regionId: ann.id }
            : { type: 'resize-left', regionId: ann.id };
        }
        if (inLeft) return { type: 'resize-left', regionId: ann.id };
        if (inRight) return { type: 'resize-right', regionId: ann.id };
        return { type: 'move', regionId: ann.id };
      }
    }
    return { type: 'seek' };
  }, [mergedAnnotations, duration, layerMap, waveformHeight]);

  const [cursor, setCursor] = useState('pointer');

  const resolveCursor = useCallback((clientX: number, clientY: number): string => {
    const hit = hitTest(clientX, clientY);
    if (hit.type === 'resize-left' || hit.type === 'resize-right') return 'ew-resize';
    if (hit.type === 'move') return 'grab';
    return 'pointer';
  }, [hitTest]);

  const dragOverridesRef = useRef<Map<string, { startTime: number; endTime: number }>>(new Map());
  useEffect(() => { dragOverridesRef.current = dragOverrides; }, [dragOverrides]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (duration === 0) return;
    if (e.button !== 0) return;
    const t = clientXToTime(e.clientX);
    const hit = hitTest(e.clientX, e.clientY);

    if (hit.type === 'seek') {
      onSeek(t);
      dragRef.current = { type: 'seek', startClientX: e.clientX, startTime: t };
      return;
    }

    const ann = mergedAnnotations.find(a => a.id === hit.regionId)!;
    dragRef.current = {
      type: hit.type,
      regionId: hit.regionId,
      startClientX: e.clientX,
      startTime: t,
      origStart: ann.startTime,
      origEnd: ann.endTime,
    };
    onRegionClick(hit.regionId);
    e.stopPropagation();
    e.preventDefault();

    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}

    const handleMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !drag.regionId) return;
      const tt = clientXToTime(ev.clientX);
      const dt = tt - drag.startTime;
      const origStart = drag.origStart!;
      const origEnd = drag.origEnd!;
      let newStart = origStart;
      let newEnd = origEnd;

      if (drag.type === 'move') {
        const len = origEnd - origStart;
        newStart = Math.max(0, Math.min(duration - len, origStart + dt));
        newEnd = newStart + len;
      } else if (drag.type === 'resize-left') {
        newStart = Math.max(0, Math.min(origEnd - MIN_REGION_S, origStart + dt));
        newEnd = origEnd;
      } else if (drag.type === 'resize-right') {
        newEnd = Math.max(origStart + MIN_REGION_S, Math.min(duration, origEnd + dt));
        newStart = origStart;
      }

      setDragOverrides(prev => {
        const next = new Map(prev);
        next.set(drag.regionId!, { startTime: newStart, endTime: newEnd });
        return next;
      });
    };

    const handleUp = (ev: PointerEvent) => {
      try { target.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', handleMove, true);
      window.removeEventListener('pointerup', handleUp, true);
      window.removeEventListener('pointercancel', handleUp, true);

      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag || !drag.regionId) {
        setDragOverrides(new Map());
        return;
      }
      const override = dragOverridesRef.current.get(drag.regionId);
      if (override) {
        onRegionDragEnd(drag.regionId, override.startTime, override.endTime);
      }
      setDragOverrides(new Map());
    };

    window.addEventListener('pointermove', handleMove, true);
    window.addEventListener('pointerup', handleUp, true);
    window.addEventListener('pointercancel', handleUp, true);
  }, [duration, clientXToTime, hitTest, onSeek, mergedAnnotations, onRegionClick, onRegionDragEnd]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) return;
    setCursor(resolveCursor(e.clientX, e.clientY));
  }, [resolveCursor]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'seek') {
      const t = clientXToTime(e.clientX);
      onSeek(t);
      dragRef.current = null;
      return;
    }
  }, [clientXToTime, onSeek]);

  const onPlayheadPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}

    const handleMove = (ev: PointerEvent) => {
      ev.stopPropagation();
      const t = clientXToTime(ev.clientX);
      onSeek(t);
    };
    const handleUp = (ev: PointerEvent) => {
      ev.stopPropagation();
      try { target.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener('pointermove', handleMove, true);
      window.removeEventListener('pointerup', handleUp, true);
      window.removeEventListener('pointercancel', handleUp, true);
    };
    window.addEventListener('pointermove', handleMove, true);
    window.addEventListener('pointerup', handleUp, true);
    window.addEventListener('pointercancel', handleUp, true);

    onSeek(clientXToTime(e.clientX));
  }, [duration, clientXToTime, onSeek]);

  const playheadX = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: totalHeight }}>
      <canvas
        ref={canvasRef}
        style={{ cursor, display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />
      {duration > 0 && (
        <div
          className="absolute top-0 pointer-events-none"
          style={{
            left: `${playheadX}%`,
            height: waveformHeight,
            zIndex: 50,
            transform: 'translateX(-50%)',
            width: 14,
          }}
        >
          <div
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 bg-primary"
            style={{ width: 2 }}
          />
        </div>
      )}
    </div>
  );
}

export function AudioAnnotationView({
  audioUrl,
  fileId,
  annotations,
  labels,
  activeLabel,
  activeColor,
  selectedAnnotation: selectedAnnotationProp,
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationSelect,
  renderSidebar,
  renderToolbar,
  projectLabels = [],
  projectLabelTypes = [],
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: AudioAnnotationViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const [isPlaying, setIsPlaying]               = useState(false);
  const [currentTime, setCurrentTime]           = useState(0);
  const [duration, setDuration]                 = useState(0);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<AudioRegionAnnotation | null>(null);
  const [startTimeStr, setStartTimeStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("");
  const [showShortcuts, setShowShortcuts]       = useState(false);
  const [waveformError, setWaveformError]       = useState<string | null>(null);
  const [channelSamples, setChannelSamples]     = useState<Float32Array[]>([]);
  const [isDecoding, setIsDecoding]             = useState(true);
  const [verticalZoom, setVerticalZoom]          = useState(1);
  const [playbackRate, setPlaybackRate]          = useState(1);
  const [loopRegion, setLoopRegion]              = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const waveformScrollRef = useRef<HTMLDivElement>(null);

  // Per-channel volume controls (0..1, where 1 = unity gain).
  // The audio element is routed through a Web Audio graph
  // (MediaElementSource → ChannelSplitter → GainNode[] → ChannelMerger → destination)
  // so each channel's gain can be adjusted independently without touching
  // decoding, buffering, or waveform rendering.
  const [channelVolumes, setChannelVolumes] = useState<number[]>([]);
  const channelGainsRef = useRef<GainNode[]>([]);
  const audioGraphRef = useRef<{
    source: MediaElementAudioSourceNode;
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    audioEl: HTMLAudioElement;
    channelCount: number;
  } | null>(null);

  useEffect(() => {
    setZoomLevel(1);
    const el = waveformScrollRef.current;
    if (el) el.scrollLeft = 0;
  }, [audioUrl]);

  useEffect(() => {
  if (!audioUrl) return;

  let revoked: string | null = null;

  (async () => {
    const knownHash = await idbGetHash(fileId);

    if (knownHash) {
      const blob = await idbGetAudio(knownHash);
      if (blob) {
        const url = URL.createObjectURL(blob);
        revoked = url;
        setAudioSrc(url);
        return;
      }
    }

    setAudioSrc(audioUrl);
  })();

  return () => {
    if (revoked) URL.revokeObjectURL(revoked);
  };
}, [audioUrl]);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 20;

  // Native non-passive wheel handler — attached via useEffect so that
  // preventDefault() actually blocks page scroll (React's synthetic onWheel
  // is passive by default in modern React/browsers). Also handles touchpad
  // pinch-to-zoom (ctrlKey === true on wheel).
  useEffect(() => {
    const container = waveformScrollRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      // Pinch-to-zoom on touchpad uses deltaY with ctrlKey === true.
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (delta === 0) return;

      // Always block the page from scrolling while the cursor is over the waveform.
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const scrollLeftBefore = container.scrollLeft;
      const contentXBefore = scrollLeftBefore + cursorX;

      setZoomLevel(prev => {
        const factor = delta < 0 ? 1.2 : 1 / 1.2;
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * factor));
        if (next === prev) return prev;

        const ratio = next / prev;
        const contentXAfter = contentXBefore * ratio;
        const newScrollLeft = contentXAfter - cursorX;

        requestAnimationFrame(() => {
          const el = waveformScrollRef.current;
          if (!el) return;
          const max = el.scrollWidth - el.clientWidth;
          el.scrollLeft = Math.max(0, Math.min(max, newScrollLeft));
        });
        return next;
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel as EventListener);
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = playbackRate;
  }, [playbackRate]);

  // Initialize per-channel volume state once channelSamples are known.
  // Default each channel to 1.0 (unity / no attenuation).
  useEffect(() => {
    const n = channelSamples.length;
    if (n === 0) return;
    setChannelVolumes(prev => {
      if (prev.length === n) return prev;
      const next = new Array(n).fill(1).map((v, i) => prev[i] ?? 1);
      return next;
    });
  }, [channelSamples]);

  // Build a Web Audio routing graph so each channel has its own GainNode.
  // This is purely additive — it does NOT alter audio decoding, buffering,
  // or the waveform rendering pipeline.
  useEffect(() => {
    const audioEl = audioRef.current;
    const channelCount = channelSamples.length;
    if (!audioEl || !audioSrc || channelCount === 0) return;

    const previousGraph = audioGraphRef.current && audioGraphRef.current.audioEl === audioEl
      ? audioGraphRef.current
      : null;
    const previousGains = channelGainsRef.current;

    let source: MediaElementAudioSourceNode;
    try {
      const ac = getAudioContext();
      // MediaElementSource can only be created once per element across the
      // lifetime of an AudioContext. Cache it on the element to be safe.
      const cached = (audioEl as unknown as { __vlMediaSource?: MediaElementAudioSourceNode }).__vlMediaSource;
      if (cached) {
        source = cached;
        try { source.disconnect(); } catch { /* noop */ }
      } else {
        source = ac.createMediaElementSource(audioEl);
        (audioEl as unknown as { __vlMediaSource?: MediaElementAudioSourceNode }).__vlMediaSource = source;
      }

      const splitter = ac.createChannelSplitter(channelCount);
      const merger = ac.createChannelMerger(channelCount);
      const gains: GainNode[] = [];
      for (let i = 0; i < channelCount; i++) {
        const g = ac.createGain();
        g.gain.value = channelVolumes[i] ?? 1;
        splitter.connect(g, i);
        // Send each channel to BOTH outputs of the merger so a muted/quieter
        // channel still affects both speakers (mono passthrough per channel).
        g.connect(merger, 0, 0);
        if (channelCount > 1) g.connect(merger, 0, 1 % channelCount);
        gains.push(g);
      }
      source.connect(splitter);
      merger.connect(ac.destination);

      // Rebuild succeeded — only now tear down the old graph and swap refs.
      if (previousGraph) {
        try { previousGraph.splitter.disconnect(); } catch { /* noop */ }
        try { previousGraph.merger.disconnect(); } catch { /* noop */ }
        previousGains.forEach(g => { try { g.disconnect(); } catch { /* noop */ } });
      }
      channelGainsRef.current = gains;
      audioGraphRef.current = { source, splitter, merger, audioEl, channelCount };
    } catch (err) {
      // If routing fails (e.g. context restrictions), fall back silently —
      // the audio element will play normally without per-channel control.
      console.warn('Per-channel audio routing unavailable:', err);
      audioGraphRef.current = null;
    }

    return () => {
      // Keep the cached MediaElementSource alive (cannot be recreated),
      // but disconnect downstream nodes so a re-init can rebuild cleanly.
      // Do NOT null audioGraphRef.current here — the next effect run will
      // replace it after a successful rebuild. Nulling on every cleanup
      // would tear down a working graph when audioSrc resolves async.
      const graph = audioGraphRef.current;
      if (graph && graph.audioEl === audioEl) {
        try { graph.source.disconnect(); } catch { /* noop */ }
        try { graph.splitter.disconnect(); } catch { /* noop */ }
        try { graph.merger.disconnect(); } catch { /* noop */ }
        channelGainsRef.current.forEach(g => { try { g.disconnect(); } catch { /* noop */ } });
      }
    };
    // We intentionally exclude channelVolumes here — gain values are applied
    // by the dedicated effect below to avoid rebuilding the graph on slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, channelSamples.length]);

  // Apply live volume changes to existing GainNodes without rebuilding the graph.
  useEffect(() => {
    const gains = channelGainsRef.current;
    if (gains.length === 0) return;
    const ac = _sharedAudioContext;
    const now = ac ? ac.currentTime : 0;
    for (let i = 0; i < gains.length; i++) {
      const v = channelVolumes[i] ?? 1;
      try {
        gains[i].gain.setTargetAtTime(v, now, 0.01);
      } catch {
        gains[i].gain.value = v;
      }
    }
  }, [channelVolumes]);

  const loopRegionRef = useRef(false);
  const selectedRegionIdRef = useRef<string | null>(null);
  useEffect(() => { loopRegionRef.current = loopRegion; }, [loopRegion]);
  useEffect(() => { selectedRegionIdRef.current = selectedRegionId; }, [selectedRegionId]);

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

  const effectiveLabels = useMemo(() => {
    if (projectLabels.length > 0) {
      return projectLabels.map(pl => {
        const typeName = projectLabelTypes.find(lt => lt.id === pl.label_type_id)?.name;
        return { id: pl.id, name: pl.name, color: pl.color as TagColor, labelTypeName: typeName };
      });
    }
    return labels.map(l => ({ id: l.id, name: l.name, color: l.color, labelTypeName: undefined as string | undefined }));
  }, [projectLabels, projectLabelTypes, labels]);

  useEffect(() => {
    if (selectedAnnotationProp !== selectedRegionId) {
      setSelectedRegionId(selectedAnnotationProp);
      if (selectedAnnotationProp) {
        const ann = audioAnnotations.find(a => a.id === selectedAnnotationProp);
        if (ann) {
          setEditingAnnotation({ ...ann });
          setStartTimeStr(formatTime(ann.startTime));
          setEndTimeStr(formatTime(ann.endTime));
          const el = audioRef.current;
          if (el) {
            el.currentTime = ann.startTime;
            setCurrentTime(ann.startTime);
          }
        }
      }
    }
  }, [selectedAnnotationProp]);

  const resolveColorForLabel = useCallback((labelName: string): TagColor => {
    const found = effectiveLabels.find(l => l.name === labelName);
    if (found) return found.color;
    return 'blue';
  }, [effectiveLabels]);

  const audioAnnotations = useMemo(
    () => annotations.filter((a): a is AudioRegionAnnotation => a.type === 'audioRegion'),
    [annotations]
  );

  const audioAnnotationsRef = useRef(audioAnnotations);
  useEffect(() => { audioAnnotationsRef.current = audioAnnotations; }, [audioAnnotations]);

  const isEditingTextRef = useRef(false);
  const pendingUpdateTimerRef = useRef<number | null>(null);
  const pendingAnnotationRef = useRef<AudioRegionAnnotation | null>(null);

  useEffect(() => {
    if (editingAnnotation && !isEditingTextRef.current) {
      const updated = audioAnnotations.find(a => a.id === editingAnnotation.id);
      if (updated && (
        updated.label !== editingAnnotation.label ||
        updated.color !== editingAnnotation.color ||
        updated.speaker !== editingAnnotation.speaker ||
        updated.transcript !== editingAnnotation.transcript
      )) {
        setEditingAnnotation({ ...updated });
        setStartTimeStr(formatTime(updated.startTime));
        setEndTimeStr(formatTime(updated.endTime));
      }
    }
  }, [audioAnnotations]);

  useEffect(() => {
    return () => {
      if (pendingUpdateTimerRef.current) {
        window.clearTimeout(pendingUpdateTimerRef.current);
        if (pendingAnnotationRef.current) {
          onAnnotationUpdate(pendingAnnotationRef.current);
        }
      }
    };
  }, []);

  const [activeFilters, setActiveFilters] = useState<Set<string> | null>(null);

  const uniqueLabels = useMemo(() => {
    const labelSet = new Map<string, TagColor>();
    audioAnnotations.forEach(a => {
      if (!labelSet.has(a.label)) {
        labelSet.set(a.label, (a.color as TagColor) || resolveColorForLabel(a.label));
      }
    });
    return Array.from(labelSet.entries()).map(([name, color]) => ({ name, color }));
  }, [audioAnnotations, resolveColorForLabel]);

  const filteredAnnotations = useMemo(() => {
    if (!activeFilters) return audioAnnotations;
    return audioAnnotations.filter(a => activeFilters.has(a.label));
  }, [audioAnnotations, activeFilters]);

  const toggleFilter = useCallback((labelName: string) => {
    setActiveFilters(prev => {
      if (!prev) {
        return new Set([labelName]);
      }
      const next = new Set(prev);
      if (next.has(labelName)) {
        next.delete(labelName);
        return next.size === 0 ? null : next;
      }
      next.add(labelName);
      return next;
    });
  }, []);


  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;

    const stableKey = urlToStableKey.get(audioUrl);
    if (stableKey) {
      const l1 = memoryCache.get(stableKey);
      if (l1) {
        setDuration(l1.duration);
        setChannelSamples(l1.channels);
        setIsDecoding(false);
        return;
      }
    }

    setIsDecoding(true);
    setWaveformError(null);
    setChannelSamples([]);


    loadWaveform(audioUrl,fileId).then(data => {
      if (cancelled) return;
      setDuration(data.duration);
      setChannelSamples(data.channels);
      setIsDecoding(false);

      }).catch(err => {
      if (cancelled) return;
      console.error('Audio decode error:', err);
      setWaveformError('Failed to load audio waveform. The file may be corrupted or unsupported.');
      setIsDecoding(false);
    });

    

    return () => { cancelled = true; };
  }, [audioUrl]);

  const rafRef = useRef(0);

  useEffect(() => {
    if (!fileId) return;

    const interval = setInterval(() => {
      const el = audioRef.current;
      if (!el) return;

      savePlaybackPosition(fileId, el.currentTime);
    }, 1000); 

    return () => clearInterval(interval);
  }, [fileId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onDuration = () => { if (!isNaN(el.duration)) setDuration(el.duration); };
    const onPlay     = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      if (audioRef.current) {
        savePlaybackPosition(fileId, audioRef.current.currentTime);
      }
    };

    el.addEventListener('durationchange', onDuration);
    el.addEventListener('play',  onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onPause);

    return () => {
      el.removeEventListener('durationchange', onDuration);
      el.removeEventListener('play',  onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onPause);
    };
  }, []);

  useEffect(() => {
  const handler = () => {
    if (audioRef.current) {
      savePlaybackPosition(fileId, audioRef.current.currentTime);
    }
  };

  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [fileId]);

useEffect(() => {
  const el = audioRef.current;
  if (!el || !fileId) return;

  const handleLoadedMetadata = () => {
    const savedTime = loadPlaybackPosition(fileId);

    if (savedTime > 0 && savedTime < el.duration) {
      el.currentTime = savedTime;
      setCurrentTime(savedTime);
    }
  };

  el.addEventListener('loadedmetadata', handleLoadedMetadata);

  return () => {
    el.removeEventListener('loadedmetadata', handleLoadedMetadata);
  };
}, [fileId, audioSrc]);

useEffect(() => {
  const handleVisibility = () => {
    const el = audioRef.current;
    if (!el) return;

    if (document.hidden) {
      if (!el.paused) {
        el.pause();
      }

      savePlaybackPosition(fileId, el.currentTime);

      setIsPlaying(false);
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, [fileId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      let active = true;
      const tick = () => {
        if (!active) return;
        if (loopRegionRef.current && selectedRegionIdRef.current) {
          const sel = audioAnnotationsRef.current.find(a => a.id === selectedRegionIdRef.current);
          if (sel && el.currentTime >= sel.endTime - 0.01) {
            el.currentTime = sel.startTime;
          }
        }
        setCurrentTime(el.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => { active = false; cancelAnimationFrame(rafRef.current); };
    } else {
      setCurrentTime(el.currentTime);
    }
  }, [isPlaying]);

  // Ensure the shared AudioContext is running and the per-channel graph is
  // wired to destination before each playback. Browsers start AudioContexts
  // suspended until a user gesture explicitly resumes them — without this,
  // the <audio> element plays but every sample is routed into a suspended
  // context and produces no sound (until a tab switch accidentally resumes).
  const ensureAudioReadyForPlayback = useCallback(async () => {
    try {
      const ac = getAudioContext();
      if (ac.state !== 'running') {
        await ac.resume();
      }
      // Reconnect merger → destination defensively. Web Audio throws if the
      // edge already exists; swallow it. If it was torn down, this restores
      // the path so audio reaches the speakers on this play.
      try { audioGraphRef.current?.merger.connect(ac.destination); } catch { /* already connected */ }
    } catch { /* ignore */ }
  }, []);

  const togglePlayPause = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;

    if (el.paused) {
      await ensureAudioReadyForPlayback();
      try {
        const p = el.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {});
        }
      } catch { /* ignore */ }
    } else {
      el.pause();
    }
  }, [ensureAudioReadyForPlayback]);

  const seekTo = useCallback((t: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = t;
    setCurrentTime(t);
  }, []);

  const skipBack    = useCallback(() => seekTo(Math.max(0,        currentTime - 2)), [seekTo, currentTime]);
  const skipForward = useCallback(() => seekTo(Math.min(duration, currentTime + 2)), [seekTo, currentTime, duration]);

  const handleRegionDragEnd = useCallback((id: string, start: number, end: number) => {
    const ann = audioAnnotations.find(a => a.id === id);
    if (!ann) return;
    onAnnotationUpdate({ ...ann, startTime: start, endTime: end });
    setEditingAnnotation(prev => {
      if (prev?.id === id) {
        const u = { ...prev, startTime: start, endTime: end };
        setStartTimeStr(formatTime(start));
        setEndTimeStr(formatTime(end));
        return u;
      }
      return prev;
    });
  }, [audioAnnotations, onAnnotationUpdate]);

  const handleRegionClick = useCallback((id: string) => {
    setSelectedRegionId(id);
    onAnnotationSelect(id);
    const ann = audioAnnotations.find(a => a.id === id);
    if (ann) {
      setEditingAnnotation({ ...ann });
      setStartTimeStr(formatTime(ann.startTime));
      setEndTimeStr(formatTime(ann.endTime));
      const el = audioRef.current;
      if (el) {
        try {
          el.currentTime = ann.startTime;
          setCurrentTime(ann.startTime);
          ensureAudioReadyForPlayback().then(() => {
            try {
              const p = el.play();
              if (p && typeof (p as Promise<void>).catch === 'function') {
                (p as Promise<void>).catch(() => {});
              }
            } catch { /* ignore */ }
          });
        } catch { }
      }
    }
  }, [audioAnnotations, onAnnotationSelect, ensureAudioReadyForPlayback]);

  const createRegionAtPlayhead = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    const time = el.currentTime;
    const startTime = time;
    const endTime   = Math.min(startTime + 3, el.duration || duration);
    const defaultLabelName = activeLabel || effectiveLabels[0]?.name || 'Region';
    const defaultColor = activeColor || resolveColorForLabel(defaultLabelName);

    const newAnnotation: AudioRegionAnnotation = {
      id: crypto.randomUUID(),
      type: 'audioRegion',
      startTime,
      endTime,
      transcript: '',
      speaker: 'Speaker 1',
      language: 'English',
      emotion: 'neutral',
      label: defaultLabelName,
      color: defaultColor,
    };

    onAnnotationCreate(newAnnotation);
    setSelectedRegionId(newAnnotation.id);
    setEditingAnnotation({ ...newAnnotation });
    setStartTimeStr(formatTime(newAnnotation.startTime));
    setEndTimeStr(formatTime(newAnnotation.endTime));
  }, [effectiveLabels, activeLabel, activeColor, onAnnotationCreate, duration, resolveColorForLabel]);

  const [newSegmentDurationStr, setNewSegmentDurationStr] = useState<string>('3');

  const createRegionAtPlayheadWithDuration = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    if (!Number.isFinite(seconds) || seconds <= 0) return;

    const startTime = el.currentTime;
    const maxEnd = el.duration || duration;
    const endTime = Math.min(startTime + seconds, maxEnd);
    if (endTime <= startTime) return;

    const defaultLabelName = activeLabel || effectiveLabels[0]?.name || 'Region';
    const defaultColor = activeColor || resolveColorForLabel(defaultLabelName);

    const newAnnotation: AudioRegionAnnotation = {
      id: crypto.randomUUID(),
      type: 'audioRegion',
      startTime,
      endTime,
      transcript: '',
      speaker: 'Speaker 1',
      language: 'English',
      emotion: 'neutral',
      label: defaultLabelName,
      color: defaultColor,
    };

    onAnnotationCreate(newAnnotation);
    setSelectedRegionId(newAnnotation.id);
    setEditingAnnotation({ ...newAnnotation });
    setStartTimeStr(formatTime(newAnnotation.startTime));
    setEndTimeStr(formatTime(newAnnotation.endTime));
  }, [effectiveLabels, activeLabel, activeColor, onAnnotationCreate, duration, resolveColorForLabel]);

  const saveCurrentRegion = useCallback(() => {
    if (!editingAnnotation) return;
    if (pendingUpdateTimerRef.current) {
      window.clearTimeout(pendingUpdateTimerRef.current);
      pendingUpdateTimerRef.current = null;
      pendingAnnotationRef.current = null;
      isEditingTextRef.current = false;
    }
    onAnnotationUpdate(editingAnnotation);
    seekTo(editingAnnotation.endTime);
    setEditingAnnotation(null);
    setSelectedRegionId(null);
    onAnnotationSelect(null);
  }, [editingAnnotation, onAnnotationUpdate, seekTo, onAnnotationSelect]);

  const deleteRegion = useCallback((id: string) => {
    onAnnotationDelete(id);
    if (selectedRegionId === id) {
      setSelectedRegionId(null);
      setEditingAnnotation(null);
    }
  }, [onAnnotationDelete, selectedRegionId]);

  const handleFieldChange = (field: keyof AudioRegionAnnotation, value: string) => {
    if (!editingAnnotation) return;
    const updated = { ...editingAnnotation, [field]: value };
    if (field === 'label') {
      updated.color = resolveColorForLabel(value);
    }
    setEditingAnnotation(updated);

    const isTextField = field === 'transcript' || field === 'speaker';
    if (isTextField) {
      isEditingTextRef.current = true;
      pendingAnnotationRef.current = updated;
      if (pendingUpdateTimerRef.current) {
        window.clearTimeout(pendingUpdateTimerRef.current);
      }
      pendingUpdateTimerRef.current = window.setTimeout(() => {
        if (pendingAnnotationRef.current) {
          onAnnotationUpdate(pendingAnnotationRef.current);
          pendingAnnotationRef.current = null;
        }
        pendingUpdateTimerRef.current = null;
        isEditingTextRef.current = false;
      }, 350);
    } else {
      if (pendingUpdateTimerRef.current) {
        window.clearTimeout(pendingUpdateTimerRef.current);
        pendingUpdateTimerRef.current = null;
        pendingAnnotationRef.current = null;
        isEditingTextRef.current = false;
      }
      onAnnotationUpdate(updated);
    }
  };

  const handleTimeCommit = (field: 'startTime' | 'endTime') => {
    if (!editingAnnotation) return;
    const raw = field === 'startTime' ? startTimeStr : endTimeStr;
    const t = parseTimeString(raw);
    if (t === null || t < 0 || t > duration) {
      if (field === 'startTime') setStartTimeStr(formatTime(editingAnnotation.startTime));
      else setEndTimeStr(formatTime(editingAnnotation.endTime));
      return;
    }
    if (field === 'startTime' && t >= editingAnnotation.endTime) {
      setStartTimeStr(formatTime(editingAnnotation.startTime));
      return;
    }
    if (field === 'endTime' && t <= editingAnnotation.startTime) {
      setEndTimeStr(formatTime(editingAnnotation.endTime));
      return;
    }
    const updated = { ...editingAnnotation, [field]: t };
    setEditingAnnotation(updated);
    if (field === 'startTime') setStartTimeStr(formatTime(t));
    else setEndTimeStr(formatTime(t));
    onAnnotationUpdate(updated);
  };

  useEffect(() => {
  const handleVisibility = () => {
    const el = audioRef.current;
    if (!el) return;
    setIsPlaying(!el.paused);
  };

  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, []);

useEffect(() => {
  const el = audioRef.current;
  if (!el) return;

  const onEnded = () => {
    setIsPlaying(false);
  };

  el.addEventListener("ended", onEnded);
  return () => el.removeEventListener("ended", onEnded);
}, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      // Treat focused sliders (e.g. amplitude, playback speed) as inputs so
      // their arrow-key adjustments don't also trigger global skip/seek.
      const isSlider = target.getAttribute('role') === 'slider' || !!target.closest('[role="slider"]');
      const blockGlobal = isInput || isSlider;

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ' && !blockGlobal) {
        e.preventDefault();
        if (e.shiftKey) {
          if (onRedo && canRedo) onRedo();
        } else {
          if (onUndo && canUndo) onUndo();
        }
        return;
      }

      if (e.code === 'Space' && !blockGlobal) {
        e.preventDefault(); togglePlayPause();
      } else if (e.code === 'KeyS' && !blockGlobal && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); createRegionAtPlayhead();
      } else if (e.code === 'Enter' && !blockGlobal) {
        e.preventDefault(); saveCurrentRegion();
      } else if (e.code === 'ArrowLeft' && !blockGlobal) {
        e.preventDefault(); skipBack();
      } else if (e.code === 'ArrowRight' && !blockGlobal) {
        e.preventDefault(); skipForward();
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && !blockGlobal && selectedRegionId) {
        e.preventDefault(); deleteRegion(selectedRegionId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, createRegionAtPlayhead, saveCurrentRegion, skipBack, skipForward, deleteRegion, selectedRegionId, onUndo, onRedo, canUndo, canRedo]);

  return (
    <div
      ref={fullscreenRef}
      className={cn(
        "flex-1 flex flex-col min-h-0 overflow-hidden",
        isFullscreen && "bg-background w-full h-full"
      )}
    >
      {isFullscreen && renderToolbar && (
        <div className="px-4 py-2 border-b border-border flex justify-center shrink-0">
          {renderToolbar()}
        </div>
      )}

      <div className={cn("flex-1 flex min-h-0 overflow-hidden")}>
      <div className="flex-1 flex flex-col gap-4 overflow-auto p-2">

      <div className="bg-card border border-border rounded-xl p-4">

        {waveformError ? (
          <div className="flex flex-col items-center justify-center min-h-[160px] gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground max-w-md">{waveformError}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        ) : (
          <div className="relative w-full rounded-lg overflow-hidden flex items-stretch">
            {isDecoding && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                <span className="text-xs text-muted-foreground animate-pulse">Decoding audio…</span>
              </div>
            )}
            {/* Per-channel volume sliders — rendered to the LEFT of the
                waveform area (NOT overlapping). Each slider matches the
                exact height of its channel using the same constants as the
                waveform canvas (CHANNEL_HEIGHT / CHANNEL_GAP). Pure UI;
                audio routing is handled by the Web Audio graph above. */}
            {channelSamples.length > 0 && channelVolumes.length === channelSamples.length && (
              <ChannelVolumeOverlay
                channelVolumes={channelVolumes}
                onChange={(idx, v) =>
                  setChannelVolumes(prev => {
                    const next = prev.slice();
                    next[idx] = v;
                    return next;
                  })
                }
                rulerHeight={22}
              />
            )}
            {/* Horizontal scroll container — visual zoom only. Mouse wheel zooms
                anchored at the cursor; the inner element is scaled in width so
                the existing waveform/segment rendering pipeline is untouched. */}
            <div
              ref={waveformScrollRef}
              className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden"
              style={{ overscrollBehaviorX: 'contain' }}
            >
              <div className="relative" style={{ width: `${zoomLevel * 100}%` }}>
                <AudioTimeRuler duration={duration} height={22} />
                <WaveformCanvas
                  channelSamples={channelSamples}
                  duration={duration}
                  currentTime={currentTime}
                  annotations={filteredAnnotations}
                  selectedId={selectedRegionId}
                  verticalZoom={verticalZoom}
                  zoomLevel={zoomLevel}
                  onSeek={seekTo}
                  onRegionClick={handleRegionClick}
                  onRegionDragEnd={handleRegionDragEnd}
                />
                {/* Ruler-area playhead extension — dedicated drag handle above the waveform.
                    Sits over the ruler so users can always grab and scrub even when
                    segments are underneath on the waveform. Does NOT touch any audio
                    decoding/buffering/rendering code. */}
                {duration > 0 && (
                  <RulerPlayhead
                    duration={duration}
                    currentTime={currentTime}
                    rulerHeight={22}
                    onSeek={seekTo}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <audio ref={audioRef} src={audioSrc ?? undefined} preload="auto" crossOrigin="anonymous" />

        {!waveformError && (
          <>
            <div className="flex items-center gap-3 mt-3 px-1">
              <div className="flex items-center gap-2 flex-1">
                <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Amplitude</span>
                <Slider
                  value={[verticalZoom]}
                  onValueChange={([v]) => setVerticalZoom(v)}
                  min={0.5}
                  max={20}
                  step={0.5}
                  className="w-32"
                />
                <span className="text-xs text-muted-foreground font-mono w-10">{verticalZoom}x</span>
              </div>
              {channelSamples.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  {channelSamples.length} channels
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 items-center mt-3 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-mono text-muted-foreground tabular-nums w-16">
                  {formatTime(currentTime)}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setPlaybackRate(1)}
                        className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors w-12 text-right tabular-nums shrink-0"
                        aria-label="Reset playback speed to 1x"
                      >
                        {playbackRate.toFixed(2)}x
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Click to reset to 1x</TooltipContent>
                  </Tooltip>
                  <Slider
                    value={[playbackRate]}
                    min={0.25}
                    max={3}
                    step={0.05}
                    onValueChange={(v) => setPlaybackRate(v[0])}
                    className="w-28"
                    aria-label="Playback speed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={skipBack} className="h-9 w-9">
                      <SkipBack className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Skip back 2s (←)</TooltipContent>
                </Tooltip>

                <Button size="icon" onClick={togglePlayPause} className="h-10 w-10 rounded-full">
                  {isPlaying
                    ? <Pause className="h-5 w-5" />
                    : <Play  className="h-5 w-5 ml-0.5" />}
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={skipForward} className="h-9 w-9">
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Skip forward 2s (→)</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center justify-end gap-2">
                {onUndo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="h-9 w-9"
                        aria-label="Undo"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Undo (Ctrl/Cmd+Z)</TooltipContent>
                  </Tooltip>
                )}

                {onRedo && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRedo}
                        disabled={!canRedo}
                        className="h-9 w-9"
                        aria-label="Redo"
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Redo (Ctrl/Cmd+Shift+Z)</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={loopRegion ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setLoopRegion(v => !v)}
                      className="h-9 w-9"
                      aria-pressed={loopRegion}
                      aria-label="Loop selected region"
                    >
                      <Repeat className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {loopRegion ? "Looping selected region — click to disable" : "Loop selected region"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowShortcuts(v => !v)}
                      className={cn("h-8 w-8", showShortcuts && "bg-primary text-primary-foreground")}
                    >
                      <Keyboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Keyboard shortcuts</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleFullscreen}
                      className="h-8 w-8"
                    >
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
                </Tooltip>

                <span className="text-sm font-mono text-muted-foreground tabular-nums w-16 text-right">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {showShortcuts && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg grid grid-cols-3 gap-2 text-xs">
                <div><kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px]">Space</kbd> Play/Pause</div>
                <div><kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px]">S</kbd> New region</div>
                <div><kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px]">Enter</kbd> Save region</div>
                <div><kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px]">←</kbd> Back 2s</div>
                <div><kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px]">→</kbd> Forward 2s</div>
                <div><kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px]">Del</kbd> Delete region</div>
              </div>
            )}
          </>
        )}
      </div>

      {uniqueLabels.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>
          <button
            onClick={() => setActiveFilters(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              !activeFilters
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
            )}
          >
            All ({audioAnnotations.length})
          </button>
          {uniqueLabels.map(({ name, color }) => {
            const isActive = activeFilters?.has(name) ?? false;
            const matching = audioAnnotations.filter(a => a.label === name);
            const count = matching.length;
            const totalSeconds = matching.reduce((sum, a) => {
              const d = Math.max(0, (a.endTime ?? 0) - (a.startTime ?? 0));
              return sum + d;
            }, 0);
            const mins = Math.floor(totalSeconds / 60);
            const secs = Math.round(totalSeconds - mins * 60);
            const durationLabel = `${mins}m ${secs}s`;
            return (
              <div key={name} className="relative group">
                <button
                  onClick={() => toggleFilter(name)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                    isActive
                      ? "bg-primary/10 text-foreground border-primary/40"
                      : !activeFilters
                        ? "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                        : "bg-secondary/30 text-muted-foreground/60 border-border/50 hover:bg-secondary/50"
                  )}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", TAG_COLOR_DOT[color])} />
                  {name}
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
                <div
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap"
                  style={{
                    background: "#1c2128",
                    border: "1px solid #30363d",
                    borderRadius: "8px",
                    padding: "8px 10px",
                  }}
                >
                  <div className="flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between gap-4">
                      <span style={{ color: "#8b949e" }}>Duration</span>
                      <span style={{ color: "#ffffff" }}>{durationLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span style={{ color: "#8b949e" }}>Segments</span>
                      <span style={{ color: "#ffffff" }}>{count}</span>
                    </div>
                  </div>
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderTop: "5px solid #30363d",
                    }}
                  />
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{
                      top: "100%",
                      marginTop: "-1px",
                      width: 0,
                      height: 0,
                      borderLeft: "4px solid transparent",
                      borderRight: "4px solid transparent",
                      borderTop: "4px solid #1c2128",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={createRegionAtPlayhead} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          New Region at Playhead
        </Button>
        <span className="text-xs text-muted-foreground">
          or press <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px]">S</kbd> — regions can overlap
        </span>
      </div>

      {editingAnnotation && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Editing Region
            </h4>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteRegion(editingAnnotation.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete region (Del)</TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="sm" onClick={saveCurrentRegion}>
                Save & Advance
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Time</label>
              <Input
                value={startTimeStr}
                onChange={e => setStartTimeStr(e.target.value)}
                onBlur={() => handleTimeCommit('startTime')}
                onKeyDown={e => { if (e.key === 'Enter') handleTimeCommit('startTime'); }}
                placeholder="0:00.00"
                className="text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Time</label>
              <Input
                value={endTimeStr}
                onChange={e => setEndTimeStr(e.target.value)}
                onBlur={() => handleTimeCommit('endTime')}
                onKeyDown={e => { if (e.key === 'Enter') handleTimeCommit('endTime'); }}
                placeholder="0:00.00"
                className="text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Transcript</label>
              <Textarea
                value={editingAnnotation.transcript}
                onChange={e => handleFieldChange('transcript', e.target.value)}
                placeholder="Type transcript..."
                className="text-sm min-h-[40px] resize-y"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Segment Duration</label>
              <Input
                value={`${Math.max(0, editingAnnotation.endTime - editingAnnotation.startTime).toFixed(2)}s`}
                readOnly
                tabIndex={-1}
                className="text-sm font-mono bg-muted/40 cursor-default"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Label</label>
              <Select
                value={effectiveLabels.find(l => l.name === editingAnnotation.label)?.id || editingAnnotation.label}
                onValueChange={v => {
                  const matched = effectiveLabels.find(l => l.id === v);
                  if (matched) {
                    handleFieldChange('label', matched.name);
                  }
                }}
              >
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {effectiveLabels.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="flex flex-col">
                        <span>{l.name}</span>
                        {l.labelTypeName && (
                          <span className="text-[10px] text-muted-foreground leading-tight">{l.labelTypeName}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Language</label>
              <Select value={editingAnnotation.language} onValueChange={v => handleFieldChange('language', v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">New segment (sec)</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={newSegmentDurationStr}
                  onChange={e => setNewSegmentDurationStr(e.target.value)}
                  placeholder="3"
                  className="text-sm font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => createRegionAtPlayheadWithDuration(parseFloat(newSegmentDurationStr))}
                  title="Create segment from playhead with this duration"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {isFullscreen && renderSidebar && renderSidebar()}
      {!isFullscreen && renderSidebar && renderSidebar()}
      </div>
    </div>
  );
}