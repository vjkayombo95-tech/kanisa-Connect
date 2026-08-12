import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveMassCard } from "@/components/portal/LiveMassCard";
import { getMemberLivestreamPresentation, type ChurchLivestream } from "@/lib/church-livestreams";

const hookState = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("@/hooks/use-church-livestream", () => ({ useChurchLivestream: () => hookState.value }));
vi.mock("@/contexts/PersistentLivestreamContext", () => ({ useOptionalPersistentLivestream: () => null }));
vi.mock("@/lib/error-logger", () => ({ logWarning: vi.fn() }));

const liveStream: ChurchLivestream = {
  id: "stream-1",
  churchId: "church-a",
  status: "live",
  title: "Dominika ya 19 ya Mwaka wa Kanisa yenye kichwa kirefu",
  provider: "youtube",
  watchUrl: "https://www.youtube.com/watch?v=mass",
  scheduledStart: "2026-08-08T10:00:00Z",
  scheduledEnd: null,
  actualStartedAt: "2026-08-08T10:02:00Z",
  actualEndedAt: null,
  recordingUrl: null,
  thumbnailUrl: null,
  providerExternalId: "abc123DEF45",
  providerStatus: "live",
  providerLastCheckedAt: "2026-08-08T10:03:00Z",
  providerLastErrorCategory: null,
  statusSource: "provider",
};

function setHook(stream: ChurchLivestream | null, overrides: Record<string, unknown> = {}) {
  hookState.value = { data: stream, error: null, featureEnabled: true, churchId: "church-a", ...overrides };
}

const renderCard = (churchName = "St. Joseph Parish") => renderToStaticMarkup(<LiveMassCard churchName={churchName} />);

describe("LiveMassCard", () => {
  beforeEach(() => setHook(null));

  it("renders nothing when the feature is disabled or no stream exists", () => {
    setHook(liveStream, { featureEnabled: false });
    expect(renderCard()).toBe("");
    setHook(null);
    expect(renderCard()).toBe("");
  });

  it("shows confirmed LIVE content, authoritative URL, and a text-first layout", () => {
    setHook(liveStream);
    const markup = renderCard();
    expect(markup).toContain("LIVE");
    expect(markup).toContain("Misa Inaendelea Sasa");
    expect(markup).toContain(liveStream.title);
    expect(markup).toContain(`href="/portal/live/${liveStream.id}"`);
    expect(markup).not.toContain('target="_blank"');
    expect(markup).not.toContain("<img");
    expect(markup).toContain("Tazama Moja kwa Moja");
  });

  it("preserves a safe external CTA for unsupported embed providers", () => {
    const external = { ...liveStream, provider: "vimeo" as const, watchUrl: "https://vimeo.com/123456", providerExternalId: "123456" };
    setHook(external);
    const markup = renderCard();
    expect(markup).toContain('href="https://vimeo.com/123456"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toMatch(/rel="(?:noopener noreferrer|noreferrer noopener)"/);
  });

  it("renders a secure thumbnail without autoplay media", () => {
    setHook({ ...liveStream, thumbnailUrl: "https://example.com/mass.jpg" });
    const markup = renderCard();
    expect(markup).toContain('src="https://example.com/mass.jpg"');
    expect(markup).toContain("Picha ya matangazo:");
    expect(markup).not.toMatch(/<(video|audio)/);
  });

  it("shows only future scheduled streams within 30 minutes", () => {
    const now = Date.parse("2026-08-08T10:00:00Z");
    const scheduled = { ...liveStream, status: "scheduled" as const, scheduledStart: "2026-08-08T10:20:00Z", actualStartedAt: null };
    expect(getMemberLivestreamPresentation(scheduled, now)).toBe("upcoming");
    expect(getMemberLivestreamPresentation({ ...scheduled, scheduledStart: "2026-08-08T10:31:00Z" }, now)).toBeNull();
    expect(getMemberLivestreamPresentation({ ...scheduled, scheduledStart: "2026-08-08T09:55:00Z" }, now)).toBeNull();
  });

  it("never infers LIVE from a passed scheduled time", () => {
    const overdue = { ...liveStream, status: "scheduled" as const, scheduledStart: "2026-08-08T09:55:00Z", actualStartedAt: null };
    expect(getMemberLivestreamPresentation(overdue, Date.parse("2026-08-08T10:10:00Z"))).toBeNull();
  });

  it("renders the calm upcoming card and details CTA", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T10:00:00Z"));
    setHook({ ...liveStream, status: "scheduled", scheduledStart: "2026-08-08T10:20:00Z", actualStartedAt: null });
    const markup = renderCard();
    vi.useRealTimers();
    expect(markup).toContain("Misa Inaanza Hivi Karibuni");
    expect(markup).toContain("Angalia Maelezo");
    expect(markup).not.toContain(">LIVE<");
  });

  it("removes ended, failed, and previous-church streams", () => {
    setHook({ ...liveStream, status: "ended", actualEndedAt: "2026-08-08T11:00:00Z" });
    expect(renderCard()).toBe("");
    setHook(liveStream, { churchId: "church-b" });
    expect(renderCard()).toBe("");
    setHook(liveStream, { error: new Error("network") });
    expect(renderCard()).toBe("");
  });

  it("keeps textual LIVE status when pulse animation is reduced", () => {
    setHook(liveStream);
    const markup = renderCard();
    expect(markup).toContain("motion-reduce:animate-none");
    expect(markup).toContain("LIVE");
  });
});
