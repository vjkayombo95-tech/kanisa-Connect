const startupOrigin =
  typeof performance !== "undefined" ? performance.timeOrigin + performance.now() : Date.now();

type StartupMetadata = Record<string, string | number | boolean | null | undefined>;

export function logStartupEvent(event: string, metadata: StartupMetadata = {}) {
  if (!import.meta.env.DEV || typeof console === "undefined") return;

  const now = typeof performance !== "undefined" ? performance.timeOrigin + performance.now() : Date.now();
  const elapsedMs = Math.round(now - startupOrigin);
  console.info("[startup]", { event, elapsedMs, ...metadata });
}

export function markStartupEvent(event: string, metadata: StartupMetadata = {}) {
  if (typeof performance !== "undefined" && performance.mark) {
    performance.mark(`startup:${event}`);
  }

  logStartupEvent(event, metadata);
}
