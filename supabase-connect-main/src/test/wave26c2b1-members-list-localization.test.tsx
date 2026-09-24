import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { formatAppDate } from "@/lib/localization";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  language: "sw" as "sw" | "en",
  auth: {
    user: { id: "admin-user" } as { id: string } | null,
    churchId: "church-a" as string | null,
    isLoading: false,
  },
  memberContextLoading: false,
  memberContext: { id: "admin-member", church_id: "church-a", user_id: "admin-user" } as {
    id: string;
    church_id: string;
    user_id: string;
  } | null,
  membersLoading: false,
  membersError: null as Error | null,
  members: [
    {
      id: "member-a",
      church_id: "church-a",
      user_id: "member-user-a",
      full_name: "Amina Nyerere",
      email: "amina@example.test",
      phone: "+255700000001",
      gender: "female",
      status: "active",
      created_at: "2026-09-01T21:30:00Z",
      date_of_birth: "2026-09-01",
      photo_url: null,
      spouse_name: null,
      wedding_date: null,
    },
    {
      id: "member-b",
      church_id: "church-a",
      user_id: "member-user-b",
      full_name: "John Mwangi",
      email: null,
      phone: null,
      gender: "male",
      status: "pending",
      created_at: "2026-08-31T20:59:00Z",
      date_of_birth: null,
      photo_url: null,
      spouse_name: null,
      wedding_date: null,
    },
  ],
  billing: {
    memberLimit: 10 as number | null,
    isTrial: false,
  },
}));

const defaultMembers = [
  {
    id: "member-a",
    church_id: "church-a",
    user_id: "member-user-a",
    full_name: "Amina Nyerere",
    email: "amina@example.test",
    phone: "+255700000001",
    gender: "female",
    status: "active",
    created_at: "2026-09-01T21:30:00Z",
    date_of_birth: "2026-09-01",
    photo_url: null,
    spouse_name: null,
    wedding_date: null,
  },
  {
    id: "member-b",
    church_id: "church-a",
    user_id: "member-user-b",
    full_name: "John Mwangi",
    email: null,
    phone: null,
    gender: "male",
    status: "pending",
    created_at: "2026-08-31T20:59:00Z",
    date_of_birth: null,
    photo_url: null,
    spouse_name: null,
    wedding_date: null,
  },
];

function translate(key: string, options?: Record<string, unknown>) {
  const resource = state.language === "sw" ? sw : en;
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, resource);

  const text = typeof value === "string" ? value : String(options?.defaultValue ?? key);
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ""));
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { language: state.language } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: state.auth.user,
    churchId: state.auth.churchId,
    isLoading: state.auth.isLoading,
  }),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => state.billing,
}));

const toast = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = String(queryKey[0]);
    if (key === "member-context") {
      return { data: state.memberContext, isLoading: state.memberContextLoading, error: null };
    }
    if (key === "members") {
      return {
        data: { rows: state.members, count: state.members.length },
        isLoading: state.membersLoading,
        error: state.membersError,
      };
    }
    if (key === "communities-list") {
      return { data: [{ id: "community-a", name: "Mtakatifu Yosefu" }], isLoading: false, error: null };
    }
    if (key === "ministries-list") {
      return { data: [{ id: "ministry-a", name: "Kwaya Kuu" }], isLoading: false, error: null };
    }
    if (key === "families-list") {
      return { data: [{ id: "family-a", name: "Familia ya Nyerere" }], isLoading: false, error: null };
    }
    if (key === "community-memberships") {
      return { data: [{ member_id: "member-a", community_id: "community-a" }], isLoading: false, error: null };
    }
    if (key === "ministry-memberships") {
      return { data: [{ member_id: "member-a", ministry_id: "ministry-a" }], isLoading: false, error: null };
    }
    if (key === "family-memberships") {
      return { data: [{ member_id: "member-a", family_id: "family-a", role: "mother" }], isLoading: false, error: null };
    }
    if (key === "member-contributions") {
      return {
        data: [
          {
            id: "contribution-a",
            member_id: "member-a",
            amount: 25000,
            created_at: "2026-09-01T21:30:00Z",
            notes: "Sadaka ya familia",
            contribution_categories: null,
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    return { data: null, isLoading: false, error: null };
  },
}));

vi.mock("@/components/MemberForm", () => ({
  MemberForm: () => <div data-testid="member-form">MemberForm boundary</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
    })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-user" } }, error: null })) },
    functions: { invoke: vi.fn(async () => ({ error: null })) },
  },
}));

type LocaleTree = Record<string, unknown>;

function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as LocaleTree, path)
      : [path];
  });
}

let host: HTMLDivElement;
let root: Root;
let MembersPage: typeof import("@/pages/church-admin/MembersPage").default;

async function renderPage() {
  await act(async () => {
    root.render(<MembersPage />);
    await Promise.resolve();
  });
}

function text() {
  return host.textContent ?? "";
}

beforeEach(async () => {
  state.language = "sw";
  state.auth = { user: { id: "admin-user" }, churchId: "church-a", isLoading: false };
  state.memberContextLoading = false;
  state.memberContext = { id: "admin-member", church_id: "church-a", user_id: "admin-user" };
  state.members = [...defaultMembers];
  state.membersLoading = false;
  state.membersError = null;
  state.billing = { memberLimit: 10, isTrial: false };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  MembersPage = (await import("@/pages/church-admin/MembersPage")).default;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.querySelectorAll("[role='dialog']").forEach((dialog) => dialog.remove());
  toast.mockClear();
  invalidateQueries.mockClear();
});

describe("Wave 26C-2B-1 Members list localization", () => {
  it("keeps Members locale keys in parity without colliding with stored values", () => {
    expect(flattenKeys(sw.members_admin).sort()).toEqual(flattenKeys(en.members_admin).sort());
    expect(en.members_admin.gender.male).toBe("Male");
    expect(sw.members_admin.gender.male).toBe("Mwanaume");
    expect(en.members_admin.family_roles.mother).toBe("Mother");
    expect(sw.members_admin.family_roles.mother).toBe("Mama");
    expect(en.statuses.active).toBe("Active");
    expect(sw.statuses.active).toBe("Hai");
  });

  it("renders the Members list in Kiswahili without translating user-entered content", async () => {
    await renderPage();

    expect(text()).toContain("Wanachama");
    expect(text()).toContain("Wanachama 2 jumla");
    expect(text()).toContain("Matumizi ya wanachama");
    expect(text()).toContain("2 / 10 wanachama");
    expect(host.querySelector("input")?.getAttribute("placeholder")).toBe("Tafuta wanachama...");
    expect(text()).toContain("Jina");
    expect(text()).toContain("Jinsia");
    expect(text()).toContain("Hali");
    expect(text()).toContain("Hai");
    expect(text()).toContain("Inasubiri");
    expect(text()).toContain("Mwanamke");
    expect(text()).toContain("Mwanaume");
    expect(text()).toContain("Amina Nyerere");
    expect(text()).toContain("John Mwangi");
    expect(text()).toContain("amina@example.test");
    expect(text()).toContain("+255700000001");
    expect(text()).toContain("Hakuna barua pepe");
    expect(text()).toContain("Hakuna simu");
  });

  it("switches Members list language in place without remounting or changing data values", async () => {
    await renderPage();
    expect(text()).toContain("Wanachama 2 jumla");
    expect(text()).toContain("Amina Nyerere");

    state.language = "en";
    await renderPage();

    expect(text()).toContain("2 total members");
    expect(text()).toContain("Member usage");
    expect(text()).toContain("Within plan limit");
    expect(host.querySelector("input")?.getAttribute("placeholder")).toBe("Search members...");
    expect(text()).toContain("Active");
    expect(text()).toContain("Pending");
    expect(text()).toContain("Female");
    expect(text()).toContain("Male");
    expect(text()).toContain("Amina Nyerere");
    expect(text()).toContain("+255700000001");
  });

  it("uses localized date-only and timestamp formatting without calendar-day shifts", async () => {
    await renderPage();
    expect(text()).toContain(formatAppDate("2026-09-01T21:30:00Z", "sw"));
    expect(formatAppDate("2026-09-01", "sw")).toBe(formatAppDate(new Date("2026-09-01T12:00:00Z"), "sw", { dateStyle: "medium", timeZone: "UTC" }));
    expect(formatAppDate("2026-09-01", "en", { dateStyle: "medium", timeZone: "America/Los_Angeles" })).toBe(formatAppDate("2026-09-01", "en"));
  });

  it("localizes member profile labels while preserving stored role values and user content", async () => {
    await renderPage();
    const profileButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Amina Nyerere"));
    expect(profileButton).toBeTruthy();

    await act(async () => {
      profileButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(text()).toContain("Wasifu wa Mwanachama");
    expect(text()).toContain("Alijiunga:");
    expect(text()).toContain("Tarehe ya kuzaliwa:");
    expect(text()).toContain("Familia ya Nyerere");
    expect(text()).toContain("(Mama)");
    expect(text()).toContain("Sadaka ya familia");
    expect(text()).not.toContain("(mother)");
  });

  it("localizes loading, authorization, empty and billing-limit states", async () => {
    state.memberContextLoading = true;
    await renderPage();
    expect(text()).toContain("Inapakia wanachama...");

    state.memberContextLoading = false;
    state.auth.user = null;
    await renderPage();
    expect(text()).toContain("Unahitaji kuingia ili kuona wanachama.");

    state.auth.user = { id: "admin-user" };
    state.memberContext = null;
    state.auth.churchId = null;
    await renderPage();
    expect(text()).toContain("Hakuna rekodi ya mwanachama iliyopatikana kwa akaunti yako.");

    state.auth.churchId = "church-a";
    state.memberContext = { id: "admin-member", church_id: "church-a", user_id: "admin-user" };
    state.members = [];
    await renderPage();
    expect(text()).toContain("Hakuna wanachama waliopatikana au huna ruhusa");

    state.members = [{
      id: "member-c",
      church_id: "church-a",
      user_id: "member-user-c",
      full_name: "Grace Mapunda",
      email: null,
      phone: null,
      gender: "female",
      status: "active",
      created_at: "2026-09-01",
      date_of_birth: null,
      photo_url: null,
      spouse_name: null,
      wedding_date: null,
    }];
    state.billing = { memberLimit: 1, isTrial: false };
    await renderPage();
    expect(text()).toContain("Umefikia kikomo cha wanachama.");
  });

  it("preserves tenant filters, invitation payload values and MemberForm scope boundary", () => {
    const source = readFileSync("src/pages/church-admin/MembersPage.tsx", "utf8");
    expect(source).toContain('role: "member"');
    expect(source).toContain('status: "pending"');
    expect(source).toContain(".eq(\"church_id\", trustedChurchId)");
    expect(source).toContain("<MemberForm");
    expect(source).not.toContain("src/components/MemberForm");
  });
});
