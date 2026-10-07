import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const readSource = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8");

const migration = readSource(
  "supabase/migrations/20261009120000_diocese_workspace_discovery.sql",
);

const sqlSecurityTest = readSource(
  "supabase/tests/diocese_workspace_discovery_security.sql",
);

const app = readSource("src/App.tsx");

const workspaceLib = readSource(
  "src/lib/diocese-workspace.ts",
);

const routeGuard = readSource(
  "src/components/diocese/DioceseRouteGuard.tsx",
);

const workspaceContext = readSource(
  "src/components/diocese/DioceseWorkspaceContext.tsx",
);

const sidebar = readSource(
  "src/components/diocese/DioceseSidebar.tsx",
);

const routes = readSource(
  "src/routes/DioceseRoutes.tsx",
);

const portalLayout = readSource(
  "src/components/portal/PortalLayout.tsx",
);

const churchSwitcher = readSource(
  "src/components/portal/MemberChurchSwitcherDialog.tsx",
);

const authContext = readSource(
  "src/contexts/AuthContext.tsx",
);

describe("Diocese workspace context", () => {
  it("discovers Diocese workspaces through a caller-bound RPC", () => {
    expect(migration).toContain(
      "create or replace function public.get_my_diocese_workspaces()",
    );
    expect(migration).toContain("auth.uid() is not null");
    expect(migration).toContain("ds.user_id = auth.uid()");
    expect(migration).toContain("ds.status = 'active'");
    expect(migration).toContain("d.status = 'active'");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");

    expect(migration).not.toContain(
      "get_my_diocese_workspaces(_user_id",
    );

    expect(workspaceLib).toContain(
      '"get_my_diocese_workspaces" as never',
    );
  });

  it("keeps the internal Diocese staff helper unavailable to authenticated callers", () => {
    expect(sqlSecurityTest).toContain("is_diocese_staff");
    expect(sqlSecurityTest).toContain("authenticated");
    expect(sqlSecurityTest).toContain(
      "get_my_diocese_workspaces",
    );

    expect(workspaceLib).not.toContain("is_diocese_staff");
    expect(routeGuard).not.toContain("is_diocese_staff");
    expect(portalLayout).not.toContain("is_diocese_staff");
  });

  it("uses a dedicated Diocese route guard without requiring church authority", () => {
    expect(app).toContain('path="/diocese/:dioceseId/*"');
    expect(app).toContain("<DioceseRouteGuard>");
    expect(app).toContain("<DioceseRoutes />");

    const dioceseRouteStart = app.indexOf(
      'path="/diocese/:dioceseId/*"',
    );

    expect(dioceseRouteStart).toBeGreaterThan(-1);

    const dioceseRouteSlice = app.slice(
      dioceseRouteStart,
      dioceseRouteStart + 350,
    );

    expect(dioceseRouteSlice).not.toContain("requireChurch");
    expect(dioceseRouteSlice).not.toContain("requireAdmin");
  });

  it("fails closed when the requested Diocese is not in the caller workspace list", () => {
    expect(routeGuard).toContain(
      "getMyDioceseWorkspaces",
    );
    expect(routeGuard).toContain(
      "findDioceseWorkspace",
    );
    expect(routeGuard).toContain(
      "workspaceQuery.isError",
    );
    expect(routeGuard).toContain(
      "if (!workspace)",
    );
    expect(routeGuard).toContain(
      '<Navigate to="/" replace />',
    );
    expect(routeGuard).toContain(
      "<DioceseWorkspaceProvider workspace={workspace}>",
    );
  });

  it("keeps the active Diocese URL-bound instead of storing it as active church context", () => {
    expect(sidebar).toContain(
      "const baseUrl = `/diocese/${workspace.diocese_id}`",
    );

    expect(portalLayout).toContain(
      'to={`/diocese/${workspace.diocese_id}`}',
    );

    expect(portalLayout).not.toContain(
      "switchChurch(workspace.diocese_id)",
    );

    expect(workspaceLib).not.toContain("localStorage");
    expect(workspaceContext).not.toContain("localStorage");

    expect(authContext).not.toContain("activeDioceseId");
    expect(authContext).not.toContain("switchDiocese");
  });

  it("preserves the existing church switcher as church-only", () => {
    expect(churchSwitcher).toContain(
      "churches: AvailableChurch[]",
    );
    expect(churchSwitcher).toContain(
      "switchChurch: (churchId: string) => Promise<void>",
    );
    expect(churchSwitcher).toContain(
      "await switchChurch(churchId)",
    );

    expect(churchSwitcher).not.toContain("diocese");
    expect(churchSwitcher).not.toContain("Diocese");
  });

  it("shows Diocese choices only from caller-authorized workspace discovery", () => {
    expect(portalLayout).toContain(
      "queryFn: getMyDioceseWorkspaces",
    );
    expect(portalLayout).toContain(
      "dioceseWorkspaces.length > 0",
    );
    expect(portalLayout).toContain(
      "dioceseWorkspaces.map((workspace)",
    );
    expect(portalLayout).toContain(
      "{workspace.diocese_name}",
    );
    expect(portalLayout).toContain(
      'to={`/diocese/${workspace.diocese_id}`}',
    );
  });

  it("keeps Slice 3 routes as workspace shell routes without business data access", () => {
    expect(routes).toContain('path="parishes"');
    expect(routes).toContain('path="announcements"');
    expect(routes).toContain('path="events"');
    expect(routes).toContain('path="reports"');
    expect(routes).toContain('path="more"');

    expect(routes).toContain("DiocesePlaceholderPage");

    const dioceseSources = [
      workspaceLib,
      routeGuard,
      workspaceContext,
      sidebar,
      routes,
    ].join("\n");

    expect(dioceseSources).not.toContain('from("members")');
    expect(dioceseSources).not.toContain('from("contributions")');
    expect(dioceseSources).not.toContain("church_memberships");
    expect(dioceseSources).not.toContain("user_roles");
  });

  it("covers inactive, unrelated, and cross-Diocese denial in SQL security tests", () => {
    expect(sqlSecurityTest).toContain(
      "Diocese workspace discovery security tests PASS",
    );

    expect(sqlSecurityTest).toContain(
      "current_user_can_view_diocese",
    );

    expect(sqlSecurityTest).toContain(
      "is_church_admin",
    );

    expect(sqlSecurityTest).toContain(
      "inactive",
    );
  });
});