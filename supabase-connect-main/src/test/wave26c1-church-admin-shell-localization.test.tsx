import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreditCard, Search } from "lucide-react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChurchAdminCommandMenu } from "@/components/church-admin/ChurchAdminCommandMenu";
import { ChurchAdminLayout } from "@/components/church-admin/ChurchAdminLayout";
import { ChurchAdminLiveMediaAwareness } from "@/components/church-admin/ChurchAdminLiveMediaAwareness";
import { ChurchAdminSidebar } from "@/components/church-admin/ChurchAdminSidebar";
import { FloatingAIAssistant } from "@/components/church-admin/FloatingAIAssistant";
import { SidebarProvider } from "@/components/ui/sidebar";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const state = vi.hoisted(() => ({
  language: "sw" as "sw" | "en",
  workspace: "admin" as string | null,
  billing: {
    isLoading: false,
    isExpired: true,
    currentPlanDefinition: { name: "Free" },
  },
  livestream: {
    featureEnabled: true,
    featureLoading: false,
    isLoading: false,
    isError: false,
    data: null as null | { status: "live" | "scheduled"; title: string; scheduledStart: string | null },
  },
  radio: {
    featureEnabled: true,
    featureLoading: false,
    isLoading: false,
    isError: false,
    data: [] as Array<{ name: string; isDefault: boolean }>,
  },
}));

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

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    profile: { full_name: "Office Admin", church_name: "Parokia Mtakatifu" },
    isSuperAdmin: false,
    churchId: "church-a",
    staffWorkspace: state.workspace,
    user: { id: "admin-a" },
    userRole: "church_admin",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isLoading: false,
    getFeatureState: () => ({ exists: true, visible: true, locked: false }),
  }),
}));

vi.mock("@/hooks/use-billing-access", () => ({
  useBillingAccess: () => state.billing,
}));

vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => state.livestream,
}));

vi.mock("@/hooks/use-church-radio", () => ({
  useChurchRadioStations: () => state.radio,
}));

vi.mock("@/components/staff-mobile/StaffMobileExperience", () => ({
  useVisibleStaffServices: () => ({
    isLoading: false,
    services: [
      {
        id: "members",
        label: "Members",
        labelKey: "staff_services.members.label",
        group: "People",
        groupKey: "staff_service_groups.people",
        route: "/church-admin/members",
        icon: Search,
      },
      {
        id: "event-requests",
        label: "Parish Office Services",
        labelKey: "staff_services.event_requests.label",
        group: "Operations",
        groupKey: "staff_service_groups.operations",
        route: "/church-admin/event-requests",
        icon: CreditCard,
      },
    ],
  }),
  StaffMobileBackHeader: ({ title, showTitle, ariaLabel }: { title: string; showTitle?: boolean; ariaLabel?: string }) => (
    <button type="button" aria-label={ariaLabel} data-testid="staff-mobile-back-header">
      {showTitle === false ? null : title}
    </button>
  ),
  StaffMobileBottomNav: () => null,
}));

function RouteOpened() {
  const location = useLocation();
  return <p data-testid="route-opened">{location.pathname}{location.search}</p>;
}

let host: HTMLDivElement;
let root: Root;

function render(children: ReactNode, initialEntries = ["/church-admin"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter key={initialEntries[0]} initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

function renderLayout(path: string, child: ReactNode) {
  render(
    <Routes>
      <Route path="/church-admin" element={<ChurchAdminLayout />}>
        <Route path="event-requests" element={child} />
        <Route path="members" element={<div>Member route</div>} />
      </Route>
    </Routes>,
    [path],
  );
}

function renderSidebar() {
  render(
    <SidebarProvider>
      <ChurchAdminSidebar />
    </SidebarProvider>,
  );
}

beforeEach(() => {
  state.language = "sw";
  state.workspace = "admin";
  state.billing = { isLoading: false, isExpired: true, currentPlanDefinition: { name: "Free" } };
  state.livestream = { featureEnabled: true, featureLoading: false, isLoading: false, isError: false, data: null };
  state.radio = { featureEnabled: true, featureLoading: false, isLoading: false, isError: false, data: [] };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.querySelectorAll("[role='dialog']").forEach((dialog) => dialog.remove());
  vi.clearAllMocks();
});

describe("Wave 26C-1 Church Admin shell localization", () => {
  it("uses localized route headings, breadcrumbs and mobile titles without duplicating Event Requests H1", () => {
    renderLayout("/church-admin/event-requests", <h1>Huduma za Ofisi</h1>);
    expect(Array.from(host.querySelectorAll("h1")).map((heading) => heading.textContent?.trim())).toEqual(["Huduma za Ofisi"]);
    expect(host.textContent).toContain("Huduma za Ofisi");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.textContent).toBe("");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.getAttribute("aria-label")).toBe("Rudi kutoka Huduma za Ofisi");

    state.language = "en";
    renderLayout("/church-admin/members", <div>Member route</div>);
    expect(Array.from(host.querySelectorAll("h1")).map((heading) => heading.textContent?.trim())).toContain("Members");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.textContent).toBe("Members");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.getAttribute("aria-label")).toBe("Back from Members");
  });

  it("localizes sidebar billing copy while preserving billing route visibility", () => {
    renderSidebar();
    expect(host.textContent).toContain("Ruhusa za nafasi zimepunguzwa");
    expect(host.textContent).toContain("Sasisha usajili wa parokia");
    expect(host.querySelector<HTMLAnchorElement>('a[href="/church-admin/billing"]')?.textContent).toContain("Tazama malipo");

    state.language = "en";
    state.billing = { isLoading: false, isExpired: false, currentPlanDefinition: { name: "Free" } };
    renderSidebar();
    expect(host.textContent).toContain("Free plan");
    expect(host.textContent).toContain("Production feature access remains enforced.");
  });

  it("localizes the command menu and keeps approved-service navigation intact", () => {
    render(
      <>
        <ChurchAdminCommandMenu />
        <Routes><Route path="/church-admin/:service" element={<RouteOpened />} /></Routes>
      </>,
    );

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Fungua menyu ya huduma za Usimamizi wa Kanisa"]')?.click());
    const input = document.body.querySelector<HTMLInputElement>('input[aria-label="Tafuta huduma zilizoidhinishwa za Usimamizi wa Kanisa"]');
    expect(input).not.toBeNull();
    expect(document.body.textContent).toContain("Wanachama");

    const service = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Wanachama"),
    );
    act(() => service?.click());
    expect(host.textContent).toContain("/church-admin/members");
  });

  it("localizes live-media awareness without exposing unauthorized media", () => {
    state.livestream.data = { status: "scheduled", title: "Evening Mass", scheduledStart: "2026-08-23T15:00:00Z" };
    state.radio.data = [{ name: "Parish Radio", isDefault: true }];
    render(<ChurchAdminLiveMediaAwareness />);
    expect(host.textContent).toContain("Ufuatiliaji wa matangazo");
    expect(host.textContent).toContain("Imepangwa");
    expect(host.textContent).toContain("Parish Radio");
    expect(host.querySelectorAll("audio, iframe")).toHaveLength(0);

    state.workspace = "finance";
    render(<ChurchAdminLiveMediaAwareness />);
    expect(host.querySelector('[data-testid="church-admin-live-media"]')).toBeNull();
  });

  it("localizes the AI assistant shell while preserving canonical quick-prompt navigation", () => {
    render(
      <>
        <FloatingAIAssistant />
        <Routes><Route path="/church-admin/analytics-assistant" element={<RouteOpened />} /></Routes>
      </>,
    );

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Uliza AI"]')?.click());
    expect(host.textContent).toContain("Msaidizi wa Uchambuzi");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Uliza msaidizi wa uchambuzi"]')?.placeholder).toBe("Uliza chochote...");
    expect(host.textContent).toContain("Onyesha wachangiaji wakuu");

    const prompt = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Onyesha wachangiaji wakuu"),
    );
    act(() => prompt?.click());
    expect(host.textContent).toContain("/church-admin/analytics-assistant?q=Show%20top%20contributors");
  });

  it("keeps new shell translation namespaces in parity without duplicate locale keys", () => {
    expect(JSON.stringify(en.church_admin_layout.route_titles)).not.toMatch(/church_admin_layout\.route_titles/);
    expect(Object.keys(en.church_admin_layout.route_titles).sort()).toEqual(Object.keys(sw.church_admin_layout.route_titles).sort());
    expect(Object.keys(en.church_admin_shell).sort()).toEqual(Object.keys(sw.church_admin_shell).sort());
    expect(en.church_admin_shell.ai.quick_prompts.top_contributors).toBe("Show top contributors");
    expect(sw.church_admin_shell.ai.quick_prompts.top_contributors).toBe("Onyesha wachangiaji wakuu");
  });
});
