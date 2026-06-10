import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranscription } from "@/services/useTranscription";
import { AudioApi, TranscriptionSegment } from "@/services/apiClient";
import {
  Mic,
  Download,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface TranscriptionPanelProps {
  audioFileId: string;
  token: string | null;
  onSegmentClick?: (segment: TranscriptionSegment) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptionPanel({
  audioFileId,
  token,
  onSegmentClick,
}: TranscriptionPanelProps) {
  const {
    segments,
    isLoading,
    currentStep,
    progress,
    error,
    isAvailable,
    transcribe,
  } = useTranscription(audioFileId, token);

  const [enableDiarization, setEnableDiarization] = useState(true);
  const [enableSentiment, setEnableSentiment] = useState(true);

  if (!isAvailable) return null;

  const hasSegments = segments.length > 0;

  const handleExport = async (format: "webvtt" | "srt" | "json" | "csv") => {
    if (!token) return;
    try {
      const blobUrl = await AudioApi.exportAudio(audioFileId, format, token);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `transcription.${format}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Export failed silently
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            AI Transcription
          </h3>
        </div>
        {hasSegments && (
          <div className="flex gap-1">
            {(["webvtt", "srt", "json", "csv"] as const).map((fmt) => (
              <Button
                key={fmt}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => handleExport(fmt)}
              >
                <Download className="mr-1 h-3 w-3" />
                {fmt.toUpperCase()}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={enableDiarization}
            onCheckedChange={(v) => setEnableDiarization(v === true)}
            disabled={isLoading}
          />
          Speaker identification
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={enableSentiment}
            onCheckedChange={(v) => setEnableSentiment(v === true)}
            disabled={isLoading}
          />
          Sentiment analysis
        </label>
      </div>

      {/* Action */}
      <Button
        onClick={() =>
          transcribe({ enableDiarization, enableSentiment })
        }
        disabled={isLoading || !token}
        size="sm"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : hasSegments ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-transcribe
          </>
        ) : (
          <>
            <Mic className="mr-2 h-4 w-4" />
            Transcribe with AI
          </>
        )}
      </Button>

      {/* Progress */}
      {isLoading && (
        <div className="flex flex-col gap-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{currentStep}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Segments */}
      {hasSegments && (
        <ScrollArea className="max-h-64">
          <div className="flex flex-col gap-1">
            {segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => onSegmentClick?.(seg)}
                className="flex items-start gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="mt-0.5 shrink-0 text-[10px] font-mono text-muted-foreground">
                  {formatTime(seg.startTime)}
                </span>
                {seg.speaker && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-[10px]"
                    style={
                      seg.speaker.color
                        ? { backgroundColor: seg.speaker.color, color: "#fff" }
                        : undefined
                    }
                  >
                    {seg.speaker.label}
                  </Badge>
                )}
                <span className="flex-1 text-xs text-foreground">
                  {seg.text}
                </span>
                {seg.sentiment && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {seg.sentiment.label}{" "}
                    <span className="font-mono">
                      {seg.sentiment.score.toFixed(2)}
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
