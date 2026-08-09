import { logger, type LogContext } from "./logger";
import { getNow } from "./performance";

export type TraceSpan = {
  id: string;
  name: string;
  startedAt: number;
  context?: LogContext;
};

function createTraceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `trace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function startTrace(name: string, context?: LogContext): TraceSpan {
  const span = {
    id: createTraceId(),
    name,
    startedAt: getNow(),
    context,
  };

  logger.debug("Trace started", {
    ...context,
    metadata: {
      ...(context?.metadata ?? {}),
      traceId: span.id,
      traceName: name,
    },
  });

  return span;
}

export function finishTrace(span: TraceSpan, metadata?: Record<string, unknown>) {
  const durationMs = Math.round(getNow() - span.startedAt);

  logger.debug("Trace finished", {
    ...span.context,
    metadata: {
      ...(span.context?.metadata ?? {}),
      ...metadata,
      traceId: span.id,
      traceName: span.name,
      durationMs,
    },
  });

  return durationMs;
}

export async function traceAsync<T>(name: string, action: () => Promise<T>, context?: LogContext) {
  const span = startTrace(name, context);

  try {
    const result = await action();
    finishTrace(span, { status: "success" });
    return result;
  } catch (error) {
    finishTrace(span, { status: "error" });
    logger.error("Traced operation failed", error, {
      ...context,
      metadata: {
        ...(context?.metadata ?? {}),
        traceId: span.id,
        traceName: name,
      },
    });
    throw error;
  }
}
