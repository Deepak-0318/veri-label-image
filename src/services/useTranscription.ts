import { useState, useEffect, useRef, useCallback } from "react";
import {
  AudioApi,
  TranscriptionJob,
  TranscriptionSegment,
  StartTranscriptionOptions,
  isBackendConfigured,
  connectTranscriptionHub,
  subscribeToJob,
} from "./apiClient";

export interface UseTranscriptionReturn {
  job: TranscriptionJob | null;
  segments: TranscriptionSegment[];
  isLoading: boolean;
  currentStep: string;
  progress: number;
  error: string | null;
  isAvailable: boolean;
  transcribe: (opts?: Partial<StartTranscriptionOptions>) => Promise<void>;
  cancelJob: () => Promise<void>;
  fetchSegments: () => Promise<void>;
}

export function useTranscription(
  audioFileId: string,
  token: string | null
): UseTranscriptionReturn {
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const disconnectRef = useRef<(() => Promise<void>) | null>(null);
  const isAvailable = isBackendConfigured();

  const fetchSegments = useCallback(async () => {
    if (!token || !isAvailable) return;
    try {
      const data = await AudioApi.getSegments(audioFileId, token);
      setSegments(data);
    } catch {
      // Segments not available yet — that's fine
    }
  }, [audioFileId, token, isAvailable]);

  // Fetch existing segments on mount
  useEffect(() => {
    if (token && isAvailable) {
      fetchSegments();
    }
  }, [fetchSegments, token, isAvailable]);

  // Cleanup hub on unmount
  useEffect(() => {
    return () => {
      disconnectRef.current?.();
    };
  }, []);

  const transcribe = useCallback(
    async (opts?: Partial<StartTranscriptionOptions>) => {
      if (!token) {
        setError("Authentication required.");
        return;
      }

      setIsLoading(true);
      setError(null);
      setProgress(0);
      setCurrentStep("Initializing…");

      try {
        // Disconnect previous hub if any
        await disconnectRef.current?.();

        const disconnect = await connectTranscriptionHub(token, {
          onProgress: (_jobId, step, pct) => {
            setCurrentStep(step);
            setProgress(pct);
          },
          onComplete: async (_jobId) => {
            setCurrentStep("Complete");
            setProgress(100);
            setIsLoading(false);
            await fetchSegments();
          },
          onFailed: (_jobId, err) => {
            setError(err);
            setIsLoading(false);
          },
        });
        disconnectRef.current = disconnect;

        const newJob = await AudioApi.startTranscription(
          {
            audioFileId,
            enableDiarization: opts?.enableDiarization ?? true,
            enableSentiment: opts?.enableSentiment ?? true,
            language: opts?.language,
          },
          token
        );

        setJob(newJob);
        await subscribeToJob(newJob.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed.");
        setIsLoading(false);
      }
    },
    [audioFileId, token, fetchSegments]
  );

  const cancel = useCallback(async () => {
    if (!token || !job) return;
    try {
      await AudioApi.cancelJob(job.id, token);
      setIsLoading(false);
      setCurrentStep("");
      setProgress(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job.");
    }
  }, [token, job]);

  return {
    job,
    segments,
    isLoading,
    currentStep,
    progress,
    error,
    isAvailable,
    transcribe,
    cancelJob: cancel,
    fetchSegments,
  };
}
