export type ChurchPaymentPayload = {
  churchId: string;
};

export type ChurchPaymentProfile = {
  id: string;
  name: string;
  tagline: string;
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

export function buildChurchQRPayload(churchId: string) {
  return JSON.stringify({ churchId });
}

export function parseChurchQRPayload(rawValue: string): ChurchPaymentPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
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
