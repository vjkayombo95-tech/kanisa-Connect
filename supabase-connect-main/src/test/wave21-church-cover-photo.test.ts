import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("Wave 21 church cover photo", () => {
  const page = read(
    "src/pages/church-admin/ChurchDashboard.tsx",
  );

  const dashboard = read(
    "src/components/church-admin/ChurchDashboardExperience.tsx",
  );

  const settings = read(
    "src/pages/church-admin/SettingsPage.tsx",
  );

  it("loads the tenant church banner into the desktop dashboard data flow", () => {
    expect(page).toContain(
      '.select("name, slug, banner_url")',
    );

    expect(page).toContain(
      "bannerUrl: church.data?.banner_url ?? null",
    );

    expect(page).toContain(
      "bannerUrl={data?.bannerUrl ?? null}",
    );
  });

  it("uses the church banner as the workspace briefing background when available", () => {
    expect(dashboard).toContain(
      'backgroundImage: `url("${bannerUrl}")`',
    );

    expect(dashboard).toContain(
      'bannerUrl ? "min-h-[220px] bg-cover bg-center text-white" : "bg-card/85"',
    );

    expect(dashboard).toContain(
      'className="absolute inset-0 bg-black/60"',
    );

    expect(dashboard).toContain(
      'className="relative z-10 flex items-start gap-4"',
    );
  });

  it("preserves readable banner text and the existing no-banner fallback", () => {
    expect(dashboard).toContain(
      'bannerUrl ? "text-white" : "text-foreground"',
    );

    expect(dashboard).toContain(
      'bannerUrl ? "text-white/80" : "text-muted-foreground"',
    );

    expect(dashboard).toContain(
      '"border-primary/20 bg-primary/10 text-primary"',
    );

    expect(dashboard).toContain(
      'bannerUrl ? "text-white/75" : "text-muted-foreground"',
    );
  });

  it("reuses the existing tenant-scoped banner branding flow", () => {
    expect(settings).toContain(
      ".update({ banner_url: result.publicUrl })",
    );

    expect(settings).toContain(
      'profile="banner"',
    );

    expect(settings).toContain(
      'queryKey: ["dashboard-church"]',
    );

    expect(settings).toContain(
      'queryKey: ["church-dashboard-critical", churchId]',
    );
  });

  it("keeps the desktop presentation component free of direct Supabase access", () => {
    expect(dashboard).not.toContain("supabase.");
  });
});
