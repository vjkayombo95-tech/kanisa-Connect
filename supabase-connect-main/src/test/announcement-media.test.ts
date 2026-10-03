import { describe, expect, it, vi } from "vitest";
import {
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  getAnnouncementImageUrl,
  validateAnnouncementImageFile,
} from "@/lib/announcement-media";

function makeFile(type: string, size: number) {
  return { type, size } as File;
}

describe("announcement media helpers", () => {
  it("rejects unsupported image types", () => {
    expect(validateAnnouncementImageFile(makeFile("image/gif", 12))).toBe("Choose a JPG, PNG or WebP image.");
  });

  it("rejects images larger than 5 MB", () => {
    expect(validateAnnouncementImageFile(makeFile("image/png", ANNOUNCEMENT_IMAGE_MAX_BYTES + 1))).toBe(
      "Image must be 5 MB or smaller.",
    );
  });

  it("allows supported announcement images within the size limit", () => {
    expect(validateAnnouncementImageFile(makeFile("image/webp", ANNOUNCEMENT_IMAGE_MAX_BYTES))).toBeNull();
  });

  it("builds public media URLs while normalizing slashes", () => {
    vi.stubEnv("VITE_MEDIA_BASE_URL", "https://media.example.test/");

    expect(getAnnouncementImageUrl("/announcements/church-a/photo.webp")).toBe(
      "https://media.example.test/announcements/church-a/photo.webp",
    );

    vi.unstubAllEnvs();
  });

  it("fails gracefully when the public media base URL is missing", () => {
    vi.stubEnv("VITE_MEDIA_BASE_URL", "");

    expect(getAnnouncementImageUrl("announcements/church-a/photo.webp")).toBeNull();

    vi.unstubAllEnvs();
  });
});
