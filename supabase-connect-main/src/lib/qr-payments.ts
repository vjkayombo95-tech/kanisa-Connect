export type ChurchPaymentPayload = {
  churchId: string;
};

export type ChurchPaymentProfile = {
  id: string;
  name: string;
  tagline: string;
  slug?: string | null;
  logo_url?: string | null;
};

const MOCK_CHURCHES: Record<string, ChurchPaymentProfile> = {
  abc123: {
    id: "abc123",
    name: "St. Peter's Parish",
    tagline: "Community giving for worship, outreach, and care.",
  },
  grace001: {
    id: "grace001",
    name: "Grace Revival Centre",
    tagline: "Supporting ministry, missions, and local impact.",
  },
  hope777: {
    id: "hope777",
    name: "Hope Chapel",
    tagline: "Faithful generosity that strengthens the church family.",
  },
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

export function getChurchPaymentProfile(churchId: string): ChurchPaymentProfile {
  return (
    MOCK_CHURCHES[churchId] ?? {
      id: churchId,
      name: "Kanisa Connect Church",
      tagline: "Secure digital giving for your church community.",
    }
  );
}

export async function mockChurchPayment(input: {
  churchId: string;
  amount: number;
  phoneNumber: string;
}) {
  await new Promise((resolve) => window.setTimeout(resolve, 1600));

  return {
    success: true,
    reference: `PAY-${Date.now()}`,
    ...input,
  };
}
