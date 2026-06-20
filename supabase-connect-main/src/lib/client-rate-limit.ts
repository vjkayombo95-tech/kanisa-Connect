type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function nowMs() {
  return Date.now();
}

function getStorageKey(key: string) {
  return `rate-limit:${key}`;
}

function readAttempts(storageKey: string) {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number") : [];
  } catch {
    return [];
  }
}

function writeAttempts(storageKey: string, attempts: number[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(attempts));
}

export function checkClientRateLimit(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
  const storageKey = getStorageKey(key);
  const currentTime = nowMs();
  const windowStart = currentTime - windowMs;
  const recentAttempts = readAttempts(storageKey).filter((attempt) => attempt >= windowStart);

  if (recentAttempts.length >= maxAttempts) {
    const oldestAttempt = Math.min(...recentAttempts);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldestAttempt + windowMs - currentTime) / 1000)),
    };
  }

  writeAttempts(storageKey, [...recentAttempts, currentTime]);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function assertClientRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  label = "requests",
) {
  const result = checkClientRateLimit(key, maxAttempts, windowMs);

  if (!result.allowed) {
    const minutes = Math.ceil(result.retryAfterSeconds / 60);
    throw new Error(`Too many ${label}. Please wait about ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`);
  }
}
