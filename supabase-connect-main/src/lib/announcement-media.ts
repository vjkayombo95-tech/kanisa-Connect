export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ANNOUNCEMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateAnnouncementImageFile(file: File) {
  if (!ANNOUNCEMENT_IMAGE_TYPES.includes(file.type as (typeof ANNOUNCEMENT_IMAGE_TYPES)[number])) {
    return "Choose a JPG, PNG or WebP image.";
  }

  if (file.size <= 0 || file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }

  return null;
}

export function getAnnouncementImageUrl(imageKey: string | null | undefined) {
  const key = imageKey?.trim().replace(/^\/+/, "");
  const base = import.meta.env.VITE_MEDIA_BASE_URL?.trim().replace(/\/+$/, "");

  if (!key || !base) return null;

  return `${base}/${key}`;
}
