import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/portal/PortalAnnouncements.tsx"), "utf8");

describe("member announcement visibility", () => {
  it("uses cached announcements only as placeholders and always refreshes on mount", () => {
    expect(source).toContain("placeholderData:");
    expect(source).toContain('refetchOnMount: "always"');
    expect(source).not.toContain("initialData:");
  });

  it("refreshes member announcements when parish announcement rows change", () => {
    expect(source).toContain('table: "announcements"');
    expect(source).toContain("filter: `church_id=eq.${churchId}`");
    expect(source).toContain('queryKey: ["portal-announcements-all", user?.id, churchId]');
    expect(source).toContain("supabase.removeChannel(channel)");
  });
});
