import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync("src/routes/MemberRoutes.tsx", "utf8");
const radio = readFileSync("src/pages/portal/MemberRadioPage.tsx", "utf8");

describe("persistent livestream route safety", () => {
  it("preserves stream-ID and radio routes", () => {
    expect(routes).toContain('path="live/:streamId"');
    expect(routes).toContain('path="radio"');
    expect(routes).toContain("MemberLivestreamPage");
    expect(routes).toContain("MemberRadioPage");
  });

  it("does not couple radio playback to livestream state", () => {
    expect(radio).toContain("useRadioPlayer");
    expect(radio).not.toContain("PersistentLivestream");
  });
});
