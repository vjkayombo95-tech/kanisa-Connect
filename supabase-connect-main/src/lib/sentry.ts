import type { ErrorLogContext } from "./error-logger";

type SentryClient = {
  captureException?: (error: unknown, context?: ErrorLogContext) => void;
  captureMessage?: (message: string, context?: ErrorLogContext) => void;
};

let sentryClient: SentryClient | null = null;

export function configureSentry(client: SentryClient | null) {
  sentryClient = client;
}

export function captureSentryException(error: unknown, context?: ErrorLogContext) {
  sentryClient?.captureException?.(error, context);
}

export function captureSentryMessage(message: string, context?: ErrorLogContext) {
  sentryClient?.captureMessage?.(message, context);
}
