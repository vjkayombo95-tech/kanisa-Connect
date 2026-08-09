function decodeJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const role = (payload as Record<string, unknown>).role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

export function hasVerifiedServiceRole(authorization: string | null): boolean {
  if (!authorization) return false;
  const match = authorization.trim().match(/^Bearer\s+(\S+)$/i);
  if (!match) return false;
  return decodeJwtRole(match[1]) === "service_role";
}
