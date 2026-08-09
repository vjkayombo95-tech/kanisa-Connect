import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const app = source("src/App.tsx");
const banner = source("src/components/StagingBanner.tsx");
const workspace = source("src/components/workspace/framework.tsx");
const community = source("src/components/community-leader/CommunityLeaderLayout.tsx");

describe("staging banner layout safety", () => {
  it("keeps the staging warning fixed, visible, safe-area aware, and pointer transparent", () => {
    expect(banner).toContain("STAGING — TEST DATA ONLY");
    expect(banner).toContain("fixed inset-x-0 top-0 z-[100]");
    expect(banner).toContain("h-[var(--staging-banner-height)]");
    expect(banner).toContain("pt-[env(safe-area-inset-top,0px)]");
    expect(banner).toContain("pointer-events-none");
  });

  it("reserves the banner height in the application shell", () => {
    expect(app).toContain("pt-[var(--staging-banner-height)]");
    expect(app).toContain("[--staging-banner-height:calc(2rem+env(safe-area-inset-top,0px))]");
  });

  it("keeps workspace and community headers below the reserved banner", () => {
    expect(workspace).toContain("sticky top-[var(--staging-banner-height,0px)] z-40");
    expect(community).toContain("sticky top-[var(--staging-banner-height,0px)] z-10");
  });

  it("offsets the portaled mobile sheet without changing its navigation ARIA", () => {
    expect(workspace).toContain("top-[calc(2rem+env(safe-area-inset-top,0px))]");
    expect(workspace).toContain("h-[calc(100%_-_2rem_-_env(safe-area-inset-top,0px))]");
    expect(workspace).toContain('aria-label="Open workspace navigation"');
    expect(workspace).toContain('aria-label={t("account.open_menu")}');
  });

  it("places the keyboard skip link below the banner", () => {
    expect(workspace).toContain("focus:top-[calc(var(--staging-banner-height,0px)+1rem)]");
  });
});
