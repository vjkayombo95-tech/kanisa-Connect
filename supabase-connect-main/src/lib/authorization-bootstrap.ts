export type AuthorizationFailureClassification =
  | "OFFLINE" | "NETWORK" | "TIMEOUT" | "HTTP_AUTH" | "DATABASE" | "INVALID_CONTEXT" | "UNKNOWN";

export const AUTH_CONTEXT_TIMEOUT_MS = 12_000;
export const AUTH_CONTEXT_MAX_ATTEMPTS = 3;

export class AuthorizationBootstrapError extends Error {
  constructor(
    message: string,
    readonly classification: AuthorizationFailureClassification,
    readonly causeValue?: unknown,
  ) { super(message); this.name = "AuthorizationBootstrapError"; }
}

function record(error: unknown) {
  return error && typeof error === "object" ? error as Record<string, unknown> : null;
}

function errorText(error: unknown) {
  const value = record(error);
  const cause = record(value?.cause);
  return [error instanceof Error ? error.message : value?.message ?? error, value?.details, cause?.message,
    typeof value?.cause === "string" ? value.cause : undefined].filter(Boolean).join(" ").toLowerCase();
}

export function classifyAuthorizationFailure(error: unknown, navigatorOnline = typeof navigator === "undefined" ? true : navigator.onLine): AuthorizationFailureClassification {
  if (error instanceof AuthorizationBootstrapError) return error.classification;
  const value = record(error); const text = errorText(error);
  const status = Number(value?.status ?? value?.statusCode ?? 0); const code = String(value?.code ?? "").trim().toLowerCase();
  if (/timed out|timeout/.test(text) || error instanceof DOMException && error.name === "TimeoutError") return "TIMEOUT";
  if (!navigatorOnline) return "OFFLINE";
  if (/failed to fetch|networkerror|network request failed|fetch failed|load failed/.test(text)) return "NETWORK";
  if (status === 401 || status === 403 || code === "401" || code === "403" || /\bjwt\b/.test(text)) return "HTTP_AUTH";
  if (code) return "DATABASE";
  return "UNKNOWN";
}

export const isTransientAuthorizationFailure = (value: AuthorizationFailureClassification) => ["OFFLINE", "NETWORK", "TIMEOUT"].includes(value);
export const isActiveAuthorizationLoad = (sequence: number, active: number) => sequence === active;

export async function runAuthorizationOperation<T>(operation: (signal: AbortSignal, attempt: number) => Promise<T>, options: {
  maxAttempts?: number; timeoutMs?: number; retryDelaysMs?: readonly number[];
  onAttempt?: (event: { attempt: number; phase: "started" | "succeeded" | "failed"; durationMs?: number; classification?: AuthorizationFailureClassification }) => void;
} = {}) {
  const max = options.maxAttempts ?? AUTH_CONTEXT_MAX_ATTEMPTS, delays = options.retryDelaysMs ?? [300, 800]; let last: unknown;
  for (let attempt = 0; attempt < max; attempt += 1) {
    const started = performance.now(), controller = new AbortController();
    options.onAttempt?.({ attempt, phase: "started" });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new AuthorizationBootstrapError("Authorization context timed out.", "TIMEOUT")); controller.abort(); }, options.timeoutMs ?? AUTH_CONTEXT_TIMEOUT_MS); });
      const result = await Promise.race([operation(controller.signal, attempt), timeout]);
      options.onAttempt?.({ attempt, phase: "succeeded", durationMs: Math.round(performance.now() - started) }); return result;
    } catch (error) {
      last = error; const classification = classifyAuthorizationFailure(error);
      options.onAttempt?.({ attempt, phase: "failed", durationMs: Math.round(performance.now() - started), classification });
      if (!isTransientAuthorizationFailure(classification) || attempt === max - 1) break;
      await new Promise<void>((resolve) => setTimeout(resolve, delays[attempt] ?? delays.at(-1) ?? 0));
    } finally { if (timer) clearTimeout(timer); }
  }
  const classification = classifyAuthorizationFailure(last);
  throw last instanceof AuthorizationBootstrapError ? last : new AuthorizationBootstrapError("Authorization context could not be verified.", classification, last);
}

export function safeAuthorizationDiagnostic(error: unknown) {
  const value = record(error); return { classification: classifyAuthorizationFailure(error), code: typeof value?.code === "string" ? value.code : undefined, status: typeof value?.status === "number" ? value.status : undefined };
}
