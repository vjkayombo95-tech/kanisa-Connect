import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LockedFeatureNotice } from "@/components/billing/LockedFeatureNotice";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import i18n, { changeAppLanguage } from "@/i18n";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import { translateSystemLabel } from "@/lib/localization";

type LocaleTree = Record<string, unknown>;

const authState = vi.hoisted(() => ({
  current: {
    user: { id: "user-1" },
    isSuperAdmin: false,
    churchId: "church-1",
    userRole: "church_admin",
    isLoading: false,
    authorizationError: null as Error | null,
    authorizationFailure: null as string | null,
    refreshUserData: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState.current,
}));

vi.mock("@/lib/error-logger", () => ({
  captureException: vi.fn(),
}));

let host: HTMLDivElement;
let root: Root;

function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as LocaleTree, path)
      : [path];
  });
}

function text() {
  return host.textContent ?? "";
}

function buttonByName(name: string) {
  return Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.trim() === name);
}

function controlByAriaLabel(label: string) {
  return Array.from(host.querySelectorAll("button,a")).find((element) => element.getAttribute("aria-label") === label);
}

function renderNode(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function ThrowString(): ReactNode {
  throw "render failed";
}

describe("Wave 26B shared message localization", () => {
  beforeEach(async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    authState.current = {
      user: { id: "user-1" },
      isSuperAdmin: false,
      churchId: "church-1",
      userRole: "church_admin",
      isLoading: false,
      authorizationError: null,
      authorizationFailure: null,
      refreshUserData: vi.fn(),
    };
    await changeAppLanguage("en");
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it("keeps new shared message keys in both active locale files", () => {
    const enSharedKeys = flattenKeys(en.shared).sort();
    const swSharedKeys = flattenKeys(sw.shared).sort();
    expect(swSharedKeys).toEqual(enSharedKeys);
    expect(en.shared.auth.workspace_access_title).toBe("We could not verify your workspace access.");
    expect(sw.shared.auth.workspace_access_title).toBe("Hatukuweza kuthibitisha ruhusa zako za nafasi hii.");
    expect(en.shared.billing.free_plan).toBe("Free Plan");
    expect(sw.shared.billing.free_plan).toBe("Mpango wa Bure");
  });

  it("localizes ProtectedRoute authorization recovery messages and retry action", async () => {
    authState.current.authorizationError = new Error("permission denied");

    renderNode(
      <MemoryRouter initialEntries={["/church-admin"]}>
        <ProtectedRoute requireChurch requireAdmin>
          <div>Secret admin page</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(text()).toContain("We could not verify your workspace access.");
    expect(buttonByName("Retry")).toBeTruthy();

    await changeAppLanguage("sw");
    renderNode(
      <MemoryRouter initialEntries={["/church-admin"]}>
        <ProtectedRoute requireChurch requireAdmin>
          <div>Secret admin page</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(text()).toContain("Hatukuweza kuthibitisha ruhusa zako za nafasi hii.");
    expect(buttonByName("Jaribu tena")).toBeTruthy();
  });

  it("preserves admin access restrictions while localizing shared messages", () => {
    authState.current.userRole = "member";

    renderNode(
      <MemoryRouter initialEntries={["/church-admin/members"]}>
        <Routes>
          <Route
            path="/church-admin/members"
            element={(
              <ProtectedRoute requireChurch requireAdmin>
                <div>Secret admin page</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/portal/dashboard" element={<div>Member dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(text()).toContain("Member dashboard");
    expect(text()).not.toContain("Secret admin page");
  });

  it("localizes app error fallback actions and keeps missing-key fallback safe", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderNode(
      <AppErrorBoundary>
        <ThrowString />
      </AppErrorBoundary>,
    );

    expect(text()).toContain("Application Error");
    expect(buttonByName("Reload App")).toBeTruthy();
    expect(translateSystemLabel(i18n.t, "shared.missing_key", "Fallback copy")).toBe("Fallback copy");

    await changeAppLanguage("sw");
    renderNode(
      <AppErrorBoundary>
        <ThrowString />
      </AppErrorBoundary>,
    );

    expect(text()).toContain("Hitilafu ya Programu");
    expect(buttonByName("Pakia programu upya")).toBeTruthy();

    consoleError.mockRestore();
  });

  it("localizes locked-feature notices and language switcher accessibility labels", async () => {
    renderNode(
      <MemoryRouter>
        <LockedFeatureNotice title="Analytics" description="Advanced reports require a paid plan." />
        <LanguageSwitcher />
      </MemoryRouter>,
    );

    expect(text()).toContain("Upgrade to unlock");
    expect(controlByAriaLabel("Switch language to Kiswahili")).toBeTruthy();

    await act(async () => {
      controlByAriaLabel("Switch language to Kiswahili")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(text()).toContain("Boresha ili kufungua");
    expect(controlByAriaLabel("Badili lugha kwenda Kiingereza")).toBeTruthy();
  });
});
