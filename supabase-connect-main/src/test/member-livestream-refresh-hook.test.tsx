import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({
  featureState: { exists: true, visible: true },
  rpc: vi.fn(),
  fetchById: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a", user: { id: "user-a" } }),
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isLoading: false,
    isResolved: true,
    error: null,
    refetch: vi.fn(),
    getFeatureState: () => queryState.featureState,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => queryState.rpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => queryState.fetchById(),
          }),
        }),
      }),
    }),
  },
}));

import { useMemberLivestream } from "@/hooks/use-church-livestream";
import { MEMBER_LIVESTREAM_REFRESH_INTERVAL_MS } from "@/lib/church-livestreams";

function row(status: "scheduled" | "live" | "ended") {
  return {
    id: "stream-a",
    church_id: "church-a",
    status,
    title: "Morning Mass",
    provider: "youtube",
    watch_url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    provider_external_id: "M7lc1UVf-VE",
    scheduled_start: "2026-09-09T09:10:00.000Z",
    scheduled_end: "2026-09-09T10:00:00.000Z",
    actual_started_at: status === "live" ? "2026-09-09T09:10:00.000Z" : null,
    actual_ended_at: status === "ended" ? "2026-09-09T10:00:00.000Z" : null,
  };
}

function Probe() {
  const result = useMemberLivestream("stream-a");
  return <output>{result.data?.status ?? (result.isError ? "error" : "pending")}</output>;
}

describe("member livestream query refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T09:00:00.000Z"));
    queryState.featureState = { exists: true, visible: true };
    queryState.rpc.mockReset();
    queryState.fetchById.mockReset();
    queryState.rpc.mockResolvedValue({ data: true, error: null });
    queryState.fetchById.mockResolvedValue({ data: row("scheduled"), error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lightly refetches enabled member stream state without changing gates", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await vi.waitFor(() => expect(host.textContent).toContain("scheduled"));
    expect(queryState.fetchById).toHaveBeenCalledTimes(1);

    queryState.fetchById.mockResolvedValueOnce({ data: row("live"), error: null });
    await act(async () => { vi.advanceTimersByTime(MEMBER_LIVESTREAM_REFRESH_INTERVAL_MS); });
    await vi.waitFor(() => expect(host.textContent).toContain("live"));

    queryState.fetchById.mockResolvedValueOnce({ data: row("ended"), error: null });
    await act(async () => { vi.advanceTimersByTime(MEMBER_LIVESTREAM_REFRESH_INTERVAL_MS); });
    await vi.waitFor(() => expect(host.textContent).toContain("ended"));

    act(() => root.unmount());
    host.remove();
  });

  it("does not poll stream data when the feature gate is disabled", async () => {
    queryState.featureState = { exists: true, visible: false };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await act(async () => { vi.advanceTimersByTime(MEMBER_LIVESTREAM_REFRESH_INTERVAL_MS * 2); });
    expect(queryState.rpc).not.toHaveBeenCalled();
    expect(queryState.fetchById).not.toHaveBeenCalled();
    expect(host.textContent).toContain("pending");

    act(() => root.unmount());
    host.remove();
  });
});
