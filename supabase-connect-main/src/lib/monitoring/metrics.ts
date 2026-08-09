export type MetricName =
  | "login_success"
  | "login_failure"
  | "api_failure"
  | "rpc_failure"
  | "contribution_submission"
  | "prayer_request_submission"
  | "mass_intention_submission"
  | "calendar_load"
  | "bible_search"
  | "dashboard_load_duration"
  | string;

export type MetricEntry = {
  name: MetricName;
  value: number;
  timestamp: string;
  tags?: Record<string, string | number | boolean | null | undefined>;
};

const metricsBuffer: MetricEntry[] = [];
const MAX_METRICS = 250;

function pushMetric(entry: MetricEntry) {
  metricsBuffer.push(entry);

  if (metricsBuffer.length > MAX_METRICS) {
    metricsBuffer.splice(0, metricsBuffer.length - MAX_METRICS);
  }

  return entry;
}

export function incrementMetric(name: MetricName, tags?: MetricEntry["tags"]) {
  return pushMetric({
    name,
    value: 1,
    timestamp: new Date().toISOString(),
    tags,
  });
}

export function recordMetric(name: MetricName, value: number, tags?: MetricEntry["tags"]) {
  return pushMetric({
    name,
    value,
    timestamp: new Date().toISOString(),
    tags,
  });
}

export function recordDurationMetric(name: MetricName, durationMs: number, tags?: MetricEntry["tags"]) {
  return recordMetric(name, Math.round(durationMs), {
    ...tags,
    unit: "ms",
  });
}

export function getBufferedMetrics() {
  return [...metricsBuffer];
}

export function clearBufferedMetrics() {
  metricsBuffer.length = 0;
}
