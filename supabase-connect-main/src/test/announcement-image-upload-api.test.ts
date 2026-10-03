import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "api/announcement-image-upload.js"), "utf8");

describe("announcement image upload API", () => {
  it("only signs supported image formats", () => {
    expect(source).toContain('["image/jpeg", "jpg"]');
    expect(source).toContain('["image/png", "png"]');
    expect(source).toContain('["image/webp", "webp"]');
    expect(source).toContain("Only JPG, PNG and WebP images are allowed.");
  });

  it("rejects files larger than 5 MB before signing", () => {
    expect(source).toContain("const MAX_IMAGE_SIZE = 5 * 1024 * 1024");
    expect(source).toContain("fileSize > MAX_IMAGE_SIZE");
    expect(source).toContain("Image must be 5 MB or smaller.");
  });

  it("uses authenticated permission checks and stores only a generated key", () => {
    expect(source).toContain('authorization.startsWith("Bearer ")');
    expect(source).toContain("supabase.auth.getUser(accessToken)");
    expect(source).toContain('"can_manage_church_roles"');
    expect(source).toContain("`announcements/${churchId}/${randomUUID()}.${extension}`");
    expect(source).toContain("imageKey");
    expect(source).not.toContain("service_role");
  });

  it("uses the Cloudflare R2 EU jurisdiction endpoint", () => {
    expect(source).toContain("https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com");
  });
});
