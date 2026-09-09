import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BACKEND_ERROR = "relation member_communities does not exist INTERNAL_TEST_ERROR";

const state = vi.hoisted(() => ({
  communityMode: "assigned" as "assigned" | "unassigned" | "loading" | "error" | "error-then-assigned",
  communityAttempts: 0,
  mutationCalls: [] as string[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    user: { id: "user-a", email: "member-a@example.test" },
    profile: { full_name: "Member A", email: "member-a@example.test", phone: "0700000000" },
    userRole: "member",
  }),
}));

vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => ({ memberPortalAccess: "full" }),
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ isFeatureEnabled: () => false }),
}));

vi.mock("@/hooks/use-community-leader", () => ({
  useLedCommunities: () => ({ data: [] }),
}));

vi.mock("@/lib/pledges", () => ({
  useMemberPledges: () => ({ data: [] }),
}));

vi.mock("@/lib/member-record-preservation", () => ({
  RECORD_PRESERVATION_AMOUNT: 3000,
  RECORD_PRESERVATION_PAGE_SIZE: 10,
  RECORD_PRESERVATION_YEARLY_AMOUNT: 30000,
  hasActiveRecordPreservation: () => false,
  isCurrentMonthDate: () => true,
  useMemberRecordPreservation: () => ({ data: { active: null, latest: null } }),
}));

vi.mock("@/lib/portal-announcements", () => ({
  fetchPortalAnnouncements: async () => [],
}));

vi.mock("@/lib/member-linked-requests", () => ({
  COMMUNITY_HELP_SELECT: "id",
  MASS_INTENTION_SELECT: "id",
  enrichCommunityHelpRequests: (rows: unknown[]) => rows,
  mapMassIntentionRecord: (row: unknown) => row,
}));

vi.mock("@/lib/file-upload", () => ({
  optimizeImage: async (file: File) => ({ blob: file }),
  uploadFile: async () => ({ publicUrl: "https://files.example/photo.jpg" }),
  validateFile: () => ({ valid: true }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

type Filter = { column: string; value: unknown };

function queryResult(table: string, selectClause: string | undefined, filters: Filter[]) {
  const hasFilter = (column: string, value?: unknown) =>
    filters.some((filter) => filter.column === column && (value === undefined || filter.value === value));

  if (table === "members" && selectClause === "*") {
    return {
      data: {
        id: "member-a",
        user_id: "user-a",
        church_id: "church-a",
        community_id: state.communityMode === "unassigned" ? null : "community-a",
        full_name: "Member A",
        email: "member-a@example.test",
        phone: "0700000000",
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    };
  }

  if (table === "members" && selectClause === "full_name") {
    return { data: hasFilter("church_id", "church-a") ? { full_name: "Leader A" } : null, error: null };
  }

  if (table === "communities") {
    if (state.communityMode === "loading") {
      return new Promise(() => undefined);
    }

    state.communityAttempts += 1;
    if (state.communityMode === "error" || (state.communityMode === "error-then-assigned" && state.communityAttempts === 1)) {
      return { data: null, error: new Error(BACKEND_ERROR) };
    }

    if (state.communityMode === "unassigned") {
      return { data: null, error: null };
    }

    if (hasFilter("id", "community-a") && hasFilter("church_id", "church-a")) {
      return {
        data: {
          id: "community-a",
          church_id: "church-a",
          name: "Jumuiya ya Mtakatifu Monica",
          description: "Recorded parish community",
          mwenyekiti_id: "leader-a",
          makamu_mwenyekiti_id: null,
          mweka_hazina_id: null,
          katibu_id: null,
        },
        error: null,
      };
    }
    return { data: null, error: null };
  }

  if (table === "member_communities") {
    if (state.communityMode === "loading") {
      return new Promise(() => undefined);
    }

    state.communityAttempts += 1;
    if (state.communityMode === "error" || (state.communityMode === "error-then-assigned" && state.communityAttempts === 1)) {
      return { data: null, error: new Error(BACKEND_ERROR) };
    }

    return { data: null, error: null };
  }

  if (table === "member_ministries") return { data: [], error: null };
  if (table === "churches") return { data: { name: "Kanisa Test" }, error: null };
  if (table === "families") return { data: null, error: null };
  if (table === "user_roles") return { data: [], error: null };
  if (table === "contributions") return { data: [], count: 0, error: null };
  if (table === "prayer_requests") return { data: [], count: 0, error: null };
  if (table === "mass_intentions") return { data: [], count: 0, error: null };
  if (table === "community_help_requests") return { data: [], error: null };
  if (table === "events") return { data: [], error: null };
  if (table === "bible_verses") return { data: [], error: null };

  return { data: null, error: null };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const filters: Filter[] = [];
      let selectClause: string | undefined;
      const builder: Record<string, unknown> = {
        select: (clause?: string) => {
          selectClause = clause;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters.push({ column, value });
          return builder;
        },
        ilike: () => builder,
        filter: () => builder,
        gte: () => builder,
        is: () => builder,
        not: () => builder,
        or: () => builder,
        in: () => builder,
        limit: () => builder,
        order: () => builder,
        range: async () => queryResult(table, selectClause, filters),
        maybeSingle: async () => queryResult(table, selectClause, filters),
        single: async () => queryResult(table, selectClause, filters),
        returns: async () => queryResult(table, selectClause, filters),
        insert: () => {
          state.mutationCalls.push(`${table}.insert`);
          return builder;
        },
        update: () => {
          state.mutationCalls.push(`${table}.update`);
          return builder;
        },
        delete: () => {
          state.mutationCalls.push(`${table}.delete`);
          return builder;
        },
        upsert: () => {
          state.mutationCalls.push(`${table}.upsert`);
          return builder;
        },
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(queryResult(table, selectClause, filters)).then(onFulfilled, onRejected),
      };
      return builder;
    },
    rpc: async () => ({ data: null, error: null }),
    storage: {
      from: () => ({ upload: async () => ({ error: null }) }),
    },
  },
}));

import PortalDashboard from "@/pages/portal/PortalDashboard";

const mounts: Array<{ host: HTMLDivElement; root: Root; client: QueryClient }> = [];

function renderDashboard() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PortalDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  mounts.push({ host, root, client });
  return host;
}

async function waitForText(host: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (host.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`Expected "${text}" in rendered output: ${host.textContent}`);
}

function mutationControlText(host: HTMLElement) {
  return /Edit Jumuiya|Change Jumuiya|Leave Jumuiya|Request Assignment|Select your Jumuiya|Choose Jumuiya/.test(host.textContent ?? "");
}

beforeEach(() => {
  state.communityMode = "assigned";
  state.communityAttempts = 0;
  state.mutationCalls = [];
});

afterEach(() => {
  for (const { host, root, client } of mounts.splice(0)) {
    act(() => root.unmount());
    client.clear();
    host.remove();
  }
});

describe("Wave 12 Slice 3 member Jumuiya dashboard runtime states", () => {
  it("renders the real assigned Jumuiya without member mutation controls", async () => {
    const host = renderDashboard();

    await waitForText(host, "Jumuiya ya Mtakatifu Monica");

    expect(host.textContent).toContain("Jumuiya / Community");
    expect(mutationControlText(host)).toBe(false);
    expect(state.mutationCalls).toEqual([]);
  });

  it("renders truthful not-assigned copy without fabricated community or mutation affordance", async () => {
    state.communityMode = "unassigned";
    const host = renderDashboard();

    await waitForText(host, "Jumuiya yako bado haijawekwa. Wasiliana na ofisi ya parokia ili kusasisha taarifa hii.");

    expect(host.textContent).not.toContain("Jumuiya ya Mtakatifu Monica");
    expect(mutationControlText(host)).toBe(false);
    expect(state.mutationCalls).toEqual([]);
  });

  it("keeps loading distinct from assigned and not-assigned states", async () => {
    state.communityMode = "loading";
    const host = renderDashboard();

    await waitForText(host, "Tunaangalia taarifa ya Jumuiya yako...");

    expect(host.textContent).not.toContain("Jumuiya yako bado haijawekwa");
    expect(host.textContent).not.toContain("Jumuiya ya Mtakatifu Monica");
    expect(mutationControlText(host)).toBe(false);
  });

  it("renders safe lookup failure without backend details or false empty state", async () => {
    state.communityMode = "error";
    const host = renderDashboard();

    await waitForText(host, "Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.");

    expect(host.textContent).not.toContain(BACKEND_ERROR);
    expect(host.textContent).not.toContain("Jumuiya yako bado haijawekwa");
    expect(host.textContent).not.toContain("Jumuiya ya Mtakatifu Monica");
    expect(mutationControlText(host)).toBe(false);
  });

  it("retries the failed lookup without invoking assignment mutation", async () => {
    state.communityMode = "error-then-assigned";
    const host = renderDashboard();

    await waitForText(host, "Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.");
    const retry = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Jaribu tena"));
    expect(retry).toBeDefined();

    await act(async () => {
      retry?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await waitForText(host, "Jumuiya ya Mtakatifu Monica");
    expect(host.textContent).not.toContain(BACKEND_ERROR);
    expect(host.textContent).not.toContain("Jumuiya yako bado haijawekwa");
    expect(state.communityAttempts).toBeGreaterThanOrEqual(2);
    expect(state.mutationCalls).toEqual([]);
  });
});
