import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import type { ChurchLivestream } from "@/lib/church-livestreams";

const state = vi.hoisted(() => ({
  hookResult: {
    data: null as ChurchLivestream | null,
    featureEnabled: true,
    featureLoading: false,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    churchId: "church-a",
    refetch: vi.fn(),
  },
  player: {
    activeStreamId: null as string | null,
    stream: null as ChurchLivestream | null,
    featureEnabled: true,
    churchId: "church-a",
    mode: "closed" as "closed" | "full" | "mini",
    open: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    user: { id: "user-a" },
  }),
}));

vi.mock("@/hooks/use-church-livestream", () => ({
  useMemberLivestream: () => state.hookResult,
}));

vi.mock("@/contexts/PersistentLivestreamContext", () => ({
  usePersistentLivestream: () => state.player,
}));

import { PersistentLivestreamPlayer } from "@/components/portal/PersistentLivestreamPlayer";
import MemberLivestreamPage from "@/pages/portal/MemberLivestreamPage";

const stream = (
  overrides: Partial<ChurchLivestream> = {},
): ChurchLivestream => ({
  id: "stream-a",
  churchId: "church-a",
  status: "live",
  title: "Misa ya Familia",
  provider: "youtube",
  watchUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  providerExternalId: "M7lc1UVf-VE",
  scheduledStart: "2026-09-09T09:15:00.000Z",
  scheduledEnd: "2026-09-09T10:15:00.000Z",
  actualStartedAt: "2026-09-09T09:00:00.000Z",
  actualEndedAt: null,
  ...overrides,
});

describe("member livestream localization E2", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T09:00:00.000Z"));

    await i18n.changeLanguage("sw");

    state.hookResult = {
      data: stream(),
      featureEnabled: true,
      featureLoading: false,
      isLoading: false,
      isError: false,
      error: null,
      churchId: "church-a",
      refetch: vi.fn(),
    };

    state.player = {
      activeStreamId: null,
      stream: null,
      featureEnabled: true,
      churchId: "church-a",
      mode: "closed",
      open: vi.fn(),
      expand: vi.fn(),
      close: vi.fn(),
    };

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();

    document
      .querySelectorAll('[data-testid="persistent-livestream-player"]')
      .forEach((element) => element.remove());

    vi.useRealTimers();
  });

  const renderPage = () =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={["/portal/live/stream-a"]}>
          <Routes>
            <Route
              path="/portal/live/:streamId"
              element={<MemberLivestreamPage />}
            />
          </Routes>
        </MemoryRouter>,
      ),
    );

  const renderPlayer = () =>
    act(() => root.render(<PersistentLivestreamPlayer />));

  it("switches member livestream app copy between Swahili and English while preserving dynamic stream content", async () => {
    state.hookResult.data = stream({
      status: "scheduled",
      actualStartedAt: null,
      scheduledStart: "2026-09-09T09:10:00.000Z",
    });

    renderPage();

    expect(host.textContent).toContain("INAKUJA KARIBUNI");
    expect(host.textContent).toContain("Fungua Misa ijayo");
    expect(host.textContent).toContain("Misa ya Familia");

    await act(async () => {
      await i18n.changeLanguage("en");
    });

    expect(host.textContent).toContain("COMING UP SOON");
    expect(host.textContent).toContain("Open upcoming Mass");

    // Dynamic church-provided content must not be translated.
    expect(host.textContent).toContain("Misa ya Familia");

    // Canonical backend state remains unchanged.
    expect(state.hookResult.data?.status).toBe("scheduled");
  });

  it("localizes persistent player controls without replacing the livestream iframe", async () => {
    const liveStream = stream();

    state.player = {
      activeStreamId: liveStream.id,
      stream: liveStream,
      featureEnabled: true,
      churchId: "church-a",
      mode: "mini",
      open: vi.fn(),
      expand: vi.fn(),
      close: vi.fn(),
    };

    renderPlayer();

    const iframeBefore =
      document.querySelector<HTMLIFrameElement>(
        '[data-testid="livestream-embed"]',
      );

    expect(iframeBefore).not.toBeNull();
    expect(iframeBefore?.title).toBe("Misa ya Familia");

    expect(
      document.querySelector(
        'button[aria-label="Fungua Misa Mubashara: Misa ya Familia"]',
      ),
    ).not.toBeNull();

    expect(
      document.querySelector(
        'button[aria-label="Funga Misa Mubashara"]',
      ),
    ).not.toBeNull();

    await act(async () => {
      await i18n.changeLanguage("en");
    });

    const iframeAfter =
      document.querySelector<HTMLIFrameElement>(
        '[data-testid="livestream-embed"]',
      );

    expect(iframeAfter).toBe(iframeBefore);
    expect(iframeAfter?.title).toBe("Misa ya Familia");

    expect(
      document.querySelector(
        'button[aria-label="Open Live Mass: Misa ya Familia"]',
      ),
    ).not.toBeNull();

    expect(
      document.querySelector(
        'button[aria-label="Close Live Mass"]',
      ),
    ).not.toBeNull();

    expect(state.player.activeStreamId).toBe("stream-a");
    expect(state.player.mode).toBe("mini");
  });

  it("keeps active-church isolation when localization changes", async () => {
    state.hookResult.data = stream({
      churchId: "church-b",
    });

    renderPage();

    expect(
      host.querySelector('[data-testid="livestream-unavailable"]'),
    ).not.toBeNull();

    await act(async () => {
      await i18n.changeLanguage("en");
    });

    expect(
      host.querySelector('[data-testid="livestream-unavailable"]'),
    ).not.toBeNull();

    expect(host.textContent).toContain("Live Mass is unavailable");
  });
});