import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAuthorizationErrorState,
  createLoadingAuthorizationState,
  createResolvedAuthorizationState,
  isAuthorizationReady,
} from "@/lib/authorization-readiness";
import { AuthorizationBootstrapError } from "@/lib/authorization-bootstrap";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refreshUserData = vi.fn(async () => {});
let authState = {
  user: { id: "user-1" } as { id: string } | null,
  isSuperAdmin: false,
  churchId: "church-1" as string | null,
  userRoles: ["member"] as string[],
  isLoading: false,
  authorizationReady: true,
  authorizationError: null as Error | null,
  authorizationResolution: createResolvedAuthorizationState({
    profile: { id: "user-1" },
    membership: { id: "member-1" },
    roles: ["member"],
    permissions: { can_view_church_workspace: true },
    churchId: "church-1",
  }),
  refreshUserData,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

function tree(guard: React.ReactNode, path = "/protected") {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/protected" element={guard} />
        <Route path="/onboarding" element={<div>Member Onboarding</div>} />
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/church-admin" element={<div>Church Admin home</div>} />
        <Route path="/portal" element={<div>Member home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mount(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  act(() => root.render(ui));
  return { container, root };
}

function setResolvedUser(roles: string[], churchId: string | null = "church-1", userId = "user-1") {
  authState = {
    ...authState,
    user: { id: userId },
    churchId,
    userRoles: roles,
    isLoading: false,
    authorizationReady: true,
    authorizationError: null,
    authorizationResolution: createResolvedAuthorizationState({
      profile: { id: userId },
      membership: churchId ? { id: `member-${userId}` } : null,
      roles,
      permissions: {},
      churchId,
    }),
  };
}

function setLoading(source: "membership" | "roles") {
  const resolution = createLoadingAuthorizationState("found");
  resolution.profile = "found";
  resolution[source === "membership" ? "roles" : "membership"] = "found";
  authState = {
    ...authState,
    churchId: null,
    userRoles: [],
    isLoading: true,
    authorizationReady: false,
    authorizationError: null,
    authorizationResolution: resolution,
  };
}

afterEach(async () => {
  refreshUserData.mockClear();
  setResolvedUser(["member"]);
  while (mounted.length) {
    const item = mounted.pop();
    if (!item) continue;
    await act(async () => item.root.unmount());
    item.container.remove();
  }
});

describe("authorization readiness", () => {
  it("requires every authorization source to resolve", () => {
    const loading = createLoadingAuthorizationState("found");
    expect(isAuthorizationReady(loading)).toBe(false);
    expect(isAuthorizationReady(createResolvedAuthorizationState({
      profile: null,
      membership: null,
      roles: [],
      permissions: null,
      churchId: null,
    }))).toBe(true);
    expect(isAuthorizationReady(createAuthorizationErrorState())).toBe(false);
  });

  it("keeps a Church Admin on a protected page after refresh", () => {
    setResolvedUser(["church_admin"]);
    const { container } = mount(tree(<ProtectedRoute requireChurch requireAdmin><div>Protected page</div></ProtectedRoute>));
    expect(container.textContent).toContain("Protected page");
    expect(container.textContent).not.toContain("Member Onboarding");
  });

  it("uses the complete Pastor and Church Admin role union after refresh", () => {
    setResolvedUser(["church_admin", "pastor"]);
    const { container } = mount(tree(<ProtectedRoute requireChurch allowedRoles={["pastor"]}><div>Pastoral page</div></ProtectedRoute>));
    expect(container.textContent).toContain("Pastoral page");
  });

  it("allows Treasurer and Secretary direct-route access from either assigned role", () => {
    setResolvedUser(["treasurer", "secretary"]);
    const { container } = mount(tree(<ProtectedRoute requireChurch allowedRoles={["secretary"]}><div>Operations page</div></ProtectedRoute>));
    expect(container.textContent).toContain("Operations page");
  });

  it("keeps a valid member on the dashboard after refresh", () => {
    setResolvedUser(["member"]);
    const { container } = mount(tree(<ProtectedRoute requireChurch><div>Member dashboard</div></ProtectedRoute>));
    expect(container.textContent).toContain("Member dashboard");
  });

  it("redirects a genuinely unresolved church assignment only after all lookups finish", () => {
    setResolvedUser([], null);
    const { container } = mount(tree(<ProtectedRoute requireChurch><div>Protected page</div></ProtectedRoute>));
    expect(container.textContent).toContain("Member Onboarding");
  });

  it("does not show onboarding while membership is loading", () => {
    setLoading("membership");
    const { container } = mount(tree(<ProtectedRoute requireChurch><div>Protected page</div></ProtectedRoute>));
    expect(container.textContent).toContain("Preparing your workspace");
    expect(container.textContent).not.toContain("Member Onboarding");
  });

  it("does not show onboarding while all roles are loading", () => {
    setLoading("roles");
    const { container } = mount(tree(<ProtectedRoute requireChurch><div>Protected page</div></ProtectedRoute>));
    expect(container.textContent).toContain("Preparing your workspace");
    expect(container.textContent).not.toContain("Member Onboarding");
  });

  it("shows an error and retry state instead of onboarding when authorization fails", () => {
    authState = {
      ...authState,
      churchId: null,
      isLoading: false,
      authorizationReady: false,
      authorizationError: new Error("membership query failed"),
      authorizationResolution: createAuthorizationErrorState(),
    };
    const { container } = mount(tree(<ProtectedRoute requireChurch><div>Protected page</div></ProtectedRoute>));
    expect(container.textContent).toContain("could not verify your workspace access");
    expect(container.textContent).toContain("Retry");
    expect(container.textContent).not.toContain("Member Onboarding");
  });

  it("shows a connectivity state for exhausted transient failures", () => {
    authState = {
      ...authState,
      churchId: null,
      isLoading: false,
      authorizationReady: false,
      authorizationError: new AuthorizationBootstrapError("Failed to fetch", "NETWORK"),
      authorizationResolution: createAuthorizationErrorState(),
    };
    const { container } = mount(tree(<ProtectedRoute requireChurch><div>Protected page</div></ProtectedRoute>));
    expect(container.textContent).toContain("having trouble connecting");
    expect(container.textContent).toContain("still signed in");
    expect(container.textContent).not.toContain("Protected page");
  });

  it("does not reuse a previous user's onboarding decision after user switching", async () => {
    setResolvedUser(["member"], "church-1", "old-user");
    const guarded = () => <ProtectedRoute requireChurch><div>Protected page</div></ProtectedRoute>;
    const { container, root } = mount(tree(guarded()));
    expect(container.textContent).toContain("Protected page");

    setLoading("membership");
    authState = { ...authState, user: { id: "new-user" } };
    await act(async () => root.render(tree(guarded())));
    expect(container.textContent).toContain("Preparing your workspace");
    expect(container.textContent).not.toContain("Member Onboarding");

    setResolvedUser(["pastor"], "church-2", "new-user");
    await act(async () => root.render(tree(guarded())));
    expect(container.textContent).toContain("Protected page");
  });

  it("keeps a direct URL stable until hydration completes without an onboarding flash", async () => {
    setLoading("roles");
    const guarded = () => <ProtectedRoute requireChurch><div>Direct protected page</div></ProtectedRoute>;
    const { container, root } = mount(tree(guarded()));
    expect(container.textContent).toContain("Preparing your workspace");
    expect(container.textContent).not.toContain("Member Onboarding");

    setResolvedUser(["church_admin", "pastor"]);
    await act(async () => root.render(tree(guarded())));
    expect(container.textContent).toContain("Direct protected page");
    expect(container.textContent).not.toContain("Member Onboarding");
  });
});
