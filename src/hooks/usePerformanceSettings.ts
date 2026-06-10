import { useState, useEffect, useCallback } from "react";

export type PerformanceLevel = "high" | "mid" | "low";

export interface PerformanceProfile {
  level: PerformanceLevel;
  frameCacheSize: number;
  decodeBatchSize: number;
  hardwareAcceleration: HardwarePreference;
  yieldInterval: number; // yield to main thread every N frames
  lowMemory: boolean; // convert frames to JPEG data URLs instead of holding ImageBitmaps
  maxVideoFrames: number; // cap total video frames decoded
}

export type HardwarePreference = "prefer-hardware" | "prefer-software" | "no-preference";

const PROFILES: Record<PerformanceLevel, PerformanceProfile> = {
  high: {
    level: "high",
    frameCacheSize: 150,
    decodeBatchSize: 30,
    hardwareAcceleration: "prefer-hardware",
    yieldInterval: 4,
    lowMemory: false,
    maxVideoFrames: Infinity,
  },
  mid: {
    level: "mid",
    frameCacheSize: 60,
    decodeBatchSize: 15,
    hardwareAcceleration: "prefer-hardware",
    yieldInterval: 2,
    lowMemory: false,
    maxVideoFrames: Infinity,
  },
  low: {
    level: "low",
    frameCacheSize: 20,
    decodeBatchSize: 8,
    hardwareAcceleration: "prefer-software",
    yieldInterval: 1,
    lowMemory: true,
    maxVideoFrames: Infinity,
  },
};

const STORAGE_KEY = "datamuse_performance_level";

export function getPerformanceProfile(level?: PerformanceLevel): PerformanceProfile {
  const stored = level ?? (localStorage.getItem(STORAGE_KEY) as PerformanceLevel | null) ?? "high";
  return PROFILES[stored] ?? PROFILES.high;
}

export function usePerformanceSettings() {
  const [level, setLevelState] = useState<PerformanceLevel>(() => {
    return (localStorage.getItem(STORAGE_KEY) as PerformanceLevel | null) ?? "high";
  });

  const profile = PROFILES[level];

  const setLevel = useCallback((newLevel: PerformanceLevel) => {
    localStorage.setItem(STORAGE_KEY, newLevel);
    setLevelState(newLevel);
  }, []);

  return { level, setLevel, profile };
}
