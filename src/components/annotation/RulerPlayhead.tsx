import { useCallback, useRef } from "react";

interface RulerPlayheadProps {
  /** Audio duration in seconds (already known in the UI layer). */
  duration: number;
  /** Current playback time in seconds (already known in the UI layer). */
  currentTime: number;
  /** Height of the time ruler bar above the waveform. */
  rulerHeight: number;
  /** Seek callback — same one already wired to the waveform. */
  onSeek: (t: number) => void;
}

/**
 * Independent UI-only playhead extension that sits over the time ruler and
 * acts as a dedicated drag handle for scrubbing. It is rendered ABSOLUTELY
 * over the parent container (which holds the ruler + waveform) and only
 * occupies the ruler's vertical band, so it never overlaps the waveform's
 * own playhead area or its segments.
 *
 * Strictly UI: does not import or touch any audio decoding/buffering/
 * rendering code. Only reads `duration`, `currentTime`, and the existing
 * `onSeek` callback already used by the waveform.
 */
export function RulerPlayhead({ duration, currentTime, rulerHeight, onSeek }: RulerPlayheadProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const clientXToTime = useCallback((clientX: number): number => {
    const el = wrapperRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(duration, ratio * duration));
  }, [duration]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}

    // Seek immediately on click anywhere in the ruler band.
    onSeek(clientXToTime(e.clientX));

    const handleMove = (ev: PointerEvent) => {
      ev.stopPropagation();
      onSeek(clientXToTime(ev.clientX));
    };
    const handleUp = (ev: PointerEvent) => {
      ev.stopPropagation();
      try { target.releasePointerCapture(ev.pointerId); } catch {}
      window.removeEventListener("pointermove", handleMove, true);
      window.removeEventListener("pointerup", handleUp, true);
      window.removeEventListener("pointercancel", handleUp, true);
    };
    window.addEventListener("pointermove", handleMove, true);
    window.addEventListener("pointerup", handleUp, true);
    window.addEventListener("pointercancel", handleUp, true);
  }, [duration, clientXToTime, onSeek]);

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      className="absolute left-0 right-0 top-0"
      style={{
        height: rulerHeight,
        // Sit above ruler ticks but only spans ruler vertical band, so the
        // waveform area below is untouched and segments stay interactive.
        zIndex: 60,
        // Allow scrub-on-click anywhere across the ruler width.
        pointerEvents: "auto",
        cursor: "ew-resize",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      aria-label="Playhead — drag to scrub"
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
    >
      {/* Vertical playhead line through the ruler — visually continuous
          with the waveform's existing playhead line just below. */}
      <div
        className="absolute top-0 bottom-0 bg-primary pointer-events-none"
        style={{
          left: `${playheadPct}%`,
          width: 2,
          transform: "translateX(-1px)",
        }}
      />
      {/* Larger triangular handle at the very top of the ruler. */}
      <div
        className="absolute top-0 bg-primary pointer-events-none"
        style={{
          left: `${playheadPct}%`,
          width: 14,
          height: Math.min(12, rulerHeight),
          transform: "translateX(-50%)",
          clipPath: "polygon(50% 100%, 0 0, 100% 0)",
        }}
      />
    </div>
  );
}
