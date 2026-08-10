export type AuthorizationFailureClassification =
  | "NETWORK"
  | "TIMEOUT"
  | "OFFLINE"
  | "HTTP_AUTH"
  | "DATABASE"
  | "CONTEXT_INVALID"
  | "UNKNOWN";

export type AuthorizationBootstrapStage =
  | "AUTH_SESSION_STARTED"
  | "AUTH_SESSION_OK"
  | "AUTH_SESSION_FAILED"
  | "CONTEXT_RPC_STARTED"
  | "CONTEXT_RPC_OK"
  | "CONTEXT_RPC_FAILED"
  | "AUTHORIZATION_READY"
  | "AUTHORIZATION_FAILED"
  | "REALTIME_AUTH_STARTED"
  | "REALTIME_AUTH_OK"
  | "REALTIME_AUTH_FAILED"
  | "REALTIME_CHANNEL_STATUS";

export const AUTH_CONTEXT_TIMEOUT_MS = 12_000;
export const AUTH_CONTEXT_MAX_ATTEMPTS = 3;

type AuthorizationAttemptEvent = {
  attempt: number;
  phase: "started" | "succeeded" | "failed";
  durationMs?: number;
  classification?: AuthorizationFailureClassification;
  error?: unknown;
};

export class AuthorizationBootstrapError extends Error {
  readonly classification: AuthorizationFailureClassification;
  readonly causeValue: unknown;

  constructor(message: string, classification: AuthorizationFailureClassification, causeValue?: unknown) {
    super(message);
    this.name = "AuthorizationBootstrapError";
    this.classification = classification;
    this.causeValue = causeValue;
  }
}

function errorRecord(error: unknown) {
  return error && typeof error === "object" ? error as Record<string, unknown> : null;
}

function authorizationErrorText(error: unknown) {
  const record = errorRecord(error);
  const cause = errorRecord(record?.cause);
  return [
    error instanceof Error ? error.message : record?.message ?? error,
    record?.details,
    cause?.message,
    typeof record?.cause === "string" ? record.cause : undefined,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function classifyAuthorizationFailure(
  error: unknown,
  navigatorOnline = typeof navigator === "undefined" ? true : navigator.onLine,
): AuthorizationFailureClassification {
  if (error instanceof AuthorizationBootstrapError) return error.classification;

  const record = errorRecord(error);
  const message = authorizationErrorText(error);
  const status = Number(record?.status ?? record?.statusCode ?? 0);
  const code = String(record?.code ?? "").toLowerCase();

  if (message.includes("timed out") || message.includes("timeout") || error instanceof DOMException && error.name === "TimeoutError") return "TIMEOUT";
  if (!navigatorOnline) return "OFFLINE";
  if (/failed to fetch|networkerror|network request failed|fetch failed|load failed/.test(message)) return "NETWORK";
  if (status === 401 || status === 403 || code === "401" || code === "403" || message.includes("jwt")) return "HTTP_AUTH";
  if (code) return "DATABASE";
  return "UNKNOWN";
}

export function isTransientAuthorizationFailure(classification: AuthorizationFailureClassification) {
  return classification === "NETWORK" || classification === "TIMEOUT" || classification === "OFFLINE";
}

export function shouldPreserveVerifiedAuthorization(
  classification: AuthorizationFailureClassification,
  hasVerifiedAuthorization: boolean,
) {
  return hasVerifiedAuthorization && isTransientAuthorizationFailure(classification);
}

export function shouldEnableAuthorizationConsoleDiagnostics(appEnvironment: string, viteDev: boolean) {
  return viteDev || appEnvironment === "development" || appEnvironment === "staging";
}

export function isActiveAuthorizationLoad(requestSequence: number, activeSequence: number) {
  return requestSequence === activeSequence;
}

export function safeAuthorizationDiagnostic(error: unknown) {
  const record = errorRecord(error);
  return {
    supabaseErrorCode: typeof record?.code === "string" ? record.code : undefined,
    httpStatus: typeof record?.status === "number" ? record.status : undefined,
  };
}

export async function runWithTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = AUTH_CONTEXT_TIMEOUT_MS) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new AuthorizationBootstrapError(`Authorization context timed out after ${timeoutMs}ms.`, "TIMEOUT"));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function runAuthorizationOperation<T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    timeoutMs?: number;
    retryDelaysMs?: readonly number[];
    onAttempt?: (event: AuthorizationAttemptEvent) => void;
  } = {},
) {
  const maxAttempts = options.maxAttempts ?? AUTH_CONTEXT_MAX_ATTEMPTS;
  const retryDelays = options.retryDelaysMs ?? [300, 800];
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const startedAt = performance.now();
    options.onAttempt?.({ attempt, phase: "started" });
    try {
      const result = await runWithTimeout((signal) => operation(signal, attempt), options.timeoutMs);
      options.onAttempt?.({ attempt, phase: "succeeded", durationMs: Math.round(performance.now() - startedAt) });
      return result;
    } catch (error) {
      lastError = error;
      const classification = classifyAuthorizationFailure(error);
      options.onAttempt?.({
        attempt, phase: "failed", durationMs: Math.round(performance.now() - startedAt), classification, error,
      });
      if (!isTransientAuthorizationFailure(classification) || attempt === maxAttempts - 1) break;
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[attempt] ?? retryDelays.at(-1) ?? 0));
    }
  }

  const classification = classifyAuthorizationFailure(lastError);
  throw lastError instanceof AuthorizationBootstrapError
    ? lastError
    : new AuthorizationBootstrapError("Authorization context could not be verified.", classification, lastError);
}
