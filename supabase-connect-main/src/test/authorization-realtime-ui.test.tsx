import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

let roles: string[] = ["church_admin"];
let permissionAllowed = true;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "target@example.com" },
    churchId: "church-1",
    isSuperAdmin: false,
    userRole: roles[0] ?? null,
    userRoles: roles,
    isLoading: false,
    authorizationReady: true,
    authorizationError: null,
    refreshUserData: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: permissionAllowed, error: null })),
  },
}));

vi.mock("@/lib/church-admin-notifications", () => ({
  EMPTY_CHURCH_ADMIN_PENDING_COUNTS: {},
  getChurchAdminSidebarBadge: () => null,
  useChurchAdminPendingCounts: () => ({ data: {} }),
}));

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { WorkspaceNavigation, type WorkspaceNavigationGroup } from "@/components/workspace/framework";
import { NavigationGroups } from "@/components/workspace/navigation-groups";
import { invalidateAuthorizationQueries } from "@/lib/authorization-realtime";

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

function mount(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  act(() => root.render(ui));
  return { container, root };
}

async function waitForCondition(assertion: () => void, timeoutMs = 2000) {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => new Promise((resolve) => window.setTimeout(resolve, 10)));
    }
  }
  throw lastError;
}

afterEach(async () => {
  roles = ["church_admin"];
  permissionAllowed = true;
  while (mounted.length) {
    const item = mounted.pop();
    if (!item) continue;
    await act(async () => item.root.unmount());
    item.container.remove();
  }
});

describe("authorization UI recomputation", () => {
  it("re-evaluates a mounted role guard for both grant and revoke", async () => {
    const renderTree = () => (
      <MemoryRouter key={roles.join(",")} initialEntries={["/pastoral"]}>
        <Routes>
          <Route path="/pastoral" element={(
            <ProtectedRoute allowedRoles={["pastor"]}><div>Pastoral protected page</div></ProtectedRoute>
          )} />
          <Route path="/church-admin" element={<div>Safe workspace</div>} />
        </Routes>
      </MemoryRouter>
    );
    const { container, root } = mount(renderTree());

    expect(container.textContent).toContain("Safe workspace");

    roles = ["church_admin", "pastor"];
    await act(async () => root.render(renderTree()));
    expect(container.textContent).toContain("Pastoral protected page");

    roles = ["church_admin"];
    await act(async () => root.render(renderTree()));
    expect(container.textContent).toContain("Safe workspace");
  });

  it("hides mounted navigation after grant-cache invalidation refetches a revoke", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const groups: WorkspaceNavigationGroup[] = [{
      id: NavigationGroups.OPERATIONS,
      label: "Operations",
      items: [{ id: "events", label: "Events", to: "/church-admin/events", featureFlag: "events", icon: () => createElement("span") }],
    }];
    const { container } = mount(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/church-admin"]}>
          <WorkspaceNavigation groups={groups} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitForCondition(() => expect(container.querySelector('a[href="/church-admin/events"]')).toBeTruthy());

    permissionAllowed = false;
    await act(async () => {
      await invalidateAuthorizationQueries(queryClient, "church_role_permissions", {
        userId: "user-1", churchId: "church-1",
      });
    });

    await waitForCondition(() => expect(container.querySelector('a[href="/church-admin/events"]')).toBeNull());
  });
});
