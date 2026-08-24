import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: { churchId: "church-a", user: { id: "user-a", email: "member@example.test" } },
  radio: {} as Record<string, unknown>, livestream: {} as Record<string, unknown>,
  tableErrors: new Set<string>(), rpcCalls: 0,
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/use-linked-member", () => ({ useLinkedMember: () => ({ data: null, isLoading: false, isError: false }) }));
vi.mock("@/hooks/use-feature-access", () => ({ useFeatureAccess: () => ({ isFeatureEnabled: () => true }) }));
vi.mock("@/hooks/use-church-radio", () => ({ useChurchRadioStations: () => state.radio }));
vi.mock("@/contexts/RadioPlayerContext", () => ({ useRadioPlayer: () => ({ station: null, state: "closed", play: vi.fn(), pause: vi.fn(), close: vi.fn() }) }));
vi.mock("@/hooks/use-church-livestream", () => ({ useMemberLivestream: () => state.livestream }));
vi.mock("@/contexts/PersistentLivestreamContext", () => ({ usePersistentLivestream: () => ({ activeStreamId: null, open: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: async () => { state.rpcCalls += 1; return { data: [{ community_id: "community-a", community_name: "Jumuiya A", leadership_role: "Mwenyekiti", church_id: "church-a" }], error: null }; },
  from: (table: string) => { const result = () => ({ data: [], error: state.tableErrors.has(table) ? new Error(`${table} failed`) : null }); const chain: Record<string, unknown> = {}; for (const method of ["select", "eq", "is", "not", "ilike", "in", "limit"]) chain[method] = () => chain; chain.order = () => Promise.resolve(result()); chain.maybeSingle = () => Promise.resolve(result()); return chain; },
} }));

import MemberRadioPage from "@/pages/portal/MemberRadioPage";
import MemberLivestreamPage from "@/pages/portal/MemberLivestreamPage";
import PortalEvents from "@/pages/portal/PortalEvents";
import PortalSermons from "@/pages/portal/PortalSermons";
import { useLedCommunities } from "@/hooks/use-community-leader";
import { getMemberBackTitle, memberServiceRegistry } from "@/lib/member-service-registry";

const waitFor = async (predicate: () => boolean) => { for (let attempt = 0; attempt < 40; attempt += 1) { if (predicate()) return; await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); } throw new Error("Timed out waiting for Wave 3C runtime state."); };

describe("Wave 3C member polish runtime", () => {
  let host: HTMLDivElement; let root: Root; let client: QueryClient;
  const render = (node: ReactNode) => act(() => root.render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); state.tableErrors.clear(); state.rpcCalls = 0; state.radio = { data: [], featureEnabled: true, featureLoading: false, isLoading: false, isError: false, refetch: vi.fn() }; state.livestream = { data: null, featureEnabled: true, featureLoading: false, isLoading: false, isError: false, refetch: vi.fn() }; });
  afterEach(() => { act(() => root.unmount()); host.remove(); client.clear(); });

  it("keeps Radio and Livestream request failures distinct from unavailable success states", () => { state.radio = { ...state.radio, isError: true }; render(<MemberRadioPage />); expect(host.querySelector('[data-testid="radio-error"]')).not.toBeNull(); expect(host.querySelector('[data-testid="radio-unavailable"]')).toBeNull(); state.livestream = { ...state.livestream, isError: true }; render(<MemberLivestreamPage />); expect(host.querySelector('[data-testid="livestream-error"]')).not.toBeNull(); expect(host.querySelector('[data-testid="livestream-unavailable"]')).toBeNull(); });
  it("keeps Events and Sermons request failures distinct from empty collections", async () => { state.tableErrors.add("events"); render(<PortalEvents />); await waitFor(() => host.textContent?.includes("Imeshindikana kupakia matukio.") === true); expect(host.textContent).not.toContain("No events at this time"); client.clear(); state.tableErrors.clear(); state.tableErrors.add("sermons"); render(<PortalSermons />); await waitFor(() => host.textContent?.includes("Imeshindikana kupakia mahubiri.") === true); expect(host.textContent).not.toContain("No sermons available"); });
  it("suppresses community-leader discovery until the profile menu needs it", async () => { function Probe({ enabled }: { enabled: boolean }) { const query = useLedCommunities(enabled); return <output>{query.fetchStatus}</output>; } render(<Probe enabled={false} />); expect(host.textContent).toBe("idle"); expect(state.rpcCalls).toBe(0); render(<Probe enabled />); await waitFor(() => state.rpcCalls === 1); });
  it("uses canonical labels for the same member destinations", () => { const labels = new Map(memberServiceRegistry.map((service) => [service.id, service.label])); expect(labels.get("radio")).toBe("Radio"); expect(labels.get("livestream")).toBe("Misa Mubashara"); expect(labels.get("daily-readings")).toBe("Masomo ya Leo"); expect(labels.get("liturgical-calendar")).toBe("Kalenda ya Liturujia"); expect(labels.get("library")).toBe("Watakatifu"); expect(labels.get("dashboard")).toBe("Historia Yangu"); expect(getMemberBackTitle("/portal/live/stream-a")).toBe("Misa Mubashara"); });
});
