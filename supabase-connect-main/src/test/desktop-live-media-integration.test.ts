import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const framework = read("src/components/workspace/framework.tsx");
const community = read("src/components/community-leader/CommunityLeaderLayout.tsx");
const desktop = read("src/components/portal/DesktopLiveMediaAwareness.tsx");
const mobile = read("src/components/portal/SharedChurchLiveMedia.tsx");
const radio = read("src/lib/church-radio.ts");
const registry = read("src/components/workspace/registry.ts");

describe("desktop live-media workspace integration", () => {
  it("integrates once in shared role headers and explicitly excludes Super Admin", () => {
    expect(framework).toContain('<DesktopLiveMediaAwareness disabled={workspace.id === "super_admin"} />');
    expect(community).toContain("<DesktopLiveMediaAwareness />");
    expect((framework.match(/<DesktopLiveMediaAwareness/g) ?? [])).toHaveLength(1);
    for (const roles of ['roles: ["member"]', 'roles: ["pastor", "priest"]', 'roles: ["church_admin", "pastor", "secretary"]', 'roles: ["treasurer", "finance", "church_admin"]']) expect(registry).toContain(roles);
  });

  it("is desktop-only and leaves the existing mobile shared surface unchanged", () => {
    expect(desktop).toContain("hidden min-h-9");
    expect(desktop).toContain("lg:inline-flex");
    expect(desktop).toContain("lg:block");
    expect(mobile).toContain('<LiveMassCard churchName={churchName} viewerBasePath="/church-live" />');
    expect(mobile).toContain("<RadioLiveCard playInline />");
  });

  it("uses authoritative hooks without technical Radio metadata", () => {
    expect(desktop).toContain("useChurchLivestream()");
    expect(desktop).toContain("useChurchRadioStations()");
    expect(desktop).toContain("item.churchId === radio.churchId");
    expect(desktop).not.toContain("metadataUrl");
    expect(radio).toContain('const platformColumns = "id,name,stream_url,website_url,logo_url,description,provider,stream_format,is_active,is_approved,health_status,last_health_checked_at"');
  });
});
