import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sw from "@/locales/sw.json";
import en from "@/locales/en.json";

type MockChurch = {
  membership_id: string;
  church_id: string;
  church_name: string | null;
  church_code: string | null;
  status: string;
  is_primary: boolean;
  joined_at: string | null;
  roles?: string[];
  baseline_member?: boolean;
};

const state = vi.hoisted(() => ({
  auth: {
    churchId: "church-a",
    activeChurchId: "church-a",
    availableChurches: [] as MockChurch[],
    user: { id: "user-a", email: "member@example.test", user_metadata: {} },
    profile: { full_name: "Peter John", church_name: "ST THERESIA" },
    member: { id: "member-a" },
    userRole: "member",
    userRoles: ["member"],
    staffWorkspace: "member",
    activeView: "member",
    signOut: vi.fn(),
    setActiveView: vi.fn(),
    switchChurch: vi.fn(),
  },
  ledCommunities: [] as Array<{
    community_id: string;
    community_name: string;
    leadership_role: string;
    church_id: string;
  }>,
  refetchLedCommunities: vi.fn(),
}));

const churchA: MockChurch = {
  membership_id: "membership-a",
  church_id: "church-a",
  church_name: "ST THERESIA",
  church_code: "THERESIA",
  status: "active",
  is_primary: true,
  joined_at: "2026-01-01T00:00:00Z",
  roles: ["member"],
  baseline_member: true,
};

const churchB: MockChurch = {
  membership_id: "membership-b",
  church_id: "church-b",
  church_name: "KANISA CONNECT UAT PARISH",
  church_code: "UAT",
  status: "active",
  is_primary: false,
  joined_at: "2026-02-01T00:00:00Z",
  roles: ["member"],
  baseline_member: true,
};

const translations: Record<string, string> = {
  member: "Mwanachama",
  sign_out: "Toka",
  viewing_as_member: "Unaangalia kama mwanachama",
  back_to_admin: "Rudi kwa Admin",
  "workspace_switcher.switch_view": "Badili muonekano",
  "workspace_switcher.member_view": "Muonekano wa Mwanachama",
  "church_admin_layout.workspaces.finance": "Fedha",
  "church_admin_layout.workspaces.staff": "Nafasi ya Wafanyakazi",
  "church_switcher.account_menu": "Fungua menyu ya akaunti",
  "church_switcher.my_church": "Kanisa Langu",
  "church_switcher.my_churches": "Makanisa Yangu",
  "church_switcher.switch_church": "Badili Kanisa",
  "church_switcher.current_church": "Unatumia sasa: {{church}}",
  "church_switcher.current_badge": "Unatumia sasa",
  "church_switcher.choose": "Chagua",
  "church_switcher.member": "Mwanachama",
  "church_switcher.switching": "Inabadilisha kanisa...",
  "church_switcher.error": "Imeshindikana kubadili kanisa. Tafadhali jaribu tena.",
  "church_switcher.close": "Funga",
  "church_switcher.fallback_church": "Kanisa",
  "church_switcher.member_portal": "Portal ya Mwanachama",
  "church_switcher.current_church_aria": "{{church}} linatumika sasa",
  "church_switcher.choose_church_aria": "Chagua {{church}}",
  "member_portal_shell.collapse_sidebar": "Funga menyu ya mwanachama",
  "member_portal_shell.desktop_navigation": "Urambazaji wa mwanachama kwenye kompyuta",
  "member_portal_shell.expand_sidebar": "Fungua menyu ya mwanachama",
  "member_portal_shell.explore": "Gundua",
  "member_portal_shell.main": "Kuu",
  "member_portal_shell.menu": "Menyu",
  "member_portal_shell.groups.primary": "Kuu",
  "member_portal_shell.groups.services": "Huduma",
  "member_portal_shell.groups.spiritual": "Kiroho",
  "member_portal_shell.groups.media": "Media",
  "member_services.announcements.label": "Matangazo",
  "member_services.bible.label": "Biblia",
  "member_services.calendar.label": "Ratiba ya Parokia",
  "member_services.daily_readings.label": "Masomo ya Leo",
  "member_services.dashboard.label": "Historia Yangu",
  "member_services.give.label": "Toa Mchango",
  "member_services.home.label": "Nyumbani",
  "member_services.jumuiya.label": "Jumuiya Yangu",
  "member_services.library.label": "Watakatifu",
  "member_services.liturgical_calendar.label": "Kalenda ya Liturujia",
  "member_services.mass_intentions.label": "Nia za Misa",
  "member_services.ministries.label": "Huduma za Parokia",
  "member_services.my_parish.label": "Parokia Yangu",
  "member_services.prayers.label": "Sala",
  "member_services.radio.label": "Radio",
  "member_services.sermons.label": "Mahubiri",
  "member_services.services.label": "Zaidi",
  "member_services.today.label": "Leo",
  view_as_community_leader: "View as a Community Leader",
};

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/diocese-workspace", () => ({ getMyDioceseWorkspaces: vi.fn().mockResolvedValue([]) }));
vi.mock("@/components/auth/ProtectedRoute", () => ({ ProtectedRoute: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/portal/BibleVersePopup", () => ({ BibleVersePopup: () => null }));
vi.mock("@/components/portal/MemberMobileBackHeader", () => ({ MemberMobileBackHeader: () => null }));
vi.mock("@/components/portal/MemberNotificationBell", () => ({ MemberNotificationBell: () => null }));
vi.mock("@/components/ui/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => ({ memberPortalAccess: "full", isLoading: false }),
}));
vi.mock("@/hooks/use-community-leader", () => ({
  useLedCommunities: () => ({
    data: state.ledCommunities.filter((community) => community.church_id === (state.auth.activeChurchId ?? state.auth.churchId)),
    refetch: state.refetchLedCommunities,
  }),
}));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isLoading: false,
    isResolved: true,
    error: null,
    refetch: vi.fn(),
    getFeatureState: (key: string) => ({ key, exists: true, enabled: true, visible: true, locked: false }),
    isFeatureExplicitlyEnabledForChurch: () => true,
  }),
}));
vi.mock("@/hooks/use-member-notifications", () => ({ useMemberNotifications: () => ({ data: [] }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const value = translations[key] ?? key;
      return value.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => params?.[token] ?? "");
    },
    i18n: { language: "sw" },
  }),
}));

import { PortalLayout } from "@/components/portal/PortalLayout";

let mounted: { host: HTMLDivElement; root: Root } | null = null;

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderPortal(initialPath = "/portal") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<div>Nyumbani</div>} />
            <Route path="announcements" element={<div>Matangazo</div>} />
            <Route path="ministries" element={<div>Huduma</div>} />
            <Route path="ministries/:ministryId" element={<div>Huduma detail</div>} />
          </Route>
          <Route path="/church-admin" element={<div>Staff workspace</div>} />
        </Routes>
      </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  mounted = { host, root };
  return mounted;
}

function unmountPortal() {
  if (!mounted) return;
  act(() => mounted?.root.unmount());
  mounted.host.remove();
  mounted = null;
}

function text() {
  return document.body.textContent ?? "";
}

function queryByText(value: string) {
  return [...document.body.querySelectorAll<HTMLElement>("*")].find((element) => element.textContent === value) ?? null;
}

function getByText(value: string) {
  const element = queryByText(value);
  if (!element) throw new Error(`Could not find text: ${value}`);
  return element;
}

function getByTestId(value: string) {
  const element = document.body.querySelector<HTMLElement>(`[data-testid="${value}"]`);
  if (!element) throw new Error(`Could not find test id: ${value}`);
  return element;
}

function roleSelector(role: string) {
  if (role === "button") return "button";
  return `[role="${role}"]`;
}

function getByRole(role: string, name?: string) {
  const elements = [...document.body.querySelectorAll<HTMLElement>(roleSelector(role))];
  const element = elements.find((candidate) => {
    if (!name) return true;
    const accessibleName = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
    return accessibleName.includes(name);
  });
  if (!element) throw new Error(`Could not find role: ${role}${name ? ` with name ${name}` : ""}`);
  return element;
}

function queryByRole(role: string, name?: string) {
  try {
    return getByRole(role, name);
  } catch {
    return null;
  }
}

function click(element: HTMLElement) {
  act(() => element.click());
}

async function waitForAssert(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw lastError;
}

function resetAuth(overrides: Partial<typeof state.auth> = {}) {
  state.auth.churchId = "church-a";
  state.auth.activeChurchId = "church-a";
  state.auth.availableChurches = [churchA];
  state.auth.userRole = "member";
  state.auth.userRoles = ["member"];
  state.auth.staffWorkspace = "member";
  state.auth.activeView = "member";
  state.auth.member = { id: "member-a" };
  state.auth.profile = { full_name: "Peter John", church_name: "ST THERESIA" };
  state.auth.switchChurch = vi.fn().mockResolvedValue(undefined);
  state.auth.setActiveView = vi.fn();
  state.auth.signOut = vi.fn();
  Object.assign(state.auth, overrides);
}

function openAccountMenu() {
  click(getByRole("button", "Fungua menyu ya akaunti"));
}

function openChurchSwitcher() {
  openAccountMenu();
  click(getByText("Badili Kanisa"));
}

describe("multi-church Slice 3 member church switcher", () => {
  beforeEach(() => {
    resetAuth();
    state.ledCommunities = [];
    state.refetchLedCommunities.mockClear();
  });

  afterEach(() => {
    unmountPortal();
    vi.clearAllMocks();
  });

  it("hides the switch action for a single-church member and still displays the current church", () => {
    renderPortal();

    expect(text()).toContain("ST THERESIA");
    openAccountMenu();
    expect(text()).toContain("Kanisa Langu");
    expect(text()).not.toContain("Badili Kanisa");
  });

  it("shows a mobile-friendly church picker for a multi-church member", () => {
    resetAuth({ availableChurches: [churchA, churchB] });
    renderPortal();

    openChurchSwitcher();

    const dialog = getByRole("dialog", "Makanisa Yangu");
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toBe(document.body);
    expect(text()).toContain("Unatumia sasa: ST THERESIA");
    expect(getByRole("button", "ST THERESIA linatumika sasa")).toHaveAttribute("aria-current", "true");
    expect(getByRole("button", "Chagua KANISA CONNECT UAT PARISH")).toHaveTextContent("Chagua");
    expect(getByRole("button", "Chagua KANISA CONNECT UAT PARISH")).toHaveTextContent("Mwanachama");
  });

  it("renders both church rows when the secondary church is active and keeps the primary church selectable", () => {
    resetAuth({
      churchId: "church-b",
      activeChurchId: "church-b",
      availableChurches: [churchA, churchB],
    });
    renderPortal();

    openChurchSwitcher();

    expect(getByRole("dialog", "Makanisa Yangu").parentElement).toBe(document.body);
    expect(getByTestId("church-switcher-row-church-a")).toBeInTheDocument();
    expect(getByTestId("church-switcher-row-church-b")).toBeInTheDocument();

    const currentChurch = getByRole("button", "KANISA CONNECT UAT PARISH linatumika sasa") as HTMLButtonElement;
    const primaryChurch = getByRole("button", "Chagua ST THERESIA") as HTMLButtonElement;

    expect(currentChurch).toBeInTheDocument();
    expect(currentChurch).toHaveAttribute("aria-current", "true");
    expect(currentChurch).toBeDisabled();
    expect(primaryChurch).toBeInTheDocument();
    expect(primaryChurch).not.toBeDisabled();
    expect(primaryChurch).toHaveTextContent("Chagua");
    expect(primaryChurch).toHaveTextContent("Mwanachama");
  });

  it("selects the primary church from a secondary active church", async () => {
    resetAuth({
      churchId: "church-b",
      activeChurchId: "church-b",
      availableChurches: [churchA, churchB],
      switchChurch: vi.fn(async (churchId: string) => {
        state.auth.activeChurchId = churchId;
        state.auth.churchId = churchId;
      }),
    });
    renderPortal();

    openChurchSwitcher();
    click(getByRole("button", "Chagua ST THERESIA"));

    expect(state.auth.switchChurch).toHaveBeenCalledTimes(1);
    expect(state.auth.switchChurch).toHaveBeenCalledWith("church-a");
    await waitForAssert(() => expect(queryByRole("dialog", "Makanisa Yangu")).not.toBeInTheDocument());
  });

  it("calls switchChurch once, shows loading, and keeps normal portal routes in place after success", async () => {
    resetAuth({
      availableChurches: [churchA, churchB],
      switchChurch: vi.fn(async (churchId: string) => {
        state.auth.activeChurchId = churchId;
        state.auth.churchId = churchId;
      }),
    });
    renderPortal("/portal/announcements");

    openChurchSwitcher();
    const chooseUat = getByRole("button", "Chagua KANISA CONNECT UAT PARISH") as HTMLButtonElement;
    click(chooseUat);
    click(chooseUat);

    expect(state.auth.switchChurch).toHaveBeenCalledTimes(1);
    expect(getByRole("status")).toHaveTextContent("Inabadilisha kanisa...");
    await waitForAssert(() => expect(queryByRole("dialog", "Makanisa Yangu")).not.toBeInTheDocument());
    expect(getByTestId("location")).toHaveTextContent("/portal/announcements");
  });

  it("shows a friendly error without closing the picker when switching fails", async () => {
    resetAuth({
      availableChurches: [churchA, churchB],
      switchChurch: vi.fn().mockRejectedValue(new Error("rpc failed")),
    });
    renderPortal();

    openChurchSwitcher();
    click(getByRole("button", "Chagua KANISA CONNECT UAT PARISH"));

    await waitForAssert(() => expect(getByRole("alert")).toHaveTextContent("Imeshindikana kubadili kanisa. Tafadhali jaribu tena."));
    expect(getByRole("dialog", "Makanisa Yangu")).toBeInTheDocument();
  });

  it("returns from church-specific ministry detail pages to the ministry list after a switch", async () => {
    resetAuth({
      availableChurches: [churchA, churchB],
      switchChurch: vi.fn(async (churchId: string) => {
        state.auth.activeChurchId = churchId;
        state.auth.churchId = churchId;
      }),
    });
    renderPortal("/portal/ministries/ministry-old");

    openChurchSwitcher();
    click(getByRole("button", "Chagua KANISA CONNECT UAT PARISH"));

    await waitForAssert(() => expect(getByTestId("location")).toHaveTextContent("/portal/ministries"));
  });

  it("keeps long church names readable and reflects a persisted active church", () => {
    const longChurchName = "KANISA LA MTakatifu Maria Mama wa Rozari Parokia ya UAT Yenye Jina Refu Sana";
    resetAuth({
      churchId: "church-b",
      activeChurchId: "church-b",
      availableChurches: [churchA, { ...churchB, church_name: longChurchName }],
    });
    renderPortal();

    expect(text()).toContain(longChurchName);
    openChurchSwitcher();
    expect(getByRole("button", `${longChurchName} linatumika sasa`)).toHaveAttribute("aria-current", "true");
  });

  it("updates workspace actions from the active church context without manufacturing staff access", () => {
    renderPortal();

    openAccountMenu();
    expect(text()).not.toContain("Badili muonekano");

    unmountPortal();
    resetAuth({
      availableChurches: [churchA, churchB],
      userRole: "treasurer",
      userRoles: ["treasurer", "member"],
      staffWorkspace: "finance",
      activeView: "member",
    });
    renderPortal();

    expect(text()).toContain("Unaangalia kama mwanachama");
    openAccountMenu();
    expect(text()).toContain("Badili muonekano");
    expect(text()).toContain("Fedha");

    unmountPortal();
    resetAuth({
      activeChurchId: "church-b",
      churchId: "church-b",
      availableChurches: [churchA, churchB],
      userRole: "member",
      userRoles: ["member"],
      staffWorkspace: "member",
      activeView: "member",
    });
    renderPortal();

    openAccountMenu();
    expect(text()).not.toContain("Badili muonekano");
  });

  it("scopes community leader profile actions to the active church", () => {
    state.ledCommunities = [
      {
        community_id: "community-b",
        community_name: "Jumuiya B",
        leadership_role: "Mwenyekiti",
        church_id: "church-b",
      },
    ];
    resetAuth({
      churchId: "church-a",
      activeChurchId: "church-a",
      availableChurches: [churchA, churchB],
    });
    renderPortal();

    openAccountMenu();
    expect(text()).not.toContain("View as a Community Leader");

    unmountPortal();
    resetAuth({
      churchId: "church-b",
      activeChurchId: "church-b",
      availableChurches: [churchA, churchB],
    });
    renderPortal();

    openAccountMenu();
    expect(text()).toContain("View as a Community Leader");
    expect(document.body.querySelector('a[href="/community/community-b"]')).not.toBeNull();
    expect(document.body.querySelector('a[href="/community/community-a"]')).toBeNull();
  });

  it("keeps the localized switcher contract in English and Kiswahili", () => {
    expect(sw.church_switcher.my_church).toBe("Kanisa Langu");
    expect(sw.church_switcher.my_churches).toBe("Makanisa Yangu");
    expect(sw.church_switcher.switch_church).toBe("Badili Kanisa");
    expect(sw.church_switcher.current_badge).toBe("Unatumia sasa");
    expect(sw.church_switcher.choose).toBe("Chagua");
    expect(sw.church_switcher.member).toBe("Mwanachama");
    expect(Object.keys(en.church_switcher).sort()).toEqual(Object.keys(sw.church_switcher).sort());
  });
});
