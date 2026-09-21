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

  const mobileDashboard = read(
    "src/components/church-admin/ChurchDashboardMobileExperience.tsx",
  );

  const settings = read(
    "src/pages/church-admin/SettingsPage.tsx",
  );

  const memberDashboard = read(
    "src/components/portal/MemberDashboard.tsx",
  );

  const memberMobileHome = read(
    "src/components/portal/MobileMemberHome.tsx",
  );

  const migration = read(
    "supabase/migrations/20260920130000_add_church_banner_position.sql",
  );

  it("loads the tenant church banner into the desktop dashboard data flow", () => {
    expect(page).toContain(
      '.select("name, slug, banner_url, banner_position_y")',
    );

    expect(page).toContain(
      "bannerUrl: church.data?.banner_url ?? null",
    );

    expect(page).toContain(
      "bannerPositionY: church.data?.banner_position_y ?? 38",
    );

    expect(page).toContain(
      "bannerUrl={data?.bannerUrl ?? null}",
    );

    expect(page).toContain(
      "bannerPositionY={data?.bannerPositionY ?? 38}",
    );
  });

  it("passes the existing tenant church banner into the staff mobile dashboard", () => {
    expect(page).toContain(
      "bannerUrl={data?.bannerUrl ?? null}",
    );
    expect(page).toContain(
      "bannerPositionY={data?.bannerPositionY ?? 38}",
    );
  });

  it("uses the church banner as the workspace briefing background when available", () => {
    expect(dashboard).toContain(
      'backgroundImage: `url("${bannerUrl}")`',
    );

    expect(dashboard).toContain(
      'bannerUrl ? "min-h-[250px] bg-cover text-white sm:min-h-[260px]" : "bg-card/85"',
    );

    expect(dashboard).toContain(
      'className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15"',
    );

    expect(dashboard).toContain(
      'className="relative z-10 flex items-start gap-4"',
    );
  });

  it("keeps the banner presentation taller, covered, and composed for church photos", () => {
    expect(dashboard).toContain("min-h-[250px]");
    expect(dashboard).toContain("sm:min-h-[260px]");
    expect(dashboard).toContain("bg-cover");
    expect(dashboard).toContain('backgroundPosition: `center ${bannerPositionY}%`');
    expect(dashboard).not.toContain("bg-[center_38%]");
    expect(dashboard).not.toContain("bg-contain");
  });

  it("uses a directional overlay only for the banner state", () => {
    expect(dashboard).toContain("bg-gradient-to-r");
    expect(dashboard).toContain("from-black/75");
    expect(dashboard).toContain("via-black/45");
    expect(dashboard).toContain("to-black/15");
    expect(dashboard).toContain("{bannerUrl ? <div");
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

    expect(dashboard).toContain(
      ': "bg-card/85"',
    );
  });

  it("preserves the existing greeting, role badge, and church name content", () => {
    expect(dashboard).toContain("{greeting}, {firstName}.");
    expect(dashboard).toContain("{workspaceLabel}");
    expect(dashboard).toContain("{churchName}");
    expect(dashboard).toContain('userRole === "church_admin"');
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

  it("supports tenant-scoped cover photo positioning with a safe persisted range", () => {
    expect(migration).toContain(
      "ADD COLUMN banner_position_y integer NOT NULL DEFAULT 38",
    );
    expect(migration).toContain(
      "CHECK (banner_position_y BETWEEN 0 AND 100)",
    );

    expect(settings).toContain(
      "setBannerPositionY(church.banner_position_y ?? 38)",
    );
    expect(settings).toContain(
      ".update({ banner_position_y: position })",
    );
    expect(settings).toContain(
      'backgroundPosition: `center ${bannerPositionY}%`',
    );
    expect(settings).toContain(
      "onValueChange={([value]) => setBannerPositionY(value)}",
    );
    expect(settings).toContain(
      "onClick={() => saveBannerPosition.mutate()}",
    );
    expect(settings).toContain("Save position");
  });
  it("keeps the desktop presentation component free of direct Supabase access", () => {
    expect(dashboard).not.toContain("supabase.");
  });

  it("uses the church banner on the staff mobile workspace briefing without another query", () => {
    expect(mobileDashboard).toContain(
      'style={bannerUrl ? { backgroundImage: `url("${bannerUrl}")`, backgroundPosition: `center ${coverPositionY}%` } : undefined}',
    );
    expect(mobileDashboard).toContain(
      'bannerUrl ? "bg-cover text-white" : "bg-card/85"',
    );
    expect(mobileDashboard).toContain(
      "Math.max(0, Math.min(100, Math.round(bannerPositionY)))",
    );
    expect(mobileDashboard).toContain(
      'className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25"',
    );
    expect(mobileDashboard).toContain("Today&apos;s Focus");
    expect(mobileDashboard).toContain("Today&apos;s Priorities");
    expect(mobileDashboard).toContain("Quick Actions");
    expect(mobileDashboard).not.toContain("supabase.");
    expect(mobileDashboard).not.toContain("useQuery(");
  });

  it("loads and passes the tenant church banner into the member mobile home", () => {
    expect(memberDashboard).toContain(
      '.select("name, banner_url, banner_position_y")',
    );
    expect(memberDashboard).toContain(
      "churchBannerUrl: churchResult.error ? null : churchResult.data?.banner_url ?? null",
    );
    expect(memberDashboard).toContain(
      "churchBannerPositionY: churchResult.error ? 38 : churchResult.data?.banner_position_y ?? 38",
    );
    expect(memberDashboard).toContain(
      "churchBannerUrl={home.churchBannerUrl}",
    );
    expect(memberDashboard).toContain(
      "churchBannerPositionY={home.churchBannerPositionY}",
    );
  });

  it("shows the church cover photo on the member mobile home when available", () => {
    expect(memberMobileHome).toContain(
      'style={churchBannerUrl ? { backgroundImage: `url("${churchBannerUrl}")`, backgroundPosition: `center ${coverPositionY}%` } : undefined}',
    );
    expect(memberMobileHome).toContain(
      '? "min-h-44 bg-cover text-white"',
    );
    expect(memberMobileHome).toContain(
      'className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20"',
    );
    expect(memberMobileHome).toContain(
      ': "bg-[linear-gradient(135deg,hsl(var(--primary)/0.13),hsl(var(--card))_65%)]"',
    );
  });
});
