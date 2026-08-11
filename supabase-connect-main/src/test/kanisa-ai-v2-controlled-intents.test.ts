import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>, rpcRows: {} as Record<string, unknown>, errors: {} as Record<string, unknown>, calls: [] as Array<[string, string, unknown]>, selects: [] as Array<[string, string]>,
  livestream: vi.fn(), radio: vi.fn(), pdfOutput: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
}));

vi.mock("@/lib/church-livestreams", () => ({ fetchMemberLivestream: mocks.livestream }));
vi.mock("@/lib/church-radio", () => ({ fetchMemberRadioStations: mocks.radio }));
vi.mock("@/lib/calendar", () => ({ fetchParishCalendarFeed: vi.fn().mockResolvedValue([]) }));
vi.mock("jspdf", () => ({ default: class { setFont() {} setFontSize() {} text() {} output() { return mocks.pdfOutput(); } } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: vi.fn((table: string) => { const builder: Record<string, unknown> = {};
    builder.select = (columns: string) => { mocks.selects.push([table, columns]); return builder; };
    for (const method of ["eq", "gte", "lt"]) builder[method] = (column: string, value: unknown) => { mocks.calls.push([table, column, value]); return builder; };
    builder.order = () => builder;
    builder.then = (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) => Promise.resolve({ data: mocks.rows[table] ?? [], error: mocks.errors[table] ?? null }).then(resolve, reject);
    return builder;
  }),
  rpc: vi.fn((name: string, args: unknown) => { mocks.calls.push(["rpc", name, args]); return Promise.resolve({ data: mocks.rpcRows[name] ?? [], error: mocks.errors[name] ?? null }); }),
} }));

import { answerControlledKanisaAIIntent, classifyControlledKanisaAIIntent, classifyReportPeriodText, createKanisaAIContext, generateControlledContributionReport, isContributionReportRequest, resolveReportPeriod } from "@/lib/ai";
import type { WorkspaceId } from "@/components/workspace";

const now = new Date("2026-08-11T10:00:00+03:00");
function context(workspace: WorkspaceId, role: string, churchId: string | null = "church-1") { return createKanisaAIContext({ workspace, role, church: { id: churchId, name: "Test Church" }, tenant: { id: churchId }, user: { id: "user-1", email: "test@example.com" }, route: `/${workspace}/kanisa-ai` }); }

describe("Kanisa AI V2 controlled intents", () => {
  beforeEach(() => { mocks.rows = {}; mocks.rpcRows = {}; mocks.errors = {}; mocks.calls = []; mocks.selects = []; mocks.livestream.mockReset().mockResolvedValue(null); mocks.radio.mockReset().mockResolvedValue([]); Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:report-1") }); Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() }); });

  it.each([
    ["How many members do we have?", "MEMBER_COUNT"], ["Tuna waumini wangapi?", "MEMBER_COUNT"], ["Any new members?", "NEW_MEMBERS"], ["Kuna waumini wapya?", "NEW_MEMBERS"],
    ["How much is still unpaid?", "OUTSTANDING_PLEDGES"], ["Michango ambayo haijalipwa ni kiasi gani?", "OUTSTANDING_PLEDGES"], ["Any Mass intentions waiting?", "PENDING_MASS_INTENTIONS"], ["Kuna nia za misa zinazosubiri?", "PENDING_MASS_INTENTIONS"],
    ["Is anything live?", "LIVE_MEDIA_STATUS"], ["Radio gani zinapatikana?", "LIVE_MEDIA_STATUS"], ["What needs my attention?", "ATTENTION_SUMMARY"], ["Nifanye nini leo?", "ATTENTION_SUMMARY"],
  ])("recognizes %s", (input, expected) => expect(classifyControlledKanisaAIIntent(input)).toBe(expected));

  it("returns member totals and active distinctions", async () => { mocks.rows.members = [{ id: "m1", status: "active", created_at: "2026-08-01" }, { id: "m2", status: "inactive", created_at: "2026-07-01" }]; const answer = await answerControlledKanisaAIIntent("MEMBER_COUNT", context("church_admin", "church_admin"), now); expect(answer.metrics).toMatchObject({ registeredMembers: 2, activeMembers: 1, inactiveMembers: 1 }); expect(answer.action?.route).toBe("/church-admin/members"); });
  it("returns the member-count zero state", async () => expect((await answerControlledKanisaAIIntent("MEMBER_COUNT", context("church_admin", "church_admin"), now)).status).toBe("empty"));
  it("forbids member access to parish member totals without counts", async () => { const answer = await answerControlledKanisaAIIntent("MEMBER_COUNT", context("member", "member"), now); expect(answer.status).toBe("forbidden"); expect(answer.metrics).toBeUndefined(); });
  it("scopes member queries to the authoritative church", async () => { await answerControlledKanisaAIIntent("MEMBER_COUNT", context("church_admin", "church_admin"), now); expect(mocks.calls).toContainEqual(["members", "church_id", "church-1"]); });

  it("returns new members within current month boundaries", async () => { mocks.rows.members = [{ id: "m1", status: "active", created_at: "2026-08-03" }]; const answer = await answerControlledKanisaAIIntent("NEW_MEMBERS", context("church_admin", "secretary"), now); expect(answer.metrics).toMatchObject({ newMembersThisMonth: 1 }); expect(mocks.calls).toContainEqual(["members", "created_at", "2026-08-01"]); });
  it("returns the new-member zero state", async () => expect((await answerControlledKanisaAIIntent("NEW_MEMBERS", context("church_admin", "secretary"), now)).status).toBe("empty"));

  it("calculates outstanding pledge balance/count/paid amount from the trusted RPC", async () => { mocks.rpcRows.get_church_pledges_summary = [{ balance: 850000, total_paid: 150000, pledge_count: 20, completed_count: 2 }]; const answer = await answerControlledKanisaAIIntent("OUTSTANDING_PLEDGES", context("finance", "treasurer"), now); expect(answer.metrics).toEqual({ outstandingAmount: 850000, outstandingPledges: 18, paidAmount: 150000 }); });
  it("returns the outstanding pledge zero state", async () => expect((await answerControlledKanisaAIIntent("OUTSTANDING_PLEDGES", context("finance", "treasurer"), now)).status).toBe("empty"));
  it("forbids non-finance roles from pledge counts", async () => expect((await answerControlledKanisaAIIntent("OUTSTANDING_PLEDGES", context("pastoral", "pastor"), now)).status).toBe("forbidden"));
  it("passes only authoritative church ID to the pledge RPC", async () => { await answerControlledKanisaAIIntent("OUTSTANDING_PLEDGES", context("finance", "treasurer"), now); expect(mocks.calls).toContainEqual(["rpc", "get_church_pledges_summary", { _church_id: "church-1" }]); });

  it("returns pending Mass intention count without sensitive text", async () => { mocks.rows.mass_intentions = [{ id: "mi1", status: "pending", mass_date: "2026-08-20", intention: "private" }]; const answer = await answerControlledKanisaAIIntent("PENDING_MASS_INTENTIONS", context("pastoral", "pastor"), now); expect(answer.metrics).toMatchObject({ pendingMassIntentions: 1 }); expect(JSON.stringify(answer)).not.toContain("private"); expect(mocks.selects).toContainEqual(["mass_intentions", "id,status,mass_date"]); });
  it("returns pending Mass intention zero state", async () => expect((await answerControlledKanisaAIIntent("PENDING_MASS_INTENTIONS", context("pastoral", "pastor"), now)).status).toBe("empty"));
  it("uses the pastoral Mass-intention deep link", async () => expect((await answerControlledKanisaAIIntent("PENDING_MASS_INTENTIONS", context("pastoral", "pastor"), now)).action?.route).toBe("/pastoral/mass-intentions"));

  it("reports livestream only without autoplay", async () => { mocks.livestream.mockResolvedValue({ id: "live-1", churchId: "church-1", status: "live" }); const answer = await answerControlledKanisaAIIntent("LIVE_MEDIA_STATUS", context("member", "member"), now); expect(answer.followUps?.[0].route).toBe("/portal/live/live-1"); expect(JSON.stringify(answer)).not.toContain("autoplay"); });
  it("reports radio only", async () => { mocks.radio.mockResolvedValue([{ id: "r1", churchId: "church-1" }]); const answer = await answerControlledKanisaAIIntent("LIVE_MEDIA_STATUS", context("member", "member"), now); expect(answer.summary).toContain("1 radio station is available"); expect(answer.followUps?.[0].route).toBe("/portal/radio"); });
  it("reports livestream plus multiple radio stations", async () => { mocks.livestream.mockResolvedValue({ id: "live-1", churchId: "church-1", status: "live" }); mocks.radio.mockResolvedValue([{ id: "r1", churchId: "church-1" }, { id: "r2", churchId: "church-1" }]); expect((await answerControlledKanisaAIIntent("LIVE_MEDIA_STATUS", context("member", "member"), now)).metrics).toEqual({ liveMass: 1, availableRadioStations: 2 }); });
  it("reports neither live source honestly", async () => expect((await answerControlledKanisaAIIntent("LIVE_MEDIA_STATUS", context("member", "member"), now)).status).toBe("empty"));
  it("defensively excludes cross-church live media", async () => { mocks.livestream.mockResolvedValue({ id: "foreign", churchId: "church-2", status: "live" }); mocks.radio.mockResolvedValue([{ id: "r1", churchId: "church-2" }]); expect((await answerControlledKanisaAIIntent("LIVE_MEDIA_STATUS", context("member", "member"), now)).status).toBe("empty"); });

  it("builds Church Admin attention total from approved sources", async () => { mocks.rows.invitations = [{ id: "i1", created_at: "2026-08-10", status: "pending" }]; mocks.rows.prayer_requests = [{ id: "p1", status: "pending" }, { id: "p2", status: "pending" }]; const answer = await answerControlledKanisaAIIntent("ATTENTION_SUMMARY", context("church_admin", "church_admin"), now); expect(answer.metrics).toEqual({ verifiedAttentionItems: 3 }); expect(answer.followUps).toHaveLength(2); });
  it("builds Treasurer attention only from finance sources", async () => { mocks.rpcRows.get_church_pledges_summary = [{ balance: 5, total_paid: 2, pledge_count: 2, completed_count: 1 }]; expect((await answerControlledKanisaAIIntent("ATTENTION_SUMMARY", context("finance", "treasurer"), now)).metrics).toEqual({ verifiedAttentionItems: 1 }); });
  it("builds Pastor attention from prayer and Mass intentions", async () => { mocks.rows.prayer_requests = [{ id: "p1", status: "pending" }]; mocks.rows.mass_intentions = [{ id: "m1", status: "pending", mass_date: null }]; expect((await answerControlledKanisaAIIntent("ATTENTION_SUMMARY", context("pastoral", "pastor"), now)).metrics).toEqual({ verifiedAttentionItems: 2 }); });
  it("gives members no staff operational totals", async () => expect((await answerControlledKanisaAIIntent("ATTENTION_SUMMARY", context("member", "member"), now)).metrics).toEqual({ verifiedAttentionItems: 0 }));
  it("fails closed for Community Leader attention without community context", async () => expect((await answerControlledKanisaAIIntent("ATTENTION_SUMMARY", context("church_admin", "community_leader"), now)).status).toBe("forbidden"));
  it("fails closed for Super Admin without explicit tenant context", async () => expect((await answerControlledKanisaAIIntent("ATTENTION_SUMMARY", context("super_admin", "super_admin", null), now)).status).toBe("forbidden"));
  it("does not manufacture attention total when every source fails", async () => { mocks.errors.invitations = { message: "network" }; mocks.errors.prayer_requests = { message: "network" }; const answer = await answerControlledKanisaAIIntent("ATTENTION_SUMMARY", context("church_admin", "church_admin"), now); expect(answer.status).toBe("error"); expect(answer.metrics).toBeUndefined(); });
});

describe("controlled contribution report", () => {
  beforeEach(() => { mocks.rows = {}; mocks.rpcRows = { has_church_feature_permission: true }; mocks.errors = {}; mocks.calls = []; mocks.selects = []; Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:report-1") }); });
  it("accepts current, previous, three-month, and valid custom periods", () => { expect(resolveReportPeriod({ kind: "current_month" }, now)).toBeTruthy(); expect(resolveReportPeriod({ kind: "previous_month" }, now)).toBeTruthy(); expect(resolveReportPeriod({ kind: "last_n_months", months: 3 }, now)).toBeTruthy(); expect(resolveReportPeriod({ kind: "custom", startDate: "2026-01-01", endDate: "2026-02-01" }, now)).toBeTruthy(); });
  it("recognizes natural PDF follow-ups only as explicit report requests", () => { expect(isContributionReportRequest("yes, generate it")).toBe(true); expect(isContributionReportRequest("nitengenezee pdf")).toBe(true); expect(isContributionReportRequest("show members")).toBe(false); });
  it("recognizes controlled period follow-up text", () => { expect(classifyReportPeriodText("This Month")).toEqual({ kind: "current_month" }); expect(classifyReportPeriodText("Mwezi uliopita")).toEqual({ kind: "previous_month" }); expect(classifyReportPeriodText("Last 3 months")).toEqual({ kind: "last_n_months", months: 3 }); });
  it("rejects reversed, invalid, and excessive custom periods", () => { expect(resolveReportPeriod({ kind: "custom", startDate: "2026-02-01", endDate: "2026-01-01" }, now)).toBeNull(); expect(resolveReportPeriod({ kind: "custom", startDate: "bad", endDate: "2026-01-01" }, now)).toBeNull(); expect(resolveReportPeriod({ kind: "custom", startDate: "2024-01-01", endDate: "2026-01-01" }, now)).toBeNull(); });
  it("rechecks report authorization through the server permission RPC", async () => { mocks.rows.contributions = [{ amount: 100, date: "2026-08-01", contribution_categories: { name: "Offering" } }]; await generateControlledContributionReport("CONTRIBUTION_SUMMARY_REPORT", { kind: "current_month" }, context("finance", "treasurer")); expect(mocks.calls.some((call) => call[0] === "rpc" && call[1] === "has_church_feature_permission")).toBe(true); });
  it("denies PDF when authorization recheck fails", async () => { mocks.rpcRows.has_church_feature_permission = false; expect((await generateControlledContributionReport("CONTRIBUTION_SUMMARY_REPORT", { kind: "current_month" }, context("finance", "treasurer"))).status).toBe("forbidden"); });
  it("cannot override authoritative church with a browser payload", async () => { mocks.rows.contributions = [{ amount: 100, date: "2026-08-01" }]; await generateControlledContributionReport("CONTRIBUTION_SUMMARY_REPORT", { kind: "current_month" }, context("finance", "treasurer")); expect(mocks.calls).toContainEqual(["contributions", "church_id", "church-1"]); expect(JSON.stringify(mocks.calls)).not.toContain("church-2"); });
  it("rejects unknown report types", async () => expect((await generateControlledContributionReport("ANY_REPORT" as never, { kind: "current_month" }, context("finance", "treasurer"))).status).toBe("forbidden"));
  it("returns no-data without claiming a PDF exists", async () => { const result = await generateControlledContributionReport("CONTRIBUTION_SUMMARY_REPORT", { kind: "current_month" }, context("finance", "treasurer")); expect(result.status).toBe("no_data"); expect(result.url).toBeUndefined(); });
  it("creates an ephemeral private blob URL for a successful PDF", async () => { mocks.rows.contributions = [{ amount: 100, date: "2026-08-01", contribution_categories: { name: "Offering" } }]; const result = await generateControlledContributionReport("CONTRIBUTION_SUMMARY_REPORT", { kind: "current_month" }, context("finance", "treasurer")); expect(result.status).toBe("success"); expect(result.url).toBe("blob:report-1"); expect(result.url).not.toMatch(/^https?:/); });
  it("offers PDF only after a contribution summary", async () => { mocks.rows.contributions = [{ amount: 100, date: "2026-08-01" }]; const answer = await answerControlledKanisaAIIntent("CONTRIBUTION_SUMMARY", context("finance", "treasurer"), now); expect(answer.followUps?.some((item) => item.type === "generate_report")).toBe(true); const members = await answerControlledKanisaAIIntent("MEMBER_COUNT", context("church_admin", "church_admin"), now); expect(members.followUps?.some((item) => item.type === "generate_report")).not.toBe(true); });
  it("returns safe generation failure without mutating data", async () => { mocks.rows.contributions = [{ amount: 100, date: "2026-08-01" }]; mocks.pdfOutput.mockImplementationOnce(() => { throw new Error("pdf failed"); }); const result = await generateControlledContributionReport("CONTRIBUTION_SUMMARY_REPORT", { kind: "current_month" }, context("finance", "treasurer")); expect(result.status).toBe("error"); expect(result.message).not.toContain("pdf failed"); });
});
