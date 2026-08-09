import { appEnvironment } from "@/lib/environment";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogContext = {
  tenantId?: string | null;
  churchId?: string | null;
  userId?: string | null;
  workspace?: string | null;
  route?: string | null;
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
};

export type StructuredLogEntry = LogContext & {
  level: LogLevel;
  message: string;
  timestamp: string;
  environment: string;
};

const productionConsoleLevels = new Set<LogLevel>(["error", "fatal"]);

function getCurrentRoute() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: import.meta.env.DEV ? error.stack : undefined,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { message: "Unknown error", value: error };
}

export function createLogEntry(level: LogLevel, message: string, context: LogContext = {}): StructuredLogEntry {
  return {
    ...context,
    route: context.route ?? getCurrentRoute(),
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: appEnvironment,
  };
}

function print(entry: StructuredLogEntry) {
  if (import.meta.env.PROD && !productionConsoleLevels.has(entry.level)) return;

  const label = `[Kanisa:${entry.level}] ${entry.message}`;

  if (entry.level === "fatal" || entry.level === "error") {
    console.error(label, entry);
    return;
  }

  if (entry.level === "warn") {
    console.warn(label, entry);
    return;
  }

  if (entry.level === "debug") {
    if (import.meta.env.DEV) console.debug(label, entry);
    return;
  }

  if (import.meta.env.DEV) console.info(label, entry);
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = createLogEntry(level, message, context);
  print(entry);
  return entry;
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    log("error", message, {
      ...context,
      metadata: {
        ...(context?.metadata ?? {}),
        error: normalizeError(error),
      },
    }),
  fatal: (message: string, error?: unknown, context?: LogContext) =>
    log("fatal", message, {
      ...context,
      metadata: {
        ...(context?.metadata ?? {}),
        error: normalizeError(error),
      },
    }),
};
