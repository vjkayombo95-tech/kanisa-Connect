import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const shared = read("src/components/portal/SharedChurchLiveMedia.tsx");
const member = read("src/components/portal/MobileMemberHome.tsx");
const roles = read("src/components/workspace/RoleMobileExperience.tsx");
const community = read("src/components/community-leader/CommunityMobileExperience.tsx");
const liveCard = read("src/components/portal/LiveMassCard.tsx");
const radioCard = read("src/components/portal/RadioLiveCard.tsx");
const radioSelector = read("src/components/portal/RadioStationSelector.tsx");
const player = read("src/contexts/RadioPlayerContext.tsx");
const app = read("src/App.tsx");
const migrations = readdirSync(resolve(process.cwd(), "supabase/migrations"));
const retiredMigration = read("docs/retired-migrations/20260810160000_share_live_media_view_permissions.sql");

describe("shared church live media", () => {
  it("places one shared mobile surface on member, staff, and community homes", () => {
    expect(shared).toContain("<LiveMassCard");
    expect(shared).toContain("<RadioLiveCard playInline />");
    expect(member).toContain("<SharedChurchLiveMedia churchName={home.churchName} />");
    expect(roles).toContain('workspace.id !== "super_admin"');
    expect(roles.indexOf("<SharedChurchLiveMedia")).toBeLessThan(roles.indexOf('aria-labelledby="role-mobile-actions"'));
    expect(community).toContain("{liveMedia}<section>");
  });

  it("keeps YouTube internal, radio gesture-driven, and the player single-instance", () => {
    expect(liveCard).toContain('viewerBasePath = "/portal/live"');
    expect(shared).toContain('viewerBasePath="/church-live"');
    expect(app).toContain('path="/church-live/:streamId"');
    expect(radioCard).toContain("<RadioStationSelector stations={stations}");
    expect(radioSelector).toContain("onClick={() => void player.play(station)}");
    expect(radioCard).not.toContain("autoPlay");
    expect(player.match(/<RadioMiniPlayer value=\{value\}/g)).toHaveLength(1);
  });

  it("does not execute the rejected universal staff Live Media grants", () => {
    expect(migrations).not.toContain("20260810160000_share_live_media_view_permissions.sql");
    expect(retiredMigration).toContain("pf.key in ('livestream', 'radio')");
    expect(shared).not.toMatch(/pastor|secretary|treasurer|can_view/);
  });

  it("continues to fail closed through authoritative church-scoped hooks", () => {
    expect(shared).not.toMatch(/churchId\s*[:=]/);
    expect(liveCard).toContain("stream.churchId !== churchId");
    expect(radioCard).toContain("useChurchRadioStations()");
  });
});
