import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  fetchMemberContributionTotalForRange: vi.fn(),
  fetchNextTimetableMass: vi.fn(),
  fetchLatestAnnouncement: vi.fn(),
  fetchOwnMassIntentionsSummary: vi.fn(),
  linkedMember: { id: "member-a", church_id: "church-a", full_name: "Test Member" } as { id: string; church_id: string; full_name: string } | null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    profile: { full_name: "Test Member", church_name: "Test Parish" },
    user: { id: "user-a", user_metadata: {} },
  }),
}));
vi.mock("@/hooks/use-linked-member", () => ({
  useLinkedMember: () => ({ data: mocks.linkedMember }),
}));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ getFeatureState: () => ({ visible: false }) }),
}));
vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => ({ featureEnabled: false, data: null }),
}));
vi.mock("@/lib/member-contributions", () => ({
  fetchMemberContributionTotalForRange: mocks.fetchMemberContributionTotalForRange,
}));
vi.mock("@/lib/member-daily-life", () => ({
  fetchLatestAnnouncement: mocks.fetchLatestAnnouncement,
  fetchNextTimetableMass: mocks.fetchNextTimetableMass,
}));
vi.mock("@/lib/member-linked-requests", () => ({
  fetchOwnMassIntentionsSummary: mocks.fetchOwnMassIntentionsSummary,
}));

import KanisaAssistantPage from "@/pages/portal/KanisaAssistantPage";

describe("member Uliza Kanisa contribution UI", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    mocks.fetchMemberContributionTotalForRange.mockReset();
    mocks.fetchNextTimetableMass.mockReset();
    mocks.fetchLatestAnnouncement.mockReset();
    mocks.fetchOwnMassIntentionsSummary.mockReset();
    mocks.linkedMember = { id: "member-a", church_id: "church-a", full_name: "Test Member" };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><KanisaAssistantPage /></MemoryRouter>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function ask(question: string) {
    const input = host.querySelector<HTMLInputElement>("#uliza-kanisa-input");
    const submit = host.querySelector<HTMLButtonElement>('button[aria-label="Tuma swali"]');
    expect(input).toBeTruthy();
    expect(submit).toBeTruthy();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(input, question);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    await act(async () => {
      submit!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("answers today's own contribution total with formatted money", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(25000);

    await ask("Nimechangia kiasi gani leo?");

    expect(host).toHaveTextContent("Leo umechangia");
    expect(host).toHaveTextContent("25,000");
    expect(mocks.fetchMemberContributionTotalForRange).toHaveBeenCalledWith("church-a", "member-a", "today");
  });

  it("answers this week's own contribution total", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(80000);

    await ask("Michango yangu wiki hii");

    expect(host).toHaveTextContent("Wiki hii umechangia");
    expect(host).toHaveTextContent("80,000");
    expect(mocks.fetchMemberContributionTotalForRange).toHaveBeenCalledWith("church-a", "member-a", "this_week");
  });

  it("answers this month's own contribution total", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(150000);

    await ask("Nimechangia kiasi gani mwezi huu?");

    expect(host).toHaveTextContent("Mwezi huu umechangia");
    expect(host).toHaveTextContent("150,000");
    expect(mocks.fetchMemberContributionTotalForRange).toHaveBeenCalledWith("church-a", "member-a", "this_month");
  });

  it("answers the new all-time own contribution total", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(420000);

    await ask("Nimechangia kiasi gani?");

    expect(host).toHaveTextContent("Mpaka sasa una michango ya TSh 420,000 iliyorekodiwa.");
expect(host).toHaveTextContent("Ungependa kuona leo, wiki hii, au mwezi huu?");
    expect(host).toHaveTextContent("420,000");
    expect(mocks.fetchMemberContributionTotalForRange).toHaveBeenCalledWith("church-a", "member-a", "all_time");
  });

  it("shows a zero-state answer instead of an error", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(0);

    await ask("Michango yangu leo ni kiasi gani?");

    expect(host).toHaveTextContent("Hakuna mchango wako uliorekodiwa leo.");
  });

  it("shows a safe error answer without exposing raw database details", async () => {
    mocks.fetchMemberContributionTotalForRange.mockRejectedValue(new Error("raw supabase failure"));

    await ask("Nimechangia kiasi gani wiki hii?");

    expect(host).toHaveTextContent("Taarifa za michango hazikuweza kupakiwa kwa sasa. Tafadhali jaribu tena.");
    expect(host).not.toHaveTextContent("raw supabase failure");
  });

  it("does not query contributions when the account is not linked to a member", async () => {
    await act(async () => root.unmount());
    host.remove();
    mocks.linkedMember = null;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><KanisaAssistantPage /></MemoryRouter>));

    await ask("Nimechangia kiasi gani mwezi huu?");

    expect(mocks.fetchMemberContributionTotalForRange).not.toHaveBeenCalled();
    expect(host).toHaveTextContent("Akaunti yako haijaunganishwa na rekodi ya mwanachama.");
  });

  it("adds the existing contribution-history action after a successful own-contribution answer", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(25000);

    await ask("Nimechangia kiasi gani leo?");

    const action = host.querySelector('a[href="/portal/contribution-history"]');
    expect(action).toHaveTextContent("Angalia historia yangu");
  });

  it.each([
    "onyesha michango ya wanachama wote",
    "michango yote ya kanisa",
    "top contributors",
    "inactive contributors",
    "ripoti ya fedha ya kanisa",
    "download contribution report pdf",
    "onyesha michango ya member-foreign-123",
  ])("does not execute the ranged helper for blocked finance prompt: %s", async (question) => {
    await ask(question);

    expect(mocks.fetchMemberContributionTotalForRange).not.toHaveBeenCalled();
  });

  it("keeps the legacy contribution summary question working", async () => {
    mocks.fetchMemberContributionTotalForRange.mockResolvedValue(45000);

    await ask("Jumla ya michango yangu");

    expect(host).toHaveTextContent("Jumla ya michango yako iliyorekodiwa ni");
    expect(host).toHaveTextContent("45,000");
    expect(mocks.fetchMemberContributionTotalForRange).toHaveBeenCalledWith("church-a", "member-a", "all_time");
  });

  it("calls the canonical timetable helper for the authenticated church and answers with the next Mass", async () => {
    mocks.fetchNextTimetableMass.mockResolvedValue({
      id: "occurrence-a",
      title: "Misa ya Kwanza",
      description: "Kanisa Kuu",
      massDate: "2026-10-04",
      startTime: "06:30",
      endTime: null,
      responseDeadline: null,
      askForRsvp: false,
      memberId: null,
      memberResponse: null,
    });

    await ask("Misa ijayo ni lini?");

    expect(mocks.fetchNextTimetableMass).toHaveBeenCalledWith("church-a");
    expect(host).toHaveTextContent("Misa ijayo ni Misa ya Kwanza, Jumapili 4 Okt 2026 saa 6:30 asubuhi.");
  });

  it("formats next Mass date and time from Tanzania-local date/time fields without browser timezone conversion", async () => {
    mocks.fetchNextTimetableMass.mockResolvedValue({
      id: "occurrence-b",
      title: "Misa ya Jioni",
      description: null,
      massDate: "2027-01-01",
      startTime: "18:15",
      endTime: null,
      responseDeadline: null,
      askForRsvp: false,
      memberId: null,
      memberResponse: null,
    });

    await ask("Misa inayofuata ni saa ngapi?");

    expect(host).toHaveTextContent("Ijumaa 1 Jan 2027 saa 18:15 jioni.");
  });

  it("produces a natural next Mass answer when the title is missing", async () => {
    mocks.fetchNextTimetableMass.mockResolvedValue({
      id: "occurrence-c",
      title: "",
      description: null,
      massDate: "2026-10-04",
      startTime: "08:30",
      endTime: null,
      responseDeadline: null,
      askForRsvp: false,
      memberId: null,
      memberResponse: null,
    });

    await ask("Misa ijayo ni ipi?");

    expect(host).toHaveTextContent("Misa ijayo ni Jumapili 4 Okt 2026 saa 8:30 asubuhi.");
  });

  it("shows the next Mass empty state when no timetable Mass exists", async () => {
    mocks.fetchNextTimetableMass.mockResolvedValue(null);

    await ask("Misa ijayo ni lini?");

    expect(host).toHaveTextContent("Hakuna Misa ijayo iliyopangwa kwa sasa.");
  });

  it("shows safe next Mass error copy without exposing raw database details", async () => {
    mocks.fetchNextTimetableMass.mockRejectedValue(new Error("raw timetable rpc failure"));

    await ask("Misa inayofuata ni lini?");

    expect(host).toHaveTextContent("Ratiba ya Misa haikuweza kupakiwa kwa sasa. Tafadhali jaribu tena.");
    expect(host).not.toHaveTextContent("raw timetable rpc failure");
  });

  it("adds the existing schedule action after a successful next Mass answer", async () => {
    mocks.fetchNextTimetableMass.mockResolvedValue({
      id: "occurrence-d",
      title: "Misa ya Pili",
      description: null,
      massDate: "2026-10-04",
      startTime: "08:30",
      endTime: null,
      responseDeadline: null,
      askForRsvp: false,
      memberId: null,
      memberResponse: null,
    });

    await ask("Misa ijayo ni lini?");

    const action = host.querySelector('a[href="/portal/calendar"]');
    expect(action).toHaveTextContent("Angalia ratiba");
  });

  it("calls the canonical latest announcement helper with the authenticated church and answers with title and body", async () => {
    mocks.fetchLatestAnnouncement.mockResolvedValue({
      id: "announcement-a",
      church_id: "church-a",
      title: "Kikao cha Vijana",
      content: "Kikao kitafanyika Jumamosi baada ya Misa.",
      is_published: true,
      published_at: "2026-10-01T09:00:00Z",
      created_by: null,
      created_at: "2026-10-01T09:00:00Z",
      updated_at: "2026-10-01T09:00:00Z",
      archived_at: null,
    });

    await ask("Kuna tangazo jipya?");

    expect(mocks.fetchLatestAnnouncement).toHaveBeenCalledWith("church-a");
    expect(host).toHaveTextContent('Tangazo la hivi karibuni ni "Kikao cha Vijana". Kikao kitafanyika Jumamosi baada ya Misa.');
  });

  it("deterministically truncates long announcement bodies", async () => {
    mocks.fetchLatestAnnouncement.mockResolvedValue({
      id: "announcement-b",
      church_id: "church-a",
      title: "Tangazo Refu",
      content: "A".repeat(180),
      is_published: true,
      published_at: null,
      created_by: null,
      created_at: "2026-10-01T09:00:00Z",
      updated_at: "2026-10-01T09:00:00Z",
      archived_at: null,
    });

    await ask("Tangazo la mwisho ni lipi?");

    expect(host).toHaveTextContent(`${"A".repeat(160)}...`);
    expect(host).not.toHaveTextContent("A".repeat(170));
  });

  it("does not truncate short announcement bodies unnecessarily", async () => {
    mocks.fetchLatestAnnouncement.mockResolvedValue({
      id: "announcement-c",
      church_id: "church-a",
      title: "Ibada",
      content: "Ibada itaanza saa nne asubuhi.",
      is_published: true,
      published_at: null,
      created_by: null,
      created_at: "2026-10-01T09:00:00Z",
      updated_at: "2026-10-01T09:00:00Z",
      archived_at: null,
    });

    await ask("Tangazo la hivi karibuni ni lipi?");

    expect(host).toHaveTextContent("Ibada itaanza saa nne asubuhi.");
    expect(host).not.toHaveTextContent("Ibada itaanza saa nne asubuhi...");
  });

  it("does not display raw announcement markup in chat text", async () => {
    mocks.fetchLatestAnnouncement.mockResolvedValue({
      id: "announcement-d",
      church_id: "church-a",
      title: "Ratiba",
      content: "<p>Ratiba &amp; huduma zimechapishwa.</p>",
      is_published: true,
      published_at: null,
      created_by: null,
      created_at: "2026-10-01T09:00:00Z",
      updated_at: "2026-10-01T09:00:00Z",
      archived_at: null,
    });

    await ask("Nionyeshe tangazo la mwisho");

    expect(host).toHaveTextContent("Ratiba & huduma zimechapishwa.");
    expect(host).not.toHaveTextContent("<p>");
    expect(host).not.toHaveTextContent("&amp;");
  });

  it("produces a natural title-only announcement answer", async () => {
    mocks.fetchLatestAnnouncement.mockResolvedValue({
      id: "announcement-e",
      church_id: "church-a",
      title: "Kwaya",
      content: "",
      is_published: true,
      published_at: null,
      created_by: null,
      created_at: "2026-10-01T09:00:00Z",
      updated_at: "2026-10-01T09:00:00Z",
      archived_at: null,
    });

    await ask("Matangazo mapya yapo?");

    expect(host).toHaveTextContent('Tangazo la hivi karibuni ni "Kwaya".');
  });

  it("shows the latest announcement empty state", async () => {
    mocks.fetchLatestAnnouncement.mockResolvedValue(null);

    await ask("Kuna tangazo jipya?");

    expect(host).toHaveTextContent("Hakuna tangazo jipya kwa sasa.");
  });

  it("shows safe latest announcement error copy without exposing raw database details", async () => {
    mocks.fetchLatestAnnouncement.mockRejectedValue(new Error("raw announcement rpc failure"));

    await ask("Tangazo la mwisho ni lipi?");

    expect(host).toHaveTextContent("Matangazo hayakuweza kupakiwa kwa sasa. Tafadhali jaribu tena.");
    expect(host).not.toHaveTextContent("raw announcement rpc failure");
  });

  it("adds the existing announcements action after a successful latest announcement answer", async () => {
    mocks.fetchLatestAnnouncement.mockResolvedValue({
      id: "announcement-f",
      church_id: "church-a",
      title: "Kikao",
      content: "Kikao kipo.",
      is_published: true,
      published_at: null,
      created_by: null,
      created_at: "2026-10-01T09:00:00Z",
      updated_at: "2026-10-01T09:00:00Z",
      archived_at: null,
    });

    await ask("Kuna tangazo jipya?");

    const action = host.querySelector('a[href="/portal/announcements"]');
    expect(action).toHaveTextContent("Fungua Matangazo");
  });

  it("answers own Mass Intention status using authenticated church and linked member", async () => {
    mocks.fetchOwnMassIntentionsSummary.mockResolvedValue({ total: 2, approved: 1, scheduled: 0, completed: 0, pending: 1, rejected: 0, archived: 0 });

    await ask("Nia zangu za Misa zikoje?");

    expect(mocks.fetchOwnMassIntentionsSummary).toHaveBeenCalledWith("church-a", "member-a");
    expect(host).toHaveTextContent("Una Nia 2 za Misa: 1 imekubaliwa na 1 inasubiri.");
  });

  it("answers approved Mass Intention status wording without exposing sensitive metadata", async () => {
    mocks.fetchOwnMassIntentionsSummary.mockResolvedValue({
      total: 1,
      approved: 1,
      scheduled: 0,
      completed: 0,
      pending: 0,
      rejected: 0,
      archived: 0,
      message: "Sensitive intention text",
      requester_email: "member@example.test",
      requester_phone: "+255700000000",
      admin_notes: "internal note",
    });

    await ask("Nia yangu ya Misa imekubaliwa?");

    expect(host).toHaveTextContent("Una Nia 1 ya Misa: 1 imekubaliwa.");
    expect(host).not.toHaveTextContent("Sensitive intention text");
    expect(host).not.toHaveTextContent("member@example.test");
    expect(host).not.toHaveTextContent("+255700000000");
    expect(host).not.toHaveTextContent("internal note");
  });

  it("answers scheduled, completed, and archived Mass Intention statuses truthfully", async () => {
    mocks.fetchOwnMassIntentionsSummary.mockResolvedValue({
      total: 6,
      approved: 1,
      scheduled: 1,
      completed: 1,
      pending: 1,
      rejected: 1,
      archived: 1,
    });

    await ask("Nia zangu za Misa zikoje?");

    expect(host).toHaveTextContent("Una Nia 6 za Misa: 1 imekubaliwa, 1 imepangwa, 1 imekamilika, 1 inasubiri, 1 imekataliwa na 1 imehifadhiwa.");
  });

  it("preserves create Mass Intention navigation without performing the status read", async () => {
    await ask("Nataka kuweka nia ya Misa");

    expect(mocks.fetchOwnMassIntentionsSummary).not.toHaveBeenCalled();
    const action = host.querySelector('a[href="/portal/mass-intentions"]');
    expect(action).toHaveTextContent("Nia za Misa");
  });

  it("does not query Mass Intention status without a linked member", async () => {
    await act(async () => root.unmount());
    host.remove();
    mocks.linkedMember = null;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><KanisaAssistantPage /></MemoryRouter>));

    await ask("Nia zangu za Misa zikoje?");

    expect(mocks.fetchOwnMassIntentionsSummary).not.toHaveBeenCalled();
    expect(host).toHaveTextContent("Akaunti yako haijaunganishwa na rekodi ya mwanachama.");
  });

  it("shows the own Mass Intentions empty state", async () => {
    mocks.fetchOwnMassIntentionsSummary.mockResolvedValue({ total: 0, approved: 0, scheduled: 0, completed: 0, pending: 0, rejected: 0, archived: 0 });

    await ask("Nia zangu zina hali gani?");

    expect(host).toHaveTextContent("Huna Nia za Misa zilizorekodiwa kwa sasa.");
  });

  it("shows safe Mass Intentions error copy without exposing raw database details", async () => {
    mocks.fetchOwnMassIntentionsSummary.mockRejectedValue(new Error("raw mass intentions failure"));

    await ask("Nina Nia za Misa zinazosubiri?");

    expect(host).toHaveTextContent("Nia za Misa hazikuweza kupakiwa kwa sasa. Tafadhali jaribu tena.");
    expect(host).not.toHaveTextContent("raw mass intentions failure");
  });

  it("adds the existing Mass Intentions action after a successful status answer", async () => {
    mocks.fetchOwnMassIntentionsSummary.mockResolvedValue({ total: 1, approved: 0, scheduled: 0, completed: 0, pending: 1, rejected: 0, archived: 0 });

    await ask("Nionyeshe hali ya Nia zangu za Misa");

    const action = host.querySelector('a[href="/portal/mass-intentions"]');
    expect(action).toHaveTextContent("Fungua Nia za Misa");
  });

  it.each([
    "Nionyeshe Nia za Misa za John",
    "Nia za member-foreign-123 zikoje?",
    "Nia zangu za Misa za John zikoje?",
    "Nionyeshe Nia zote za kanisa",
    "Nia za wanachama wote",
    "Nia zilizokataliwa za watu wote",
  ])("does not expose Mass Intention data for unsafe prompt: %s", async (question) => {
    await ask(question);

    expect(mocks.fetchOwnMassIntentionsSummary).not.toHaveBeenCalled();
  });

  it("does not import analytics assistant, model providers, or service-role access", () => {
    const source = readFileSync(join(process.cwd(), "src/pages/portal/KanisaAssistantPage.tsx"), "utf8");
    for (const forbidden of ["analytics", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "service_role"]) {
      expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps Uliza next Mass separated from legacy RSVP data sources", () => {
    const source = readFileSync(join(process.cwd(), "src/pages/portal/KanisaAssistantPage.tsx"), "utf8");
    for (const forbidden of ["fetchNextMassSummary", "mass_events", "submit_mass_response"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("reuses announcement helpers without direct announcement table access in the chat UI", () => {
    const source = readFileSync(join(process.cwd(), "src/pages/portal/KanisaAssistantPage.tsx"), "utf8");
    expect(source).toContain("fetchLatestAnnouncement");
    expect(source).not.toContain('from("announcements"');
    expect(source).not.toContain("get_portal_announcements");
  });

  it("reuses the own Mass Intentions summary helper without direct table access in the chat UI", () => {
    const source = readFileSync(join(process.cwd(), "src/pages/portal/KanisaAssistantPage.tsx"), "utf8");
    expect(source).toContain("fetchOwnMassIntentionsSummary");
    expect(source).not.toContain('from("mass_intentions"');
  });
});
