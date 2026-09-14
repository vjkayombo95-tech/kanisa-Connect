export type ChurchPaymentPayload = {
  churchId: string;
};

export function buildChurchGivingUrl(churchId: string, churchSlug?: string | null, origin?: string) {
  const baseOrigin =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "https://kanisaniconnect.netlify.app");
  const target = (churchSlug || churchId).trim();

  return `${baseOrigin.replace(/\/$/, "")}/give/${encodeURIComponent(target)}`;
}

export function buildChurchQRPayload(churchId: string, churchSlug?: string | null) {
  return buildChurchGivingUrl(churchId, churchSlug);
}

export function parseChurchQRPayload(rawValue: string): ChurchPaymentPayload {
  const trimmedValue = rawValue.trim();

  try {
    const url = new URL(trimmedValue);
    const giveMatch = url.pathname.match(/^\/give\/([^/]+)\/?$/);

    if (giveMatch?.[1]) {
      return { churchId: decodeURIComponent(giveMatch[1]) };
    }
  } catch {
    // Not a URL; continue with legacy JSON parsing below.
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error("This QR code is not recognized.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("churchId" in parsed) ||
    typeof (parsed as { churchId?: unknown }).churchId !== "string" ||
    !(parsed as { churchId: string }).churchId.trim()
  ) {
    throw new Error("This QR code is missing a valid church ID.");
  }

  return {
    churchId: (parsed as { churchId: string }).churchId.trim(),
  };
}
