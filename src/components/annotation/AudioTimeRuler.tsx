import { useEffect, useRef, useState } from "react";

interface AudioTimeRulerProps {
  /** Total audio duration in seconds. */
  duration: number;
  /** Optional zoom multiplier (1 = fits container). Reserved for future horizontal zoom. */
  zoom?: number;
  /** Height of the ruler bar in px. */
  height?: number;
}

/**
 * Independent UI-only ruler that renders time markers above the waveform.
 *
 * - Reads only `duration` (and optional `zoom`) from props.
 * - Does NOT touch any audio decoding/buffering/rendering code.
 * - Marker density adapts to the available pixel width per second.
 */
export function AudioTimeRuler({ duration, zoom = 1, height = 22 }: AudioTimeRulerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalWidth = Math.max(0, width * (zoom || 1));
  const safeDuration = duration > 0 ? duration : 0;
  const pxPerSecond = safeDuration > 0 ? totalWidth / safeDuration : 0;

  // Choose a "nice" major step (in seconds) so labels don't overlap.
  // Aim for at least ~70px between major labeled ticks.
  const niceSteps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  let majorStep = niceSteps[niceSteps.length - 1];
  if (pxPerSecond > 0) {
    for (const s of niceSteps) {
      if (s * pxPerSecond >= 70) { majorStep = s; break; }
    }
  }
  // Minor ticks: 5 subdivisions per major when there's room, else 2, else none.
  let minorDivisions = 1;
  if (pxPerSecond > 0) {
    if ((majorStep / 5) * pxPerSecond >= 8) minorDivisions = 5;
    else if ((majorStep / 2) * pxPerSecond >= 8) minorDivisions = 2;
  }
  const minorStep = majorStep / minorDivisions;

  const formatLabel = (t: number): string => {
    if (majorStep < 1) {
      // sub-second precision (e.g. 0.5s ticks)
      return `${t.toFixed(majorStep < 0.5 ? 2 : 1)}s`;
    }
    if (t < 60) return `${Math.round(t)}s`;
    const m = Math.floor(t / 60);
    const s = Math.round(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const ticks: { x: number; major: boolean; label?: string }[] = [];
  if (safeDuration > 0 && pxPerSecond > 0 && minorStep > 0) {
    const epsilon = minorStep / 1000;
    for (let t = 0; t <= safeDuration + epsilon; t += minorStep) {
      const x = t * pxPerSecond;
      const isMajor = Math.abs(t / majorStep - Math.round(t / majorStep)) < 0.001;
      ticks.push({
        x,
        major: isMajor,
        label: isMajor ? formatLabel(t) : undefined,
      });
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none border-b border-border/60 bg-muted/30"
      style={{ height }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="relative h-full" style={{ width: totalWidth }}>
          {ticks.map((tick, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{ left: tick.x }}
            >
              <div
                className={tick.major ? "w-px bg-muted-foreground/70" : "w-px bg-muted-foreground/30"}
                style={{ height: tick.major ? height * 0.55 : height * 0.3 }}
              />
              {tick.label && (
                <span
                  className="absolute top-[55%] text-[10px] leading-none font-mono text-muted-foreground whitespace-nowrap"
                  style={{ left: 2 }}
                >
                  {tick.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
