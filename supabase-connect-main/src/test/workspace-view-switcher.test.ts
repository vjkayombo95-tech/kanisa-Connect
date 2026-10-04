import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("dual-role workspace view switching", () => {
  const auth = read("src/contexts/AuthContext.tsx");
  const portalLayout = read("src/components/portal/PortalLayout.tsx");
  const adminLayout = read("src/components/church-admin/ChurchAdminLayout.tsx");
  const app = read("src/App.tsx");
  const protectedRoute = read("src/components/auth/ProtectedRoute.tsx");

  it("persists an explicit active view per authenticated user and church", () => {
    expect(auth).toContain('type ActiveWorkspaceView = "member" | "staff"');
    expect(auth).toContain("workspaceViewStorageKey(userId: string, churchId: string | null)");
    expect(auth).toContain('`workspace-view:${userId}:${churchId ?? "no-church"}`');
    expect(auth).toContain("readStoredWorkspaceView(target.id,nextChurch)");
    expect(auth).toContain("writeStoredWorkspaceView(user.id,churchId,nextView)");
  });

  it("offers Member View only from an existing member identity and does not change route guards", () => {
    expect(auth).toContain("member: any | null");
    expect(auth).toContain("nextMember=contextData.member??null");
    expect(auth).toContain('storedView==="member"&&nextMember?"member":"staff"');
    expect(auth).toContain("view===\"member\"&&canUseMemberView");
    expect(app).toContain('<ProtectedRoute requireChurch>');
    expect(app).toContain('<ProtectedRoute requireChurch requireAdmin>');
    expect(protectedRoute).toContain("requireAdmin && !isSuperAdmin && !isAdminRole");
  });

  it("keeps Member View in the member portal and lets staff switch back explicitly", () => {
    expect(portalLayout).toContain('const isAdmin = hasStaffAccess && activeView !== "member"');
    expect(portalLayout).toContain('hasStaffAccess && activeView === "member"');
    expect(portalLayout).toContain('setActiveView("staff")');
    expect(portalLayout).toContain('navigate("/church-admin")');
    expect(portalLayout).toContain('t("workspace_switcher.member_view")');
  });

  it("adds staff profile switch actions without manufacturing member access", () => {
    expect(adminLayout).toContain("member, isSuperAdmin");
    expect(adminLayout).toContain("if (!member) return;");
    expect(adminLayout).toContain('setActiveView("member")');
    expect(adminLayout).toContain('navigate("/portal")');
    expect(adminLayout).toContain('t("workspace_switcher.switch_view")');
  });
});
