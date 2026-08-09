import { supabase } from "@/integrations/supabase/client";
import { captureSentryException, captureSentryMessage } from "./sentry";

export type ErrorLogLevel = "error" | "warning" | "info";
type PrintableLogLevel = ErrorLogLevel | "debug";

export type ErrorLogContext = {
  component?: string;
  page?: string;
  route?: string;
  function?: string;
  church_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
};

type NormalizedLog = {
  level: PrintableLogLevel;
  message: string;
  stack: string | null;
  context: ErrorLogContext;
};

export const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const NETWORK_ERROR_MESSAGE = "We could not reach the server. Check your internet connection and try again.";
export const PERMISSION_ERROR_MESSAGE = "You do not have permission to perform this action.";
export const SESSION_ERROR_MESSAGE = "Your session may have expired. Please sign in again.";

const MAX_MESSAGE_LENGTH = 1_000;
const MAX_STACK_LENGTH = 8_000;
const MAX_METADATA_LENGTH = 6_000;
const LOGGER_SESSION_KEY = "app-error-logger-session-id";

function truncateText(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...[truncated]` : value;
}

function getLoggerSessionId() {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.sessionStorage.getItem(LOGGER_SESSION_KEY);
    if (existing) return existing;

    const next = crypto.randomUUID();
    window.sessionStorage.setItem(LOGGER_SESSION_KEY, next);
    return next;
  } catch {
    return "unavailable";
  }
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  const withSession = {
    ...(metadata ?? {}),
    logger_session_id: getLoggerSessionId(),
  };

  try {
    const serialized = JSON.stringify(withSession);
    if (serialized.length <= MAX_METADATA_LENGTH) return withSession;

    return {
      logger_session_id: withSession.logger_session_id,
      truncated: true,
      preview: serialized.slice(0, MAX_METADATA_LENGTH),
    };
  } catch {
    return {
      logger_session_id: getLoggerSessionId(),
      serialization_failed: true,
    };
  }
}

function getRoute() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
}

function getBrowserInfo() {
  if (typeof window === "undefined") return "server";
  return window.navigator.userAgent;
}

function normalizeError(error: unknown, context?: ErrorLogContext): NormalizedLog {
  if (error instanceof Error) {
    return {
      level: "error",
      message: truncateText(error.message || "Unknown application error", MAX_MESSAGE_LENGTH) ?? "Unknown application error",
      stack: truncateText(error.stack, MAX_STACK_LENGTH),
      context: context ?? {},
    };
  }

  if (typeof error === "string") {
    return {
      level: "error",
      message: truncateText(error, MAX_MESSAGE_LENGTH) ?? "Unknown application error",
      stack: null,
      context: context ?? {},
    };
  }

  return {
    level: "error",
    message: "Unknown application error",
    stack: null,
    context: {
      ...(context ?? {}),
      metadata: {
        ...(context?.metadata ?? {}),
        raw_error: error,
      },
    },
  };
}

function printDevelopmentLog(log: NormalizedLog) {
  if (!import.meta.env.DEV) return;

  const label = `[${log.level.toUpperCase()}]`;
  const details = [
    label,
    `Page: ${log.context.page ?? ""}`,
    `Component: ${log.context.component ?? ""}`,
    `Function: ${log.context.function ?? ""}`,
    `Message: ${log.message}`,
    `Stack: ${log.stack ?? ""}`,
  ].join("\n");

  if (log.level === "error") {
    console.error(details);
    return;
  }

  if (log.level === "warning") {
    console.warn(details);
    return;
  }

  if (log.level === "debug") {
    console.debug(details);
    return;
  }

  console.info(details);
}

async function writeLog(log: NormalizedLog) {
  if (log.level === "debug") return;

  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = log.context.user_id ?? authData.user?.id ?? null;
    const route = log.context.route ?? getRoute();

    const payload = {
      p_level: log.level,
      p_message: log.message,
      p_stack: log.stack,
      p_page: log.context.page ?? null,
      p_route: route,
      p_component: log.context.component ?? null,
      p_function_name: log.context.function ?? null,
      p_church_id: log.context.church_id ?? null,
      p_user_id: userId,
      p_metadata: sanitizeMetadata(log.context.metadata),
      p_browser_info: getBrowserInfo(),
    };

    await supabase.rpc("log_app_error" as never, payload as never);
  } catch {
    // Logging must never block or break user actions.
  }
}

function enqueueLog(log: NormalizedLog) {
  printDevelopmentLog(log);
  void writeLog(log);
}

export function logError(error: unknown, context?: ErrorLogContext) {
  const log = normalizeError(error, context);
  enqueueLog(log);
  captureSentryException(error, context);
}

export function logWarning(message: string, context?: ErrorLogContext) {
  const log: NormalizedLog = {
    level: "warning",
    message: truncateText(message, MAX_MESSAGE_LENGTH) ?? "Warning",
    stack: null,
    context: context ?? {},
  };
  enqueueLog(log);
  captureSentryMessage(message, context);
}

export function logInfo(message: string, context?: ErrorLogContext) {
  enqueueLog({
    level: "info",
    message: truncateText(message, MAX_MESSAGE_LENGTH) ?? "Info",
    stack: null,
    context: context ?? {},
  });
}

export function logDebug(message: string, context?: ErrorLogContext) {
  if (!import.meta.env.DEV) return;

  printDevelopmentLog({
    level: "debug",
    message: truncateText(message, MAX_MESSAGE_LENGTH) ?? "Debug",
    stack: null,
    context: context ?? {},
  });
}

export function captureException(error: unknown, context?: ErrorLogContext) {
  logError(error, context);
}

export function logSupabaseError(
  error: unknown,
  context?: ErrorLogContext & { operation?: string; table?: string; rpc?: string; bucket?: string },
) {
  logError(error, {
    ...context,
    metadata: {
      ...(context?.metadata ?? {}),
      operation: context?.operation,
      table: context?.table,
      rpc: context?.rpc,
      bucket: context?.bucket,
    },
  });
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error_description === "string") return record.error_description;
    if (typeof record.details === "string") return record.details;
  }
  return "";
}

function isUserSafeValidationMessage(message: string) {
  return /\b(required|must|please|already exists|not found|invalid|too large|smaller|sign in)\b/i.test(message);
}

export function getUserFriendlyErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  const message = readErrorMessage(error).trim();
  if (!message) return fallback;

  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("networkerror") ||
    lowerMessage.includes("network request failed") ||
    lowerMessage.includes("connection")
  ) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (
    lowerMessage.includes("jwt") ||
    lowerMessage.includes("session") ||
    lowerMessage.includes("auth session") ||
    lowerMessage.includes("refresh token")
  ) {
    return SESSION_ERROR_MESSAGE;
  }

  if (
    lowerMessage.includes("permission denied") ||
    lowerMessage.includes("not authorized") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("row-level security")
  ) {
    return PERMISSION_ERROR_MESSAGE;
  }

  if (isUserSafeValidationMessage(message)) {
    return message;
  }

  return fallback;
}
