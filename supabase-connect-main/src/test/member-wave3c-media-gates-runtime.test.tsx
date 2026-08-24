import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  featureError: null as Error | null,
  permissionError: null as Error | null,
  rpc: vi.fn(),
  radioFetch: vi.fn(),
  livestreamFetch: vi.fn(),
  featureRefetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ churchId: "church-a", user: { id: "user-a" } }) }));
vi.mock("@/hooks/use-feature-access", () => ({ useFeatureAccess: () => ({
  isLoading: false,
  isResolved: !state.featureError,
  error: state.featureError,
  refetch: state.featureRefetch,
  getFeatureState: () => ({ key: "media", exists: true, enabled: true, visible: true, locked: false }),
}) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => state.rpc(...args) } }));
vi.mock("@/lib/church-radio", () => ({ fetchMemberRadioStations: (...args: unknown[]) => state.radioFetch(...args) }));
vi.mock("@/lib/church-livestreams", () => ({
  fetchMemberLivestream: (...args: unknown[]) => state.livestreamFetch(...args),
  fetchMemberLivestreamById: (...args: unknown[]) => state.livestreamFetch(...args),
}));

import { useChurchRadioStations } from "@/hooks/use-church-radio";
import { useMemberLivestream } from "@/hooks/use-church-livestream";

const waitFor = async (predicate: () => boolean) => { for (let attempt = 0; attempt < 40; attempt += 1) { if (predicate()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); } throw new Error("Timed out waiting for media gate state."); };

describe("Wave 3C fail-closed media gate aggregation", () => {
  let host: HTMLDivElement; let root: Root; let client: QueryClient;
  beforeEach(() => {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    state.featureError = null; state.permissionError = null; state.rpc.mockReset(); state.radioFetch.mockReset(); state.livestreamFetch.mockReset(); state.featureRefetch.mockReset();
    state.rpc.mockImplementation(async () => state.permissionError ? { data: null, error: state.permissionError } : { data: true, error: null });
    state.radioFetch.mockResolvedValue([]); state.livestreamFetch.mockResolvedValue(null); state.featureRefetch.mockResolvedValue([]);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); client.clear(); });

  it("surfaces a Radio permission failure without requesting stations", async () => {
    state.permissionError = new Error("permission unavailable");
    function Probe() { const query = useChurchRadioStations(); return <button onClick={() => void query.refetch()}>{query.isError ? "error" : "pending"}</button>; }
    act(() => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await waitFor(() => host.textContent === "error");
    expect(state.radioFetch).not.toHaveBeenCalled();
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    await waitFor(() => state.rpc.mock.calls.length === 2);
    expect(state.featureRefetch).not.toHaveBeenCalled();
  });

  it("surfaces a Livestream permission failure without requesting stream data", async () => {
    state.permissionError = new Error("permission unavailable");
    function Probe() { const query = useMemberLivestream("stream-a"); return <output>{query.isError ? "error" : "pending"}</output>; }
    act(() => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await waitFor(() => host.textContent === "error");
    expect(state.livestreamFetch).not.toHaveBeenCalled();
  });

  it("fails closed on feature-resolution errors without permission or content reads", async () => {
    state.featureError = new Error("feature unavailable");
    function Probe() { const radio = useChurchRadioStations(); const livestream = useMemberLivestream("stream-a"); return <output>{radio.isError && livestream.isError ? "error" : "pending"}</output>; }
    act(() => root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>));
    await waitFor(() => host.textContent === "error");
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.radioFetch).not.toHaveBeenCalled();
    expect(state.livestreamFetch).not.toHaveBeenCalled();
  });
});
