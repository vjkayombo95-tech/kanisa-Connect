import { supabase } from "@/integrations/supabase/client";

export type WorkerHealth = {
  worker_id?: string;
  worker_type?: string;
  status?: string;
  current_job_id?: string | null;
  last_seen_at?: string;
  health?: "online" | "stale" | "missing" | string;
};

export type OperationalEvent = {
  id: string;
  event_type: string;
  severity: "debug" | "info" | "warning" | "error" | "critical";
  source: string;
  message: string | null;
  job_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type OperationsMetrics = {
  queueDepth: number;
  processingJobs: number;
  failedJobs: number;
  averageProcessingSeconds: number;
  storageBytes: number;
  publishedAudioCount: number;
  pendingReviews: number;
  averageQaConfidence: number;
  errorRate: number;
  workerStatus: WorkerHealth;
  pythonWorkerStatus: WorkerHealth;
  recentEvents: OperationalEvent[];
};

export type OperationsCheck = {
  status: "ok" | "warning" | "error" | string;
  message?: string;
  checkedAt?: string;
  [key: string]: unknown;
};

export type OperationsHealth = {
  database?: OperationsCheck;
  storage?: OperationsCheck;
  edgeFunctions?: OperationsCheck;
  queue?: OperationsCheck;
  worker?: WorkerHealth;
  pythonWorker?: WorkerHealth;
  metrics?: OperationsMetrics;
};

const emptyMetrics: OperationsMetrics = {
  queueDepth: 0,
  processingJobs: 0,
  failedJobs: 0,
  averageProcessingSeconds: 0,
  storageBytes: 0,
  publishedAudioCount: 0,
  pendingReviews: 0,
  averageQaConfidence: 0,
  errorRate: 0,
  workerStatus: { health: "missing", status: "unknown" },
  pythonWorkerStatus: { health: "missing", status: "unknown" },
  recentEvents: [],
};

function normalizeMetrics(value: unknown): OperationsMetrics {
  const data = (value ?? {}) as Partial<OperationsMetrics>;
  return {
    ...emptyMetrics,
    ...data,
    queueDepth: Number(data.queueDepth ?? 0),
    processingJobs: Number(data.processingJobs ?? 0),
    failedJobs: Number(data.failedJobs ?? 0),
    averageProcessingSeconds: Number(data.averageProcessingSeconds ?? 0),
    storageBytes: Number(data.storageBytes ?? 0),
    publishedAudioCount: Number(data.publishedAudioCount ?? 0),
    pendingReviews: Number(data.pendingReviews ?? 0),
    averageQaConfidence: Number(data.averageQaConfidence ?? 0),
    errorRate: Number(data.errorRate ?? 0),
    workerStatus: data.workerStatus ?? emptyMetrics.workerStatus,
    pythonWorkerStatus: data.pythonWorkerStatus ?? emptyMetrics.pythonWorkerStatus,
    recentEvents: Array.isArray(data.recentEvents) ? data.recentEvents : [],
  };
}

export async function fetchOperationsMetrics(churchId: string): Promise<OperationsMetrics> {
  const { data, error } = await supabase.functions.invoke("operations-metrics", {
    body: { churchId },
  });

  if (error) throw error;
  return normalizeMetrics((data as { metrics?: unknown } | null)?.metrics);
}

export async function fetchOperationsHealth(churchId: string): Promise<OperationsHealth> {
  const { data, error } = await supabase.functions.invoke("operations-health", {
    body: { churchId },
  });

  if (error) throw error;
  const health = ((data as { health?: OperationsHealth } | null)?.health ?? {}) as OperationsHealth;
  return {
    ...health,
    metrics: normalizeMetrics(health.metrics),
  };
}
