import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildChurchGivingUrl, buildChurchQRPayload } from "@/lib/qr-payments";
import {
  buildAnnouncementShareMessage,
  buildCommunityInviteMessage,
  buildContributionShareMessage,
  buildEventShareMessage,
} from "@/lib/whatsapp-share";

const root = process.cwd();

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stale host cleanup", () => {
  it("builds giving URLs from the browser origin", () => {
    vi.stubGlobal("window", { location: { origin: "https://current.example" } });

    expect(buildChurchGivingUrl("church-a", "st-joseph")).toBe("https://current.example/give/st-joseph");
    expect(buildChurchQRPayload("church-a", "st-joseph")).toBe("https://current.example/give/st-joseph");
  });

  it("supports explicit origins and normalizes giving URL paths", () => {
    expect(buildChurchGivingUrl("church a", null, "https://configured.example/")).toBe(
      "https://configured.example/give/church%20a",
    );
    expect(buildChurchGivingUrl("church-a", "st joseph", "https://configured.example")).toBe(
      "https://configured.example/give/st%20joseph",
    );
  });

  it("fails clearly outside the browser when no origin is provided", () => {
    vi.stubGlobal("window", undefined);

    expect(() => buildChurchGivingUrl("church-a", "st-joseph")).toThrow(
      "Application origin is required to build a church giving URL outside the browser.",
    );
  });

  it("uses browser origin for generic WhatsApp app links", () => {
    vi.stubGlobal("window", { location: { origin: "https://current.example" } });

    expect(buildCommunityInviteMessage({ communityName: "Youth" })).toContain("https://current.example/portal");
    expect(buildAnnouncementShareMessage({ title: "Mass", body: "Karibu" })).toContain(
      "https://current.example/portal/announcements",
    );
    expect(buildEventShareMessage({ title: "Retreat" })).toContain("https://current.example/portal/events");
  });

  it("does not manufacture generic app links outside the browser", () => {
    vi.stubGlobal("window", undefined);

    expect(buildCommunityInviteMessage({ communityName: "Youth" })).not.toContain("https://");
    expect(buildAnnouncementShareMessage({ title: "Mass", body: "Karibu" })).not.toContain("https://");
    expect(buildEventShareMessage({ title: "Retreat" })).not.toContain("https://");
  });

  it("keeps explicit WhatsApp/giving links intact", () => {
    vi.stubGlobal("window", undefined);

    expect(
      buildCommunityInviteMessage({
        communityName: "Youth",
        inviteLink: "https://configured.example/portal/community",
      }),
    ).toContain("https://configured.example/portal/community");
    expect(
      buildContributionShareMessage({
        churchName: "St Joseph",
        givingLink: "https://configured.example/give/st-joseph",
      }),
    ).toContain("https://configured.example/give/st-joseph");
  });

  it("removes the stale production host from active source and tests", () => {
    const staleHost = ["kanisaniconnect", "netlify", "app"].join(".");
    const activeFiles = [
      "src/lib/qr-payments.ts",
      "src/lib/whatsapp-share.ts",
      "src/test/wave16-qr-recovery.test.ts",
      "src/test/stale-host-cleanup.test.ts",
    ];

    for (const file of activeFiles) {
      expect(read(file), file).not.toContain(staleHost);
    }
  });
});
