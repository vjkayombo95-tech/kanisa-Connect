import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PortalAnnouncementRecord } from "@/lib/portal-announcements";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  fallbackData: [] as PortalAnnouncementRecord[],
  fallbackError: null as Error | null,
  fallbackEqCalls: [] as Array<[string, unknown]>,
  fallbackIsCalls: [] as Array<[string, unknown]>,
  fallbackOrCalls: [] as string[],
  fallbackLimit: null as number | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc,
    from: state.from,
  },
}));

vi.mock("@/lib/offline-cache", () => ({
  readOfflineCache: vi.fn((_key: string | null, fallback: unknown) => fallback),
  withOfflineCache: vi.fn(async (_key: string | null, fetcher: () => Promise<unknown>) => fetcher()),
}));

import { fetchPortalAnnouncements } from "@/lib/portal-announcements";
import { fetchLatestAnnouncement } from "@/lib/member-daily-life";

const announcement = (id: string, churchId: string, title: string): PortalAnnouncementRecord => ({
  id,
  church_id: churchId,
  title,
  content: "Taarifa ya parokia",
  is_published: true,
  published_at: "2026-09-08T00:00:00Z",
  created_by: null,
  created_at: "2026-09-08T00:00:00Z",
  updated_at: "2026-09-08T00:00:00Z",
  archived_at: null,
});

function installFallbackQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      state.fallbackEqCalls.push([column, value]);
      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      state.fallbackIsCalls.push([column, value]);
      return query;
    }),
    or: vi.fn((filter: string) => {
      state.fallbackOrCalls.push(filter);
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(async (limit: number) => {
      state.fallbackLimit = limit;
      return { data: state.fallbackData, error: state.fallbackError };
    }),
  };

  state.from.mockReturnValue(query);
  return query;
}

describe("portal announcements fallback security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    state.rpc.mockReset();
    state.from.mockReset();
    state.fallbackData = [];
    state.fallbackError = null;
    state.fallbackEqCalls = [];
    state.fallbackIsCalls = [];
    state.fallbackOrCalls = [];
    state.fallbackLimit = null;
    installFallbackQuery();
  });

  it("returns RPC announcements without invoking the direct fallback", async () => {
    const rpcRows = [announcement("announcement-a", "church-a", "Tangazo la leo")];
    state.rpc.mockResolvedValue({ data: rpcRows, error: null });

    await expect(fetchPortalAnnouncements("church-a", 1)).resolves.toEqual(rpcRows);

    expect(state.rpc).toHaveBeenCalledWith("get_portal_announcements", { _church_id: "church-a", _limit: 1 });
    expect(state.from).not.toHaveBeenCalled();
  });

  it("uses the scoped direct fallback without logging the raw RPC error object", async () => {
    const rawRpcError = new Error("permission denied for relation announcements");
    const fallbackRows = [announcement("announcement-b", "church-a", "Tangazo la fallback")];
    state.rpc.mockResolvedValue({ data: null, error: rawRpcError });
    state.fallbackData = fallbackRows;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(fetchPortalAnnouncements("church-a", 3)).resolves.toEqual(fallbackRows);

    expect(state.from).toHaveBeenCalledWith("announcements");
    expect(state.fallbackEqCalls).toContainEqual(["church_id", "church-a"]);
    expect(state.fallbackEqCalls).toContainEqual(["is_published", true]);
    expect(state.fallbackIsCalls).toContainEqual(["archived_at", null]);
    expect(state.fallbackLimit).toBe(3);
    for (const consoleSpy of [warn, error, log]) {
      expect(consoleSpy.mock.calls.flat()).not.toContain(rawRpcError);
    }
  });

  it("lets the latest announcement helper return a current member-visible RPC announcement", async () => {
    const rpcRows = [announcement("announcement-current", "church-a", "Tangazo linaloonekana")];
    state.rpc.mockResolvedValue({ data: rpcRows, error: null });

    await expect(fetchLatestAnnouncement("church-a")).resolves.toEqual(rpcRows[0]);

    expect(state.rpc).toHaveBeenCalledWith("get_portal_announcements", { _church_id: "church-a", _limit: 1 });
    expect(state.from).not.toHaveBeenCalled();
  });

  it.each([
    ["future announcement", { status: "scheduled", publish_at: "2099-01-01T00:00:00Z", audience: ["members"] }],
    ["expired announcement", { status: "expired", expires_at: "2026-01-01T00:00:00Z", audience: ["members"] }],
    ["inappropriate audience announcement", { status: "active", audience: ["staff"] }],
  ])("fails closed instead of surfacing fallback %s through latest announcement", async (_label, extraFields) => {
    const rawRpcError = new Error("rpc unavailable");
    state.rpc.mockResolvedValue({ data: null, error: rawRpcError });
    state.fallbackData = [{ ...announcement("announcement-unsafe", "church-a", "Hidden"), ...extraFields } as PortalAnnouncementRecord];

    await expect(fetchLatestAnnouncement("church-a")).rejects.toThrow("rpc unavailable");

    expect(state.from).not.toHaveBeenCalled();
  });
});
