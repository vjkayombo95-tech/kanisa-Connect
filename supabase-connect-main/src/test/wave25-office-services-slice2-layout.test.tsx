import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChurchAdminLayout } from "@/components/church-admin/ChurchAdminLayout";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const state: { language: "sw" | "en" } = { language: "sw" };

function translate(key: string, options?: Record<string, string>) {
  const resource = state.language === "sw" ? sw : en;
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, resource);

  const text = typeof value === "string" ? value : key;
  return Object.entries(options ?? {}).reduce((result, [name, replacement]) => result.replace(`{{${name}}}`, replacement), text);
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { language: state.language } }),
}));

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/church-admin/ChurchAdminSidebar", () => ({
  ChurchAdminSidebar: () => <aside data-testid="admin-sidebar" />,
}));

vi.mock("@/components/church-admin/ChurchAdminCommandMenu", () => ({
  ChurchAdminCommandMenu: () => <div data-testid="admin-command-menu" />,
}));

vi.mock("@/components/church-admin/FloatingAIAssistant", () => ({
  FloatingAIAssistant: () => null,
}));

vi.mock("@/components/staff-mobile/StaffMobileExperience", () => ({
  STAFF_MOBILE_CONFIGS: {},
  StaffMobileBackHeader: ({ title, showTitle, ariaLabel }: { title: string; showTitle?: boolean; ariaLabel?: string }) => (
    <button type="button" aria-label={ariaLabel} data-testid="staff-mobile-back-header">
      {showTitle === false ? null : title}
    </button>
  ),
  StaffMobileBottomNav: () => null,
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isLoading: false,
    getFeatureState: () => ({ exists: true, visible: true, locked: false }),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    profile: { full_name: "Office Admin", church_name: "Parokia Mtakatifu" },
    isSuperAdmin: false,
    churchId: "church-a",
    staffWorkspace: "admin",
    user: { id: "admin-a" },
    userRole: "church_admin",
    isLoading: false,
  }),
}));

vi.mock("@/lib/staff-mobile-registry", () => ({
  STAFF_MOBILE_CONFIGS: { admin: { workspace: "admin", home: "/church-admin", workRoute: "/church-admin/members", servicesRoute: "/church-admin/services" } },
  canSuperAdminEnterChurchWorkspace: () => true,
  isStaffRouteAllowed: () => true,
}));

let host: HTMLDivElement;
let root: Root;

function renderLayout(path: string, child: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/church-admin" element={<ChurchAdminLayout />}>
              <Route path="event-requests" element={child} />
              <Route path="members" element={<div>Members content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

function headings() {
  return Array.from(host.querySelectorAll("h1")).map((heading) => heading.textContent?.trim());
}

describe("Wave 25 office services layout localization", () => {
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    state.language = "sw";
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it("keeps the office page heading as the only H1 and translates the shell context in Kiswahili", () => {
    renderLayout("/church-admin/event-requests", <h1>Huduma za Ofisi</h1>);

    expect(headings()).toEqual(["Huduma za Ofisi"]);
    expect(host.textContent).toContain("Usimamizi wa Kanisa");
    expect(host.textContent).toContain("Parokia Mtakatifu");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.textContent).toBe("");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.getAttribute("aria-label")).toBe("Rudi kutoka Huduma za Ofisi");
  });

  it("uses English shell labels when English is selected", () => {
    state.language = "en";
    renderLayout("/church-admin/event-requests", <h1>Parish Office Services</h1>);

    expect(headings()).toEqual(["Parish Office Services"]);
    expect(host.textContent).toContain("Church Admin Workspace");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.textContent).toBe("");
    expect(host.querySelector("[data-testid='staff-mobile-back-header']")?.getAttribute("aria-label")).toBe("Back from Parish Office Services");
  });

  it("preserves the parent layout heading on other admin routes", () => {
    renderLayout("/church-admin/members", <div>Members content</div>);

    expect(headings()).toContain("Wanachama");
  });
});
