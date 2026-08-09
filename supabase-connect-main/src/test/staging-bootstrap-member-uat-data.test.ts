import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bootstrapSource = readFileSync(path.resolve("scripts/bootstrap-staging.ts"), "utf8");

describe("staging bootstrap Member UAT data", () => {
  it("keeps server-side staging safety checks in place", () => {
    expect(bootstrapSource).toContain('APP_ENV !== "staging"');
    expect(bootstrapSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(bootstrapSource).toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
    expect(bootstrapSource).toContain("--dry-run");
    expect(bootstrapSource).toContain("--reset");
  });

  it("seeds the Member UAT surfaces missing from the original bootstrap", () => {
    expect(bootstrapSource).toContain("seedCmsPrayer");
    expect(bootstrapSource).toContain("seedCmsDailyReadings");
    expect(bootstrapSource).toContain("seedCommunityAndMinistry");
    expect(bootstrapSource).toContain("seedPledge");
    expect(bootstrapSource).toContain("seedChannelAndMessage");
    expect(bootstrapSource).toContain("seedPortalPrayerRequest");
    expect(bootstrapSource).toContain("seedMemberMassIntention");
  });

  it("uses stable bootstrap-owned identifiers for rerun and reset safety", () => {
    expect(bootstrapSource).toContain("SEEDED_CMS_PRAYER_SLUG");
    expect(bootstrapSource).toContain("SEEDED_CMS_DAILY_READING_CELEBRATIONS");
    expect(bootstrapSource).toContain("SEEDED_COMMUNITY_NAME");
    expect(bootstrapSource).toContain("SEEDED_MINISTRY_NAME");
    expect(bootstrapSource).toContain("SEEDED_CHANNEL_NAME");
    expect(bootstrapSource).toContain("SEEDED_PRAYER_REQUEST_TEXT");
    expect(bootstrapSource).toContain("SEEDED_MASS_INTENTION_MESSAGE");
    expect(bootstrapSource).toContain("resetSeedData");
  });
});
