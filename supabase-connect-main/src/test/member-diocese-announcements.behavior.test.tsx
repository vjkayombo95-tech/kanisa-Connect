import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  churchId: "church-a",
  user: { id: "user-a", email: "member-a@test.invalid" },
  parishAnnouncements: new Map<string, any[]>(),
  dioceseAnnouncements: new Map<string, any[]>(),
  parishError: null as Error | null,
  dioceseError: null as Error | null,
  pendingParish: false,
  reactionRows: [] as any[],
  commentRows: [] as any[],
  commentReactionRows: [] as any[],
  tableCalls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: state.churchId,
    user: state.user,
    profile: { full_name: "Member A", email: state.user.email },
    userRole: "member",
  }),
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ isFeatureEnabled: (key: string) => key === "announcements" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/portal-announcements", () => ({
  getPortalAnnouncementsCache: () => [],
  fetchPortalAnnouncements: async (churchId: string, limit: number) => {
    if (state.pendingParish) return new Promise(() => undefined);
    if (state.parishError) throw state.parishError;
    return (state.parishAnnouncements.get(churchId) ?? []).slice(0, limit);
  },
}));

vi.mock("@/lib/member-diocese-announcements", () => ({
  fetchMemberDioceseAnnouncements: async (churchId: string, limit: number) => {
    if (state.dioceseError) throw state.dioceseError;
    return (state.dioceseAnnouncements.get(churchId) ?? []).slice(0, limit);
  },
}));

vi.mock("@/components/announcements/AnnouncementContent", () => ({
  AnnouncementContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("@/components/portal/CommentThread", () => ({
  CommentThread: ({
    comments,
    draft,
    onDraftChange,
    onSubmit,
    onToggleReaction,
    headingLabel,
  }: {
    comments: any[];
    draft: string;
    onDraftChange: (value: string) => void;
    onSubmit: () => void;
    onToggleReaction: (commentId: string, emoji: string, reacted: boolean) => void;
    headingLabel: string;
  }) => (
    <section aria-label={headingLabel}>
      {comments.map((comment) => (
        <article key={comment.id}>
          <p>{comment.body}</p>
          <button type="button" onClick={() => onToggleReaction(comment.id, "🙏", false)}>
            react to comment
          </button>
        </article>
      ))}
      <input aria-label="comment draft" value={draft} onChange={(event) => onDraftChange(event.currentTarget.value)} />
      <button type="button" onClick={onSubmit}>
        submit comment
      </button>
    </section>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string) => {
      const labels: Record<string, string> = {
        "member_announcements.badges.diocese": "Diocese",
        "member_announcements.badges.celebration": "Celebration",
        "member_announcements.comments.heading": "Comments",
        "member_announcements.comments.placeholder": "Write a comment",
        "member_announcements.comments.empty": "No comments yet",
        "member_announcements.fallback_member": "Member",
        "member_announcements.title": "Announcements",
        "member_announcements.subtitle": "Latest parish updates",
        "member_announcements.loading": "Announcements loading",
        "member_announcements.empty.title": "No announcements",
        "member_announcements.empty.description": "Nothing here",
        "member_announcements.error.title": "Could not load announcements",
        "member_announcements.error.description": "Try again",
        "member_announcements.footer.celebration_note": "Celebration note",
        "member_announcements.image_alt_suffix": "image",
        "member_dashboard.announcements.title": "Latest Announcements",
        "member_dashboard.announcements.loading": "Loading announcements",
        "member_dashboard.announcements.empty_title": "No announcements",
        "member_dashboard.announcements.empty_description": "Check back later",
        "member_dashboard.announcements.error_title": "Announcements could not be loaded.",
        "member_dashboard.announcements.error_description": "Please try again.",
        "member_dashboard.actions.view_all": "View all",
        "member_dashboard.actions.retry": "Retry",
      };
      return labels[key] ?? key;
    },
  }),
}));

type Filter = { column: string; value: unknown };

function recordCall(table: string, method: string, args: unknown[]) {
  state.tableCalls.push({ table, method, args });
}

function installSupabaseTable(table: string) {
  const filters: Filter[] = [];
  const builder: Record<string, any> = {
    select: (...args: unknown[]) => {
      recordCall(table, "select", args);
      return builder;
    },
    in: (...args: unknown[]) => {
      recordCall(table, "in", args);
      return builder;
    },
    eq: (column: string, value: unknown) => {
      recordCall(table, "eq", [column, value]);
      filters.push({ column, value });
      return builder;
    },
    order: (...args: unknown[]) => {
      recordCall(table, "order", args);
      return builder;
    },
    delete: () => {
      recordCall(table, "delete", []);
      return builder;
    },
    upsert: async (...args: unknown[]) => {
      recordCall(table, "upsert", args);
      return { error: null };
    },
    insert: async (...args: unknown[]) => {
      recordCall(table, "insert", args);
      return { error: null };
    },
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      let data: any[] = [];
      if (table === "announcement_reactions") data = state.reactionRows;
      if (table === "announcement_comments") data = state.commentRows;
      if (table === "announcement_comment_reactions") data = state.commentReactionRows;
      if (table === "profiles") {
        data = [{ id: "commenter-a", full_name: "Commenter A" }];
      }
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => installSupabaseTable(table),
  },
}));

vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => ({ memberPortalAccess: "full" }),
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

vi.mock("@/lib/member-linked-requests", () => ({
  MASS_INTENTION_SELECT: "id",
  mapMassIntentionRecord: (row: unknown) => row,
}));

vi.mock("@/lib/file-upload", () => ({
  optimizeImage: async (file: File) => ({ blob: file }),
  uploadFile: async () => ({ publicUrl: "https://files.example/photo.jpg" }),
  validateFile: () => ({ valid: true }),
}));

import PortalAnnouncements from "@/pages/portal/PortalAnnouncements";
import PortalDashboard from "@/pages/portal/PortalDashboard";

const mounts: Array<{ host: HTMLDivElement; root: Root; client: QueryClient }> = [];

function parishAnnouncement(id: string, title: string, publishedAt: string, content = "Parish content") {
  return {
    id,
    church_id: state.churchId,
    title,
    content,
    is_published: true,
    published_at: publishedAt,
    publish_at: publishedAt,
    created_by: null,
    created_at: publishedAt,
    updated_at: publishedAt,
    archived_at: null,
  };
}

function dioceseAnnouncement(id: string, title: string, publishedAt: string, dioceseName = "Diocese of Test") {
  return {
    id,
    diocese_id: "diocese-a",
    church_id: state.churchId,
    diocese_name: dioceseName,
    title,
    content: "Diocese content",
    published_at: publishedAt,
    created_at: publishedAt,
    updated_at: publishedAt,
    target_mode: "all_parishes",
    source: "diocese",
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithClient(children: ReactNode, client = createClient()) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>,
    );
  });
  mounts.push({ host, root, client });
  return { host, root, client };
}

async function waitForText(host: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (host.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`Expected "${text}" in rendered output: ${host.textContent}`);
}

function setChurchData(churchId: string, parishRows: any[], dioceseRows: any[]) {
  state.parishAnnouncements.set(churchId, parishRows.map((row) => ({ ...row, church_id: churchId })));
  state.dioceseAnnouncements.set(churchId, dioceseRows.map((row) => ({ ...row, church_id: churchId })));
}

beforeEach(() => {
  state.churchId = "church-a";
  state.parishAnnouncements = new Map();
  state.dioceseAnnouncements = new Map();
  state.parishError = null;
  state.dioceseError = null;
  state.pendingParish = false;
  state.reactionRows = [];
  state.commentRows = [];
  state.commentReactionRows = [];
  state.tableCalls = [];
});

afterEach(() => {
  for (const { host, root, client } of mounts.splice(0)) {
    act(() => root.unmount());
    client.clear();
    host.remove();
  }
  vi.restoreAllMocks();
});

describe("member Diocese announcements frontend behavior", () => {
  it("renders parish and Diocese announcements together with Diocese source details", async () => {
    setChurchData("church-a", [
      parishAnnouncement("parish-a", "Parish picnic", "2026-10-12T09:00:00Z"),
    ], [
      dioceseAnnouncement("diocese-a", "Diocese pastoral letter", "2026-10-12T10:00:00Z", "Archdiocese A"),
    ]);

    const { host } = renderWithClient(<PortalAnnouncements />);

    await waitForText(host, "Parish picnic");
    await waitForText(host, "Diocese pastoral letter");

    expect(host.textContent).toContain("Diocese");
    expect(host.textContent).toContain("Archdiocese A");
  });

  it("keeps parish reactions and comments interactive while Diocese announcements stay read-only", async () => {
    setChurchData("church-a", [
      parishAnnouncement("parish-celebration", "Birthday celebration", "2026-10-12T09:00:00Z", "Birthday party"),
    ], [
      dioceseAnnouncement("diocese-readonly", "Diocese notice", "2026-10-12T08:00:00Z"),
    ]);
    state.reactionRows = [{ announcement_id: "parish-celebration", user_id: "user-a", emoji: "🎉" }];
    state.commentRows = [{ id: "comment-a", announcement_id: "parish-celebration", user_id: "commenter-a", body: "Hongera", created_at: "2026-10-12T09:30:00Z" }];

    const { host } = renderWithClient(<PortalAnnouncements />);

    await waitForText(host, "Birthday celebration");
    await waitForText(host, "Diocese notice");
    await waitForText(host, "Hongera");

    expect(host.querySelectorAll('section[aria-label="Comments"]')).toHaveLength(1);
    expect(host.textContent).toContain("🎉");

    const buttons = Array.from(host.querySelectorAll("button"));
    const addEmoji = buttons.find((button) => button.textContent?.includes("👏"));
    const submit = buttons.find((button) => button.textContent?.includes("submit comment"));
    const commentReaction = buttons.find((button) => button.textContent?.includes("react to comment"));
    expect(addEmoji).toBeDefined();
    expect(submit).toBeDefined();
    expect(commentReaction).toBeDefined();

    const input = host.querySelector<HTMLInputElement>('input[aria-label="comment draft"]');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, "New parish comment");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      addEmoji!.click();
      submit!.click();
      commentReaction!.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(state.tableCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "announcement_reactions", method: "upsert" }),
      expect.objectContaining({ table: "announcement_comments", method: "insert" }),
      expect.objectContaining({ table: "announcement_comment_reactions", method: "upsert" }),
    ]));
    expect(state.tableCalls.filter((call) => JSON.stringify(call.args).includes("diocese-readonly"))).toEqual([]);
  });

  it("never sends Diocese announcement IDs to parish reaction or comment reads", async () => {
    setChurchData("church-a", [
      parishAnnouncement("parish-celebration", "Wedding anniversary", "2026-10-12T09:00:00Z", "Wedding anniversary"),
    ], [
      dioceseAnnouncement("diocese-should-not-query", "Diocese notice", "2026-10-12T08:00:00Z"),
    ]);

    const { host } = renderWithClient(<PortalAnnouncements />);

    await waitForText(host, "Diocese notice");

    const parishReadCalls = state.tableCalls.filter(
      (call) => ["announcement_reactions", "announcement_comments"].includes(call.table) && call.method === "in",
    );
    expect(parishReadCalls).toHaveLength(2);
    expect(JSON.stringify(parishReadCalls)).toContain("parish-celebration");
    expect(JSON.stringify(parishReadCalls)).not.toContain("diocese-should-not-query");
  });

  it("switches active church without showing previous church announcements", async () => {
    setChurchData("church-a", [
      parishAnnouncement("parish-a", "Parish A only", "2026-10-12T09:00:00Z"),
    ], [
      dioceseAnnouncement("diocese-a", "Diocese A only", "2026-10-12T10:00:00Z"),
    ]);
    setChurchData("church-b", [
      parishAnnouncement("parish-b", "Parish B only", "2026-10-13T09:00:00Z"),
    ], [
      dioceseAnnouncement("diocese-b", "Diocese B only", "2026-10-13T10:00:00Z"),
    ]);
    const client = createClient();
    const { host, root } = renderWithClient(<PortalAnnouncements />, client);

    await waitForText(host, "Parish A only");

    state.churchId = "church-b";
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <PortalAnnouncements />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    await waitForText(host, "Parish B only");
    await waitForText(host, "Diocese B only");
    expect(host.textContent).not.toContain("Parish A only");
    expect(host.textContent).not.toContain("Diocese A only");
  });

  it("renders parish announcements when the Diocese RPC fails", async () => {
    setChurchData("church-a", [
      parishAnnouncement("parish-a", "Parish survives", "2026-10-12T09:00:00Z"),
    ], []);
    state.dioceseError = new Error("diocese rpc unavailable");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { host } = renderWithClient(<PortalAnnouncements />);

    await waitForText(host, "Parish survives");
    expect(host.textContent).not.toContain("Could not load announcements");
  });

  it("dashboard preview merges both sources in date order, caps at three, and keeps Diocese read-only", async () => {
    setChurchData("church-a", [
      parishAnnouncement("parish-old", "Parish older", "2026-10-10T09:00:00Z"),
      parishAnnouncement("parish-new", "Parish newest", "2026-10-14T09:00:00Z"),
    ], [
      dioceseAnnouncement("diocese-mid", "Diocese middle", "2026-10-13T09:00:00Z"),
      dioceseAnnouncement("diocese-extra", "Diocese extra hidden", "2026-10-09T09:00:00Z"),
    ]);

    const { host } = renderWithClient(<PortalDashboard />);

    await waitForText(host, "Parish newest");
    await waitForText(host, "Diocese middle");
    await waitForText(host, "Parish older");

    const text = host.textContent ?? "";
    expect(text.indexOf("Parish newest")).toBeLessThan(text.indexOf("Diocese middle"));
    expect(text.indexOf("Diocese middle")).toBeLessThan(text.indexOf("Parish older"));
    expect(text).not.toContain("Diocese extra hidden");
    expect(host.textContent).toContain("Diocese");
    expect(host.querySelector('section[aria-label="Comments"]')).toBeNull();
    expect(state.tableCalls.filter((call) => call.table.includes("announcement_"))).toEqual([]);
  });

  it("dashboard distinguishes loading, empty, parish failure, and Diocese-only failure states", async () => {
    state.pendingParish = true;
    let rendered = renderWithClient(<PortalDashboard />);
    await waitForText(rendered.host, "Loading announcements");

    act(() => rendered.root.unmount());
    rendered.client.clear();
    rendered.host.remove();
    mounts.pop();

    state.pendingParish = false;
    setChurchData("church-a", [], []);
    rendered = renderWithClient(<PortalDashboard />);
    await waitForText(rendered.host, "No announcements");

    act(() => rendered.root.unmount());
    rendered.client.clear();
    rendered.host.remove();
    mounts.pop();

    state.parishError = new Error("parish unavailable");
    rendered = renderWithClient(<PortalDashboard />);
    await waitForText(rendered.host, "Announcements could not be loaded.");
    expect(rendered.host.textContent).toContain("Retry");

    act(() => rendered.root.unmount());
    rendered.client.clear();
    rendered.host.remove();
    mounts.pop();

    state.parishError = null;
    state.dioceseError = new Error("diocese unavailable");
    setChurchData("church-a", [
      parishAnnouncement("parish-a", "Parish still visible", "2026-10-12T09:00:00Z"),
    ], []);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    rendered = renderWithClient(<PortalDashboard />);
    await waitForText(rendered.host, "Parish still visible");
    expect(rendered.host.textContent).not.toContain("Announcements could not be loaded.");
  });
});
