import * as signalR from "@microsoft/signalr";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Speaker {
  id: string;
  label: string;
  color: string;
}

export interface TranscriptionSegment {
  id: string;
  audioFileId: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker: Speaker | null;
  sentiment: { label: string; score: number } | null;
  confidence: number;
}

export interface TranscriptionJob {
  id: string;
  audioFileId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  currentStep: string | null;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartTranscriptionOptions {
  audioFileId: string;
  enableDiarization?: boolean;
  enableSentiment?: boolean;
  language?: string;
}

export interface SentimentAnalysisResult {
  overallSentiment: string;
  overallScore: number;
  segments: { segmentId: string; label: string; score: number }[];
}

export interface ApiAnnotation {
  id: string;
  fileId: string;
  type: string;
  label: string;
  color: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

export function isBackendConfigured(): boolean {
  return typeof BASE_URL === "string" && BASE_URL.trim().length > 0;
}

function getBaseUrl(): string {
  if (!isBackendConfigured()) {
    throw new Error(
      "Backend is not configured. Set VITE_API_BASE_URL to enable AI features."
    );
  }
  return BASE_URL!.replace(/\/+$/, "");
}

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Audio API ────────────────────────────────────────────────────────────────

export const AudioApi = {
  async startTranscription(
    opts: StartTranscriptionOptions,
    token: string
  ): Promise<TranscriptionJob> {
    const res = await fetch(`${getBaseUrl()}/api/audio/transcribe`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(opts),
    });
    return handleResponse<TranscriptionJob>(res);
  },

  async getJobStatus(jobId: string, token: string): Promise<TranscriptionJob> {
    const res = await fetch(`${getBaseUrl()}/api/audio/jobs/${jobId}`, {
      headers: authHeaders(token),
    });
    return handleResponse<TranscriptionJob>(res);
  },

  async cancelJob(jobId: string, token: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/audio/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body || res.statusText}`);
    }
  },

  async getSegments(
    audioFileId: string,
    token: string
  ): Promise<TranscriptionSegment[]> {
    const res = await fetch(
      `${getBaseUrl()}/api/audio/${audioFileId}/segments`,
      { headers: authHeaders(token) }
    );
    return handleResponse<TranscriptionSegment[]>(res);
  },

  async analyseSentiment(
    audioFileId: string,
    token: string,
    segmentIds?: string[]
  ): Promise<SentimentAnalysisResult> {
    const res = await fetch(
      `${getBaseUrl()}/api/audio/${audioFileId}/sentiment`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ segmentIds }),
      }
    );
    return handleResponse<SentimentAnalysisResult>(res);
  },

  async exportAudio(
    audioFileId: string,
    format: "json" | "csv" | "webvtt" | "srt",
    token: string
  ): Promise<string> {
    const res = await fetch(
      `${getBaseUrl()}/api/audio/${audioFileId}/export?format=${format}`,
      { headers: authHeaders(token) }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body || res.statusText}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

// ─── Annotation API ──────────────────────────────────────────────────────────

export const AnnotationApi = {
  async getAnnotations(
    fileId: string,
    token: string
  ): Promise<ApiAnnotation[]> {
    const res = await fetch(`${getBaseUrl()}/api/annotations?fileId=${fileId}`, {
      headers: authHeaders(token),
    });
    return handleResponse<ApiAnnotation[]>(res);
  },

  async create(
    annotation: Omit<ApiAnnotation, "id" | "createdAt" | "updatedAt">,
    token: string
  ): Promise<ApiAnnotation> {
    const res = await fetch(`${getBaseUrl()}/api/annotations`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(annotation),
    });
    return handleResponse<ApiAnnotation>(res);
  },

  async update(
    id: string,
    patch: Partial<ApiAnnotation>,
    token: string
  ): Promise<ApiAnnotation> {
    const res = await fetch(`${getBaseUrl()}/api/annotations/${id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    });
    return handleResponse<ApiAnnotation>(res);
  },

  async delete(id: string, token: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/annotations/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body || res.statusText}`);
    }
  },

  async batchDelete(ids: string[], token: string): Promise<void> {
    const res = await fetch(`${getBaseUrl()}/api/annotations/batch-delete`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${body || res.statusText}`);
    }
  },
};

// ─── SignalR Hub ──────────────────────────────────────────────────────────────

interface TranscriptionHubCallbacks {
  onProgress?: (jobId: string, step: string, progress: number) => void;
  onComplete?: (jobId: string) => void;
  onFailed?: (jobId: string, error: string) => void;
}

let _connection: signalR.HubConnection | null = null;

export async function connectTranscriptionHub(
  token: string,
  callbacks: TranscriptionHubCallbacks
): Promise<() => Promise<void>> {
  const url = `${getBaseUrl()}/hubs/transcription`;

  _connection = new signalR.HubConnectionBuilder()
    .withUrl(url, { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  if (callbacks.onProgress) {
    _connection.on("TranscriptionProgress", callbacks.onProgress);
  }
  if (callbacks.onComplete) {
    _connection.on("TranscriptionComplete", callbacks.onComplete);
  }
  if (callbacks.onFailed) {
    _connection.on("TranscriptionFailed", callbacks.onFailed);
  }

  await _connection.start();

  return async () => {
    if (_connection) {
      await _connection.stop();
      _connection = null;
    }
  };
}

export async function subscribeToJob(jobId: string): Promise<void> {
  if (!_connection || _connection.state !== signalR.HubConnectionState.Connected) {
    throw new Error("SignalR hub is not connected. Call connectTranscriptionHub first.");
  }
  await _connection.invoke("SubscribeToJob", jobId);
}
