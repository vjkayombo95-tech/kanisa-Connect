import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import XLSX from "xlsx";

import { PRAYER_WORKBOOK_HEADERS } from "../../scripts/prayer-library/prayer-import-core";
import { parsePrayerWorkbook } from "@/lib/super-admin/prayer-import-service";

const routes = readFileSync(resolve(process.cwd(), "src/routes/SuperAdminRoutes.tsx"), "utf8");
const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/pages/super-admin/SuperAdminPrayerImportPage.tsx"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260718170000_add_staging_prayer_import_rpc.sql"), "utf8");
const actorMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260718180000_add_prayer_import_initiator_audit.sql"), "utf8");
const edgeFunction = readFileSync(resolve(process.cwd(), "supabase/functions/prayer-import/index.ts"), "utf8");
const service = readFileSync(resolve(process.cwd(), "src/lib/super-admin/prayer-import-service.ts"), "utf8");

function workbookFile(sheetName = "Prayers", headers: readonly string[] = PRAYER_WORKBOOK_HEADERS) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, headers.map((header) => header === "Prayer Code" ? "TEST" : header === "Status" ? "draft" : "x")]), sheetName);
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { name: "test.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes } as File;
}

describe("Super Admin Prayer importer", () => {
  it("is routed only inside the Super Admin protected workspace", () => {
    expect(routes).toContain('catholic-content/prayer-library/import');
    expect(app).toContain("<ProtectedRoute requireSuperAdmin>");
    expect(page).toContain("if (!isSuperAdmin)");
  });

  it("rejects unsupported files", async () => {
    await expect(parsePrayerWorkbook({ name: "test.csv", size: 1, arrayBuffer: async () => new ArrayBuffer(1) } as File)).rejects.toThrow(/Only .xlsx/);
  });

  it("rejects a missing Prayers sheet", async () => {
    await expect(parsePrayerWorkbook(workbookFile("Other"))).rejects.toThrow(/Prayers/);
  });

  it("rejects missing required workbook columns", async () => {
    await expect(parsePrayerWorkbook(workbookFile("Prayers", ["Prayer Code", "Title"]))).rejects.toThrow(/missing required headers/i);
  });

  it("uses a server-side transactional staging and Super Admin boundary", () => {
    expect(migration).toContain("public.is_platform_super_admin(auth.uid())");
    expect(migration).toContain("nunfrjcuimaytydnaqtt.supabase.co/auth/v1");
    expect(migration).toContain("status = 'draft'");
    expect(migration).toContain("featured = false");
    expect(migration).toContain("Concurrent edit or missing prayer");
    expect(migration).toContain("revoke all on function");
  });

  it("requires dry-run and exact confirmation before enabling import", () => {
    expect(page).toContain("canImport");
    expect(page).toContain("PRAYER_IMPORT_CONFIRMATION");
    expect(page).toContain("Validate and run dry-run");
  });

  it("derives browser identity server-side and executes through the service role", () => {
    expect(service).toContain('supabase.functions.invoke("prayer-import"');
    expect(service).not.toContain('_initiated_by_user_uuid:');
    expect(edgeFunction).toContain("callerClient.auth.getUser()");
    expect(edgeFunction).toContain("forbiddenIdentityKeys");
    expect(edgeFunction).toContain("_initiated_by_user_uuid: authData.user.id");
    expect(edgeFunction).toContain('executedBy: "service_role"');
    expect(edgeFunction).toContain('payload.mode === "preflight"');
    expect(edgeFunction).toContain("importsExecuted: 0");
  });

  it("keeps actor-aware database execution service-role-only and staging-locked", () => {
    expect(actorMigration).toContain("initiated_by_user_uuid uuid references auth.users(id)");
    expect(actorMigration).toContain("initiated_by_email text");
    expect(actorMigration).toContain("initiated_by_display_name text");
    expect(actorMigration).toContain("executed_by text");
    expect(actorMigration).toContain("coalesce(auth.role(), '') <> 'service_role'");
    expect(actorMigration).toContain("nunfrjcuimaytydnaqtt.supabase.co");
    expect(actorMigration).toContain("revoke execute on function public.apply_staging_prayer_import(text, text, jsonb, text) from authenticated");
  });

  it("renders the required actor-aware import history columns", () => {
    for (const heading of ["Batch ID", "Initiated By", "Executed By", "Environment", "Workbook", "Checksum", "Updated", "Skipped", "Failed", "Status", "Date"]) {
      expect(page).toContain(`<TableHead>${heading}</TableHead>`);
    }
  });
});
