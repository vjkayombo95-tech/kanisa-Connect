import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberLivestreamPage from "@/pages/portal/MemberLivestreamPage";
import { getValidatedYouTubeWatchUrl, getYouTubeEmbedUrl, type ChurchLivestream } from "@/lib/church-livestreams";

const state = vi.hoisted(() => ({ hook: {} as Record<string, unknown> }));
const player = vi.hoisted(() => ({ activeStreamId: null as string | null, open: vi.fn() }));

vi.mock("react-router-dom", () => ({ useParams: () => ({ streamId: "stream-1" }) }));
vi.mock("@/hooks/use-church-livestream", () => ({ useMemberLivestream: () => state.hook }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ churchId: "church-a", profile: { church_name: "St. Joseph Parish" } }) }));
vi.mock("@/contexts/PersistentLivestreamContext", () => ({ usePersistentLivestream: () => player }));

const liveStream: ChurchLivestream = {
  id: "stream-1", churchId: "church-a", status: "live", title: "Misa Takatifu", provider: "youtube",
  watchUrl: "https://www.youtube.com/watch?v=abc123DEF45", scheduledStart: "2026-08-09T07:00:00Z",
  scheduledEnd: null, actualStartedAt: "2026-08-09T07:02:00Z", actualEndedAt: null, recordingUrl: null,
  thumbnailUrl: null, providerExternalId: "abc123DEF45", providerStatus: "live", providerLastCheckedAt: null,
  providerLastErrorCategory: null, statusSource: "provider",
};

function setStream(stream: ChurchLivestream | null, overrides: Record<string, unknown> = {}) {
  state.hook = { data: stream, isLoading: false, error: null, featureEnabled: true, featureLoading: false, churchId: "church-a", ...overrides };
}

describe("MemberLivestreamPage", () => {
  beforeEach(() => { player.activeStreamId = null; player.open.mockReset(); setStream(liveStream); });

  it("renders a same-church LIVE stream host without a duplicate iframe", () => {
    player.activeStreamId = liveStream.id;
    const markup = renderToStaticMarkup(<MemberLivestreamPage />);
    expect(markup).toContain("LIVE SASA");
    expect(markup).toContain('data-testid="persistent-livestream-host"');
    expect(markup).not.toContain("<iframe");
  });

  it("never injects an arbitrary watch URL into the iframe", () => {
    const poisoned = { ...liveStream, watchUrl: "https://evil.example/embed/payload" };
    setStream(poisoned);
    const markup = renderToStaticMarkup(<MemberLivestreamPage />);
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("evil.example");
    expect(getValidatedYouTubeWatchUrl(poisoned)).toBeNull();
  });

  it("fails closed for cross-church and missing streams", () => {
    setStream({ ...liveStream, churchId: "church-b" });
    expect(renderToStaticMarkup(<MemberLivestreamPage />)).toContain('data-testid="livestream-unavailable"');
    setStream(null);
    expect(renderToStaticMarkup(<MemberLivestreamPage />)).not.toContain("<iframe");
  });

  it.each(["ended", "cancelled"] as const)("does not render a %s stream as LIVE", (status) => {
    setStream({ ...liveStream, status });
    const markup = renderToStaticMarkup(<MemberLivestreamPage />);
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("LIVE SASA");
  });

  it("renders an eligible scheduled YouTube stream without labeling it LIVE", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T07:00:00Z"));
    setStream({ ...liveStream, status: "scheduled", scheduledStart: "2026-08-09T07:20:00Z", actualStartedAt: null });
    const markup = renderToStaticMarkup(<MemberLivestreamPage />);
    vi.useRealTimers();
    expect(markup).toContain("INAKARIBIA");
    expect(markup).toContain('data-testid="start-livestream"');
    expect(markup).not.toContain("LIVE SASA");
  });

  it("requires YouTube with a valid external ID", () => {
    expect(getYouTubeEmbedUrl({ ...liveStream, provider: "custom" })).toBeNull();
    expect(getYouTubeEmbedUrl({ ...liveStream, providerExternalId: "not-valid" })).toBeNull();
  });

  it("does not duplicate the persistent player's hardened YouTube fallback link", () => {
    const markup = renderToStaticMarkup(<MemberLivestreamPage />);
    expect(markup).not.toContain("Fungua YouTube");
    expect(markup).not.toContain("<iframe");
  });
});
