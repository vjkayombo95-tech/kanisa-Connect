import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Diocese parishes Slice 4 contract", () => {
  const migration = read(
    "supabase/migrations/20261010120000_diocese_parish_directory.sql",
  );
  const securityTest = read(
    "supabase/tests/diocese_parish_directory_security.sql",
  );
  const service = read("src/lib/diocese-workspace.ts");
  const page = read("src/pages/diocese/DioceseParishesPage.tsx");
  const routes = read("src/routes/DioceseRoutes.tsx");
  const sw = read("src/locales/sw.json");
  const en = read("src/locales/en.json");

  it("exposes a caller-authorized read-only Diocese parish directory RPC", () => {
    expect(migration).toContain("get_diocese_parishes");
    expect(migration).toContain("current_user_can_view_diocese(_diocese_id)");
    expect(migration).toContain("dc.status = 'active'");
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "grant execute on function public.get_diocese_parishes(uuid)",
    );
  });

  it("returns only narrow parish directory fields", () => {
    const forbidden = [
      "owner_id",
      "created_by",
      "member_id",
      "contribution",
      "church_memberships",
      "user_roles",
      "community_id",
    ];

    for (const value of forbidden) {
      expect(migration).not.toContain(value);
    }

    expect(migration).toContain("church_id uuid");
    expect(migration).toContain("church_name text");
    expect(migration).toContain("church_code text");
    expect(migration).toContain("church_address text");
    expect(migration).toContain("church_email text");
    expect(migration).toContain("church_phone text");
    expect(migration).toContain("church_logo_url text");
  });

  it("keeps Diocese authority separate from church administration", () => {
    expect(securityTest).toContain("is_church_admin");
    expect(securityTest).toMatch(
      /if\s+public\.is_church_admin\(v_user_a,\s*v_church_a\)\s+then[\s\S]*Diocese staff unexpectedly gained church admin authority/i,
    );

    expect(page).not.toContain("switchChurch");
    expect(page).not.toContain("activeChurchId");
    expect(page).not.toContain("/church-admin");
    expect(page).not.toContain("church_memberships");
    expect(page).not.toContain("user_roles");
    expect(page).not.toContain("contributions");
  });

  it("tests cross-Diocese denial, inactive access, and RPC privileges", () => {
    expect(securityTest).toContain(
      "Diocese parish directory security contract passed.",
    );
    expect(securityTest).toContain("is_diocese_staff");
    expect(securityTest).toContain("get_diocese_parishes");
    expect(securityTest).toMatch(/inactive/i);
    expect(securityTest).toMatch(/anon/i);
  });

  it("loads parishes using the authorized Diocese workspace id", () => {
    expect(page).toContain("useDioceseWorkspace");
    expect(page).toContain(
      'queryKey: ["diocese-parishes", workspace.diocese_id]',
    );
    expect(page).toContain("getDioceseParishes(workspace.diocese_id)");
    expect(service).toContain('"get_diocese_parishes"');
    expect(service).toContain("_diocese_id: dioceseId");
  });

  it("routes the Diocese parishes path to the real Slice 4 page", () => {
    expect(routes).toContain(
      'import { DioceseParishesPage } from "@/pages/diocese/DioceseParishesPage";',
    );
    expect(routes).toMatch(
      /path="parishes"[\s\S]*element=\{<DioceseParishesPage\s*\/>\}/,
    );
  });

  it("provides localized parish directory states in Swahili and English", () => {
    const swLocale = JSON.parse(sw);
    const enLocale = JSON.parse(en);

    const swParishes = swLocale.diocese_workspace.pages.parishes;
    const enParishes = enLocale.diocese_workspace.pages.parishes;

    expect(swParishes.title).toBe("Parokia");
    expect(swParishes.search_label).toBeTruthy();
    expect(swParishes.loading).toBeTruthy();
    expect(swParishes.error.title).toBeTruthy();
    expect(swParishes.empty.title).toBeTruthy();

    expect(enParishes.title).toBe("Parishes");
    expect(enParishes.search_label).toBeTruthy();
    expect(enParishes.loading).toBeTruthy();
    expect(enParishes.error.title).toBeTruthy();
    expect(enParishes.empty.title).toBeTruthy();
  });
});
