import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  buildDeactivateParishPatch,
  buildDeactivateStaffPatch,
  describeParishAssignment,
  DIOCESE_STAFF_ROLES,
  isParishAlreadyActiveElsewhere,
  isValidDioceseRole,
  makeDioceseSlug,
} from "@/lib/diocese-management";
import { requireSuperAdminAccess } from "@/components/auth/ProtectedRoute";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({
  dioceses: [
    {
      id: "diocese-a",
      name: "Roman Catholic Diocese of Example",
      slug: "roman-catholic-diocese-of-example",
      description: "Existing Diocese description",
      status: "active",
      created_at: "2026-10-08T12:00:00Z",
      updated_at: "2026-10-08T12:00:00Z",
    },
  ],
  churches: [
    { id: "church-a", name: "Example Parish", slug: "example-parish", status: "active" },
  ],
  assignments: [],
  staff: [
    {
      id: "staff-a",
      diocese_id: "diocese-a",
      user_id: "99999999-9999-4999-8999-999999999999",
      role: "diocese_secretary",
      status: "active",
      created_at: "2026-10-08T12:00:00Z",
    },
  ],
  directory: [],
}));

vi.mock("@/integrations/supabase/client", () => {
  function tableRows(table: string) {
    if (table === "dioceses") return supabaseState.dioceses;
    if (table === "churches") return supabaseState.churches;
    if (table === "diocese_churches") return supabaseState.assignments;
    if (table === "diocese_staff") return supabaseState.staff;
    throw new Error(`Unexpected table ${table}`);
  }

  return {
    supabase: {
      from: (table: string) => {
        const filters: Array<[string, unknown]> = [];
        const builder = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return builder;
          },
          order: async () => {
            const rows = tableRows(table).filter((row) => (
              filters.every(([column, value]) => row[column as keyof typeof row] === value)
            ));
            return { data: rows, error: null };
          },
          insert: async () => ({ error: null }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
        return builder;
      },
      rpc: async (name: string) => {
        if (name !== "search_super_admin_user_directory") throw new Error(`Unexpected RPC ${name}`);
        return { data: supabaseState.directory, error: null };
      },
    },
  };
});

import DioceseManagement from "@/pages/super-admin/DioceseManagement";

const routes = readFileSync(join(process.cwd(), "src/routes/SuperAdminRoutes.tsx"), "utf8");
const sidebar = readFileSync(join(process.cwd(), "src/components/super-admin/SuperAdminSidebar.tsx"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/components/super-admin/SuperAdminLayout.tsx"), "utf8");
const page = readFileSync(join(process.cwd(), "src/pages/super-admin/DioceseManagement.tsx"), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261008120000_diocese_super_admin_user_directory.sql"), "utf8");

const mounts: Array<{ host: HTMLDivElement; root: Root }> = [];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function Providers({ children, path }: { children?: ReactNode; path: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return createElement(
    QueryClientProvider,
    { client },
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/super-admin/dioceses", element: children }),
        createElement(Route, { path: "/super-admin/dioceses/:dioceseId", element: children }),
      ),
    ),
  );
}

function renderPage(path: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(Providers, { path }, createElement(DioceseManagement)));
  });
  mounts.push({ host, root });
  return host;
}

async function waitForCondition(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
  }
  throw lastError;
}

afterEach(() => {
  while (mounts.length > 0) {
    const mounted = mounts.pop();
    if (!mounted) continue;
    act(() => mounted.root.unmount());
    mounted.host.remove();
  }
  document.body.innerHTML = "";
});

describe("Super Admin Diocese management", () => {
  it("adds Super Admin Diocese navigation and protected routes", () => {
    expect(sidebar).toContain('title: "Dioceses"');
    expect(sidebar).toContain('url: "/super-admin/dioceses"');
    expect(routes).toContain('path="dioceses"');
    expect(routes).toContain('path="dioceses/:dioceseId"');
    expect(layout).toContain('match: "/super-admin/dioceses"');
    expect(requireSuperAdminAccess(false)).toBe(false);
    expect(requireSuperAdminAccess(true)).toBe(true);
  });

  it("supports list, empty, loading, error, create, edit, and details states", () => {
    expect(page).toContain("No Diocese has been added yet.");
    expect(page).toContain("Unable to load Dioceses.");
    expect(page).toContain("<Skeleton");
    expect(page).toContain("Add Diocese");
    expect(page).toContain("Edit Diocese");
    expect(page).toContain("Manage Diocese details, parishes, and staff.");
  });

  it("generates and validates Diocese slugs and supported staff roles", () => {
    expect(makeDioceseSlug(" Archdiocese of St. Joseph's Dar ")).toBe("archdiocese-of-st-josephs-dar");
    expect(DIOCESE_STAFF_ROLES).toEqual([
      "diocese_admin",
      "bishop",
      "diocese_secretary",
      "diocese_finance",
      "diocese_staff",
    ]);
    expect(isValidDioceseRole("diocese_secretary")).toBe(true);
    expect(isValidDioceseRole("church_admin")).toBe(false);
  });

  it("prevents silent active parish movement and keeps removal as deactivation", () => {
    const assignments = [
      { id: "link-1", church_id: "church-a", diocese_id: "diocese-a", status: "active", joined_at: "", ended_at: null },
    ] as const;
    const dioceses = [{ id: "diocese-a", name: "Diocese A" }];
    const church = { id: "church-a", name: "Parish A" };

    expect(describeParishAssignment(church, assignments, dioceses)).toBe("Assigned to Diocese A");
    expect(isParishAlreadyActiveElsewhere(assignments, "church-a", "diocese-b")).toBe(true);
    expect(isParishAlreadyActiveElsewhere(assignments, "church-a", "diocese-a")).toBe(false);
    expect(buildDeactivateParishPatch().status).toBe("ended");
  });

  it("keeps Diocese staff removal as deactivation and does not expose church authority writes", () => {
    expect(buildDeactivateStaffPatch()).toEqual({ status: "revoked" });
    expect(page).not.toContain("church_memberships");
    expect(page).not.toContain("user_roles");
    expect(page).not.toContain('from("members")');
    expect(page).not.toContain("{user?.email ?? staffMember.user_id}");
    expect(page).toContain("User lookup unavailable");
  });

  it("uses a Super Admin-only user directory RPC with safe grants and search_path", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain("public.is_platform_super_admin(auth.uid())");
    expect(migration).toContain("public.is_super_admin(auth.uid())");
    expect(migration).toContain("revoke all on function public.search_super_admin_user_directory");
    expect(migration).toContain("grant execute on function public.search_super_admin_user_directory");
    expect(page).toContain("search_super_admin_user_directory");
  });

  it("opens the edit dialog with the selected Diocese values", async () => {
    const host = renderPage("/super-admin/dioceses/diocese-a");

    await waitForCondition(() => {
      expect(host.textContent).toContain("Roman Catholic Diocese of Example");
    });

    const editButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Edit Diocese"));
    expect(editButton).toBeTruthy();

    await act(async () => {
      editButton?.click();
    });

    await waitForCondition(() => {
      const nameInput = document.querySelector<HTMLInputElement>("#diocese-name");
      const slugInput = document.querySelector<HTMLInputElement>("#diocese-slug");
      const descriptionInput = document.querySelector<HTMLTextAreaElement>("#diocese-description");

      expect(nameInput?.value).toBe("Roman Catholic Diocese of Example");
      expect(slugInput?.value).toBe("roman-catholic-diocese-of-example");
      expect(descriptionInput?.value).toBe("Existing Diocese description");
      expect(document.body.textContent).toContain("User lookup unavailable");
      expect(document.body.textContent).not.toContain("99999999-9999-4999-8999-999999999999");
    });
  });
});
