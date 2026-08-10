import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchMemberForUser: vi.fn(),
  fetchMemberCmsDailyReadingByDate: vi.fn(),
  fetchPublishedCmsPrayers: vi.fn(),
  fetchParishCalendarFeed: vi.fn(),
}));

vi.mock("@/hooks/useMember", () => ({
  fetchMemberForUser: mocks.fetchMemberForUser,
}));

vi.mock("@/lib/super-admin/daily-readings-service", () => ({
  fetchMemberCmsDailyReadingByDate: mocks.fetchMemberCmsDailyReadingByDate,
}));

vi.mock("@/lib/super-admin/prayer-library-service", () => ({
  fetchPublishedCmsPrayers: mocks.fetchPublishedCmsPrayers,
}));

vi.mock("@/lib/calendar", () => ({
  fetchParishCalendarFeed: mocks.fetchParishCalendarFeed,
}));

function supabaseQuery(table: string) {
  const saint = {
    id: "saint-cold",
    slug: "saint-cold-start",
    name: "Saint Cold Start",
    title: "Witness",
    feast_month: new Date().getMonth() + 1,
    feast_day: new Date().getDate(),
    patron_of: "Reliable retrieval",
    biography_short: "A published saint retrieved for a fresh session.",
    biography_long: "",
    reflection: "",
    prayer: "",
    image_url: null,
    liturgical_rank: "Saint",
    is_featured: false,
  };
  const contributions = [{ id: "contribution-cold", amount: 2500, date: "2026-07-05", created_at: "2026-07-05", notes: "Offering" }];
  const intentions = [{ id: "mass-cold", intention_for: "Family", intention_type: "shukrani", message: "Thanksgiving", status: "pending", created_at: "2026-07-05", member_id: "member-1", church_id: "church-1", members: { full_name: "Peter Mark", email: "peter@example.com" } }];
  const data = table === "saints" ? [saint] : table === "contributions" ? contributions : table === "mass_intentions" ? intentions : [];
  const result = { data, error: null };
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
    then: (resolve: (value: typeof result) => void, reject: (reason?: unknown) => void) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => supabaseQuery(table)),
  },
}));

import {
  answerKanisaAIConversation,
  answerKanisaAIConversationAsync,
  createKanisaAIContext,
  createKanisaAssistantMessage,
  createKanisaUserMessage,
} from "@/lib/ai";
import type { WorkspaceId } from "@/components/workspace";

function queryClientWith(rows: Array<[unknown[], unknown]>) {
  return {
    getQueriesData({ queryKey }: { queryKey: unknown[] }) {
      return rows.filter(([key]) => queryKey.every((part, index) => Object.is((key as unknown[])[index], part)));
    },
  } as never;
}

function context(workspace: WorkspaceId, queryRows: Array<[unknown[], unknown]> = []) {
  return createKanisaAIContext({
    workspace,
    role: workspace === "member" ? "member" as never : workspace as never,
    church: { id: "church-1" },
    tenant: { id: "church-1" },
    route: `/${workspace}`,
    queryClient: queryClientWith(queryRows),
  });
}

function asyncContext(workspace: WorkspaceId) {
  return createKanisaAIContext({
    workspace,
    role: workspace === "member" ? "member" as never : workspace as never,
    church: { id: "church-1" },
    tenant: { id: "church-1" },
    route: `/${workspace}`,
    queryClient: new QueryClient(),
    user: { id: "user-1", email: "peter@example.com" },
  });
}

describe("Kanisa AI conversation", () => {
  beforeEach(() => {
    mocks.fetchMemberForUser.mockResolvedValue({ id: "member-1", full_name: "Peter Mark", church_id: "church-1", email: "peter@example.com" });
    mocks.fetchMemberCmsDailyReadingByDate.mockResolvedValue({
      id: "reading-cold",
      reading_date: "2026-07-05",
      celebration: "Sunday of Ordinary Time",
      status: "published",
      visibility: "member",
      first_reading_reference: "Isaiah 66:10-14",
      responsorial_psalm_reference: "Psalm 66",
      second_reading_reference: "Galatians 6:14-18",
      gospel_reference: "Luke 10:1-12",
      reflection: "Go and proclaim peace.",
      prayer: null,
    });
    mocks.fetchPublishedCmsPrayers.mockResolvedValue([
      {
        id: "prayer-cold",
        title: "Prayer for Healing",
        slug: "prayer-for-healing",
        summary: "A prayer for healing.",
        body: "Lord, heal us.",
        status: "published",
        visibility: "member",
        featured: false,
        category: { id: "cat-healing", name: "Healing", slug: "healing", color: null },
      },
      {
        id: "draft-prayer",
        title: "Draft Prayer",
        slug: "draft-prayer",
        summary: null,
        body: "Hidden",
        status: "draft",
        visibility: "admin",
        featured: false,
      },
    ]);
    mocks.fetchParishCalendarFeed.mockResolvedValue([
      { id: "event-cold", title: "Youth Retreat", description: "Authorized retreat", startsAt: new Date(Date.now() + 86_400_000), type: "retreat", visibility: "member" },
    ]);
  });

  it("returns an empty response for empty submissions", () => {
    const response = answerKanisaAIConversation("   ", context("member"));
    expect(response.status).toBe("empty");
  });

  it("creates user and assistant messages", () => {
    const user = createKanisaUserMessage("What are today's readings?");
    const assistant = createKanisaAssistantMessage(answerKanisaAIConversation("What are today's readings?", context("member")));

    expect(user.role).toBe("user");
    expect(assistant.role).toBe("assistant");
    expect(assistant.response).toBeTruthy();
  });

  it("answers member daily readings from the local query cache", () => {
    const response = answerKanisaAIConversation(
      "What are today's readings?",
      context("member", [
        [
          ["member-cms-daily-reading", "today"],
          {
            id: "reading-1",
            reading_date: "2026-07-04",
            celebration: "Saturday of Ordinary Time",
            status: "published",
            visibility: "member",
            first_reading_reference: "Amos 9:11-15",
            responsorial_psalm_reference: "Psalm 85",
            gospel_reference: "Matthew 9:14-17",
          },
        ],
      ]),
    );

    expect(response.status).toBe("success");
    expect(response.title).toContain("Ordinary Time");
    expect(response.actions.some((action) => action.preview?.type === "daily_reading")).toBe(true);
    expect(response.actions.some((action) => action.route === "/portal/daily-readings")).toBe(true);
  });

  it("answers today's saint directly with a preview instead of a navigation-only card", () => {
    const response = answerKanisaAIConversation(
      "Who is today's saint?",
      context("member", [
        [
          ["saint-of-day", "2026-07-05"],
          {
            liturgicalDay: { id: "day-1", date: "2026-07-05", celebration: "Blessed Carlo Acutis", saint: "Blessed Carlo Acutis" },
            saint: {
              id: "saint-1",
              slug: "blessed-carlo-acutis",
              name: "Blessed Carlo Acutis",
              title: "Apostle of the Eucharist",
              feast_month: 10,
              feast_day: 12,
              patron_of: "Computer programmers and youth",
              biography_short: "Blessed Carlo Acutis used technology to point people to the Eucharist.",
              biography_long: "",
              reflection: "Use digital tools wisely.",
              prayer: "Pray for us.",
              image_url: null,
              liturgical_rank: "Blessed",
            },
          },
        ],
      ]),
    );

    expect(response.status).toBe("success");
    expect(response.title).toBe("Blessed Carlo Acutis");
    expect(response.summary).not.toContain("workspace module");
    expect(response.actions[0].preview?.type).toBe("saint");
    expect(response.actions.some((action) => action.route === "/portal/library/blessed-carlo-acutis")).toBe(true);
  });

  it("retrieves today's saint from an authorized source when cache is empty", async () => {
    const response = await answerKanisaAIConversationAsync("Who is today's saint?", asyncContext("member"));

    expect(response.status).toBe("success");
    expect(response.title).toBe("Saint Cold Start");
    expect(response.summary).not.toContain("cache");
    expect(response.summary).not.toContain("workspace module");
    expect(response.actions.some((action) => action.preview?.type === "saint")).toBe(true);
    expect(response.actions.some((action) => action.route === "/portal/library/saint-cold-start")).toBe(true);
  });

  it("returns an honest saint empty state without cache implementation copy", async () => {
    const originalFrom = (await import("@/integrations/supabase/client")).supabase.from as unknown as ReturnType<typeof vi.fn>;
    originalFrom.mockImplementationOnce(() => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return builder;
    });
    const response = await answerKanisaAIConversationAsync("Who is today's saint?", asyncContext("member"));

    expect(response.status).toBe("empty");
    expect(response.summary).toBe("No saint is currently published for today.");
    expect(response.summary).not.toContain("cache");
    expect(response.title).not.toContain("Loaded");
  });

  it("retrieves daily readings when cache is empty", async () => {
    const response = await answerKanisaAIConversationAsync("What are today's readings?", asyncContext("member"));

    expect(mocks.fetchMemberCmsDailyReadingByDate).toHaveBeenCalled();
    expect(response.status).toBe("success");
    expect(response.sections[0].items?.map((item) => item.description)).toContain("Luke 10:1-12");
    expect(response.actions.some((action) => action.preview?.type === "daily_reading")).toBe(true);
  });

  it("retrieves prayer matches when cache is empty and excludes unpublished prayers", async () => {
    const response = await answerKanisaAIConversationAsync("Find a prayer for healing", asyncContext("member"));

    expect(mocks.fetchPublishedCmsPrayers).toHaveBeenCalled();
    expect(response.status).toBe("success");
    expect(response.sections[0].items?.map((item) => item.title)).toEqual(["Prayer for Healing"]);
  });

  it("retrieves authorized calendar events when cache is empty", async () => {
    const response = await answerKanisaAIConversationAsync("What events are coming up?", asyncContext("member"));

    expect(mocks.fetchParishCalendarFeed).toHaveBeenCalled();
    expect(response.status).toBe("success");
    expect(response.sections[0].items?.map((item) => item.title)).toEqual(["Youth Retreat"]);
  });

  it("retrieves member Mass intentions when cache is empty", async () => {
    const response = await answerKanisaAIConversationAsync("Show my Mass intentions", asyncContext("member"));

    expect(mocks.fetchMemberForUser).toHaveBeenCalled();
    expect(response.status).toBe("success");
    expect(response.actions.some((action) => action.preview?.type === "mass_intention")).toBe(true);
  });

  it("retrieves member contributions when cache is empty", async () => {
    const response = await answerKanisaAIConversationAsync("Show my contributions", asyncContext("member"));

    expect(mocks.fetchMemberForUser).toHaveBeenCalled();
    expect(response.status).toBe("success");
    expect(response.actions.some((action) => action.preview?.type === "contribution_summary")).toBe(true);
  });

  it("answers member prayer searches with member-visible published prayers", () => {
    const response = answerKanisaAIConversation(
      "Find me a prayer for healing",
      context("member", [
        [
          ["member-catholic-library-prayers"],
          [
            {
              id: "prayer-1",
              title: "Prayer for Healing",
              slug: "prayer-for-healing",
              summary: "A prayer for healing and peace.",
              body: "Lord, bring healing.",
              status: "published",
              visibility: "member",
              category: { name: "Healing" },
            },
            {
              id: "admin-only",
              title: "Internal Prayer",
              body: "Hidden",
              status: "draft",
              visibility: "admin",
            },
          ],
        ],
      ]),
    );

    expect(response.status).toBe("success");
    expect(response.sections[0].items?.map((item) => item.title)).toEqual(["Prayer for Healing"]);
    expect(response.actions.some((action) => action.preview?.type === "prayer")).toBe(true);
    expect(response.actions.some((action) => action.route === "/portal/library")).toBe(true);
  });

  it("keeps member contribution requests member scoped", () => {
    const response = answerKanisaAIConversation(
      "Show my contributions",
      context("member", [[["my-contributions", "member-1"], [{ id: "c1", amount: 1500 }]]]),
    );

    expect(response.status).toBe("success");
    expect(response.actions.some((action) => action.preview?.type === "contribution_summary")).toBe(true);
    expect(response.actions.some((action) => action.route === "/portal/contribution-history")).toBe(true);
  });

  it("keeps Mass intention answers scoped and previewable", () => {
    const response = answerKanisaAIConversation(
      "Show my Mass intentions",
      context("member", [[["my-mass-intentions", "member-1"], [{ id: "m1", intention_for: "Maria A.", status: "scheduled", message: "Thanksgiving" }]]]),
    );

    expect(response.status).toBe("success");
    expect(response.actions.some((action) => action.preview?.type === "mass_intention")).toBe(true);
    expect(response.actions.some((action) => action.route === "/portal/mass-intentions")).toBe(true);
  });

  it("denies member parish-wide finance analytics", () => {
    const response = answerKanisaAIConversation("Show parish giving trends", context("member"));
    expect(response.status).toBe("unauthorized");
    expect(response.actions[0].route).toBe("/portal/contribution-history");
  });

  it("marks provider-backed generation as provider required", () => {
    const response = answerKanisaAIConversation("Write a homily for Sunday", context("pastoral"));
    expect(response.status).toBe("provider_required");
    expect(response.providerRequired).toBe(true);
    expect(response.summary).not.toContain("Dear parishioners");
  });

  it("uses super admin routes for system jobs", () => {
    const response = answerKanisaAIConversation("Show system jobs", context("super_admin"));
    expect(response.status).toBe("success");
    expect(response.actions[0].route).toBe("/super-admin/jobs");
  });

  it("blocks platform requests outside super admin", () => {
    const response = answerKanisaAIConversation("Open audit logs", context("member"));
    expect(response.status).toBe("unavailable");
    expect(response.actions.some((action) => action.route?.startsWith("/church-admin"))).toBe(false);
  });
});
