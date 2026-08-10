import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  errors: {} as Record<string, unknown>,
  filters: [] as Array<[string, string, unknown]>,
  fetchParishCalendarFeed: vi.fn(),
}));

vi.mock("@/lib/calendar", () => ({ fetchParishCalendarFeed: mocks.fetchParishCalendarFeed }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "order"]) builder[method] = () => builder;
      for (const method of ["eq", "gte", "lt"]) builder[method] = (column: string, value: unknown) => {
        mocks.filters.push([table, column, value]);
        return builder;
      };
      builder.then = (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => Promise.resolve({ data: mocks.rows[table] ?? [], error: mocks.errors[table] ?? null }).then(resolve, reject);
      return builder;
    }),
  },
}));

import {
  answerControlledKanisaAIIntent,
  answerKanisaAIConversationAsync,
  classifyControlledKanisaAIIntent,
  createKanisaAIContext,
  getControlledQuickQuestionIntent,
} from "@/lib/ai";
import type { WorkspaceId } from "@/components/workspace";

const now = new Date("2026-08-11T10:00:00+03:00");

function context(workspace: WorkspaceId, role: string, churchId: string | null = "church-1") {
  return createKanisaAIContext({ workspace, role, church: { id: churchId }, tenant: { id: churchId }, route: `/${workspace}/kanisa-ai`, language: "en" });
}

describe("Kanisa AI V1 controlled answers", () => {
  beforeEach(() => {
    mocks.rows = {};
    mocks.errors = {};
    mocks.filters = [];
    mocks.fetchParishCalendarFeed.mockReset().mockResolvedValue([]);
  });

  it("maps the pending invitations quick action directly", () => expect(getControlledQuickQuestionIntent("Show pending invitations.")).toBe("PENDING_INVITATIONS"));
  it("maps the upcoming events quick action directly", () => expect(getControlledQuickQuestionIntent("What events are coming up?")).toBe("UPCOMING_EVENTS"));
  it("maps the prayer requests quick action directly", () => expect(getControlledQuickQuestionIntent("Show unresolved prayer requests.")).toBe("UNRESOLVED_PRAYER_REQUESTS"));
  it("maps the contribution quick action directly", () => expect(getControlledQuickQuestionIntent("Show contribution trends.")).toBe("CONTRIBUTION_SUMMARY"));

  it.each([
    ["Any invitations waiting?", "PENDING_INVITATIONS"],
    ["Which invitations need attention?", "PENDING_INVITATIONS"],
    ["Any upcoming events?", "UPCOMING_EVENTS"],
    ["What's happening this week?", "UPCOMING_EVENTS"],
    ["Are there urgent prayer requests?", "UNRESOLVED_PRAYER_REQUESTS"],
    ["How much did we collect this month?", "CONTRIBUTION_SUMMARY"],
  ])("recognizes English alias %s", (input, intent) => expect(classifyControlledKanisaAIIntent(input)).toBe(intent));

  it.each([
    ["Kuna mialiko mingapi bado?", "PENDING_INVITATIONS"],
    ["Kuna matukio gani yanakuja?", "UPCOMING_EVENTS"],
    ["Kuna maombi ambayo hayajashughulikiwa?", "UNRESOLVED_PRAYER_REQUESTS"],
    ["Michango inaendaje?", "CONTRIBUTION_SUMMARY"],
  ])("recognizes Kiswahili alias %s", (input, intent) => expect(classifyControlledKanisaAIIntent(input)).toBe(intent));

  it("fails safely when a question matches multiple controlled areas", () => expect(classifyControlledKanisaAIIntent("Show contribution and event details")).toBeNull());
  it("fails safely for an unknown question", () => expect(classifyControlledKanisaAIIntent("How is everything?")).toBeNull());
  it("supports the safe contribution follow-up", () => expect(classifyControlledKanisaAIIntent("What about last month?", "CONTRIBUTION_SUMMARY")).toBe("CONTRIBUTION_SUMMARY"));
  it("does not reuse an unrelated last intent", () => expect(classifyControlledKanisaAIIntent("What about last month?", "UPCOMING_EVENTS")).toBeNull());

  it("returns a pending invitation count and oldest age", async () => {
    mocks.rows.invitations = [{ id: "i1", status: "pending", created_at: "2026-08-05T10:00:00+03:00" }, { id: "i2", status: "pending", created_at: "2026-08-10T10:00:00+03:00" }];
    const answer = await answerControlledKanisaAIIntent("PENDING_INVITATIONS", context("church_admin", "church_admin"), now);
    expect(answer.status).toBe("success");
    expect(answer.metrics).toMatchObject({ pending: 2, oldestPendingDays: 6 });
  });

  it("returns the pending invitations empty state", async () => expect((await answerControlledKanisaAIIntent("PENDING_INVITATIONS", context("church_admin", "church_admin"), now)).status).toBe("empty"));
  it("forbids members from invitation counts without revealing a count", async () => {
    const answer = await answerControlledKanisaAIIntent("PENDING_INVITATIONS", context("member", "member"), now);
    expect(answer.status).toBe("forbidden");
    expect(answer.metrics).toBeUndefined();
  });
  it("uses the verified invitation deep link", async () => expect((await answerControlledKanisaAIIntent("PENDING_INVITATIONS", context("church_admin", "secretary"), now)).action?.route).toBe("/church-admin/roles"));
  it("scopes invitations to the authoritative church", async () => {
    await answerControlledKanisaAIIntent("PENDING_INVITATIONS", context("church_admin", "church_admin"), now);
    expect(mocks.filters).toContainEqual(["invitations", "church_id", "church-1"]);
  });

  it("returns upcoming events in chronological order", async () => {
    mocks.fetchParishCalendarFeed.mockResolvedValue([
      { id: "later", title: "Choir", startsAt: "2026-08-13T17:30:00+03:00", church_id: "church-1" },
      { id: "first", title: "Youth Mass", startsAt: "2026-08-12T18:00:00+03:00", church_id: "church-1" },
    ]);
    const answer = await answerControlledKanisaAIIntent("UPCOMING_EVENTS", context("member", "member"), now);
    expect(answer.details?.map((item) => item.title)).toEqual(["Youth Mass", "Choir"]);
  });
  it("returns the upcoming events empty state", async () => expect((await answerControlledKanisaAIIntent("UPCOMING_EVENTS", context("member", "member"), now)).status).toBe("empty"));
  it("excludes a cross-church event defensively", async () => {
    mocks.fetchParishCalendarFeed.mockResolvedValue([{ id: "foreign", title: "Foreign", startsAt: "2026-08-12T18:00:00+03:00", church_id: "church-2" }]);
    expect((await answerControlledKanisaAIIntent("UPCOMING_EVENTS", context("member", "member"), now)).status).toBe("empty");
  });
  it("uses the member events deep link", async () => expect((await answerControlledKanisaAIIntent("UPCOMING_EVENTS", context("member", "member"), now)).action?.route).toBe("/portal/events"));
  it("passes only the authoritative church to the calendar feed", async () => {
    await answerControlledKanisaAIIntent("UPCOMING_EVENTS", context("pastoral", "pastor"), now);
    expect(mocks.fetchParishCalendarFeed).toHaveBeenCalledWith(expect.objectContaining({ churchId: "church-1", workspace: "pastoral" }));
  });

  it("returns the unresolved prayer count", async () => {
    mocks.rows.prayer_requests = [{ id: "p1", status: "pending" }, { id: "p2", status: "pending" }];
    expect((await answerControlledKanisaAIIntent("UNRESOLVED_PRAYER_REQUESTS", context("pastoral", "pastor"), now)).metrics).toEqual({ unresolved: 2 });
  });
  it("does not invent an urgent prayer count when the schema has no priority field", async () => {
    mocks.rows.prayer_requests = [{ id: "p1", status: "pending" }];
    expect((await answerControlledKanisaAIIntent("UNRESOLVED_PRAYER_REQUESTS", context("church_admin", "church_admin"), now)).metrics).not.toHaveProperty("urgent");
  });
  it("returns the unresolved prayer empty state", async () => expect((await answerControlledKanisaAIIntent("UNRESOLVED_PRAYER_REQUESTS", context("pastoral", "pastor"), now)).status).toBe("empty"));
  it("forbids members from parish prayer counts", async () => expect((await answerControlledKanisaAIIntent("UNRESOLVED_PRAYER_REQUESTS", context("member", "member"), now)).status).toBe("forbidden"));
  it("never selects or returns sensitive prayer text", async () => {
    await answerControlledKanisaAIIntent("UNRESOLVED_PRAYER_REQUESTS", context("church_admin", "church_admin"), now);
    expect(JSON.stringify(mocks.filters)).not.toContain("request_text");
  });
  it("uses the pastoral prayer request deep link", async () => expect((await answerControlledKanisaAIIntent("UNRESOLVED_PRAYER_REQUESTS", context("pastoral", "pastor"), now)).action?.route).toBe("/pastoral/prayer-requests"));

  it("calculates current and previous month contribution totals and payment count", async () => {
    mocks.rows.contributions = [{ id: "c1", amount: 2000, date: "2026-08-02" }, { id: "c2", amount: 1500, date: "2026-08-09" }, { id: "c3", amount: 3000, date: "2026-07-09" }];
    const answer = await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("finance", "treasurer"), now);
    expect(answer.metrics).toEqual({ currentMonthTotal: 3500, currentMonthPayments: 2, previousMonthTotal: 3000 });
    expect(answer.summary).toContain("17% higher");
  });
  it("reports a negative contribution trend", async () => {
    mocks.rows.contributions = [{ id: "c1", amount: 2000, date: "2026-08-02" }, { id: "c2", amount: 4000, date: "2026-07-09" }];
    expect((await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("finance", "treasurer"), now)).summary).toContain("50% lower");
  });
  it("avoids division by zero when previous month is empty", async () => {
    mocks.rows.contributions = [{ id: "c1", amount: 2000, date: "2026-08-02" }];
    expect((await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("finance", "treasurer"), now)).summary).toContain("not enough previous-month activity");
  });
  it("returns the current-month contribution empty state", async () => expect((await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("finance", "treasurer"), now)).status).toBe("empty"));
  it("forbids members from parish contribution metrics", async () => expect((await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("member", "member"), now)).status).toBe("forbidden"));
  it("scopes contributions to the authoritative church", async () => {
    await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("church_admin", "church_admin"), now);
    expect(mocks.filters).toContainEqual(["contributions", "church_id", "church-1"]);
  });
  it("uses the finance contribution deep link", async () => expect((await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("finance", "treasurer"), now)).action?.route).toBe("/finance/contributions"));
  it("fails closed when church context is absent", async () => expect((await answerControlledKanisaAIIntent("UPCOMING_EVENTS", context("member", "member", null), now)).status).toBe("forbidden"));
  it("forbids a community leader when no role-valid Kanisa AI deep link exists", async () => expect((await answerControlledKanisaAIIntent("UPCOMING_EVENTS", context("church_admin", "community_leader"), now)).status).toBe("forbidden"));
  it("forbids super admin tenant counts without an active church workspace", async () => expect((await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("super_admin", "super_admin", null), now)).status).toBe("forbidden"));

  it("returns a controlled error without raw database details", async () => {
    mocks.errors.invitations = { message: "secret database detail" };
    const answer = await answerControlledKanisaAIIntent("PENDING_INVITATIONS", context("church_admin", "church_admin"), now);
    expect(answer.status).toBe("error");
    expect(answer.summary).not.toContain("secret");
  });
  it("renders the controlled result through the reusable conversational response contract", async () => {
    mocks.rows.invitations = [{ id: "i1", status: "pending", created_at: "2026-08-10T10:00:00+03:00" }];
    const response = await answerKanisaAIConversationAsync("Show pending invitations", context("church_admin", "church_admin"), { controlledIntent: "PENDING_INVITATIONS" });
    expect(response.status).toBe("success");
    expect(response.summary).toContain("1 pending invitation");
    expect(response.actions[0].route).toBe("/church-admin/roles");
  });
  it("returns the safe fallback for ambiguous free text without querying", async () => {
    const response = await answerKanisaAIConversationAsync("Show contribution and event details", context("church_admin", "church_admin"));
    expect(response.status).toBe("unavailable");
    expect(mocks.filters).toHaveLength(0);
  });
  it("treats user HTML as text rather than an executable query or answer", async () => {
    const input = "<img src=x onerror=alert(1)>";
    const response = await answerKanisaAIConversationAsync(input, context("member", "member"));
    expect(response.summary).not.toContain("<img");
    expect(mocks.filters).toHaveLength(0);
  });
});
