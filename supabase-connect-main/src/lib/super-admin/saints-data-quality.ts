import type { AdminSaint } from "@/lib/super-admin/saints-cms-service";

export type SaintQualitySeverity = "error" | "warning";

export type SaintQualityIssue = {
  saintId: string;
  saintName: string;
  severity: SaintQualitySeverity;
  field: string;
  message: string;
};

export type SaintImageValidation = {
  status: "ok" | "missing" | "warning" | "broken";
  message: string;
};

const VALID_TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

function isValidDate(month: number, day: number) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(2026, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day;
}

function pushIssue(issues: SaintQualityIssue[], saint: AdminSaint, field: string, message: string, severity: SaintQualitySeverity = "error") {
  issues.push({ saintId: saint.id, saintName: saint.name, field, message, severity });
}

export function analyzeSaintDataQuality(saints: AdminSaint[]) {
  const issues: SaintQualityIssue[] = [];
  const feastNameMap = new Map<string, AdminSaint[]>();

  saints.forEach((saint) => {
    if (!saint.biography_short?.trim() || !saint.biography_long?.trim()) pushIssue(issues, saint, "biography", "Biography content is missing.");
    if (!saint.prayer?.trim()) pushIssue(issues, saint, "prayer", "Prayer is missing.");
    if (!saint.reflection?.trim()) pushIssue(issues, saint, "reflection", "Reflection is missing.");
    if (!isValidDate(saint.feast_month, saint.feast_day)) pushIssue(issues, saint, "feast_day", "Feast date is invalid.");
    if (!saint.image_url?.trim()) pushIssue(issues, saint, "image_url", "Saint image is missing.", "warning");

    (saint.tags ?? []).forEach((tag) => {
      if (!VALID_TAG_PATTERN.test(tag)) pushIssue(issues, saint, "tags", `Invalid tag format: ${tag}`, "warning");
    });

    const key = `${saint.name.trim().toLowerCase()}|${saint.feast_month}|${saint.feast_day}`;
    feastNameMap.set(key, [...(feastNameMap.get(key) ?? []), saint]);
  });

  feastNameMap.forEach((matchingSaints) => {
    if (matchingSaints.length > 1) {
      matchingSaints.forEach((saint) => pushIssue(issues, saint, "name", "Duplicate name and feast date combination.", "warning"));
    }
  });

  return {
    issues,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
  };
}

export async function validateSaintImage(saint: Pick<AdminSaint, "image_url">): Promise<SaintImageValidation> {
  const imageUrl = saint.image_url?.trim();
  if (!imageUrl) return { status: "missing", message: "No image is assigned. A placeholder will be shown." };

  const lowerUrl = imageUrl.toLowerCase().split("?")[0];
  const hasSupportedExtension = VALID_IMAGE_EXTENSIONS.some((extension) => lowerUrl.endsWith(extension));
  if (!hasSupportedExtension) return { status: "warning", message: "Image URL should use JPG, PNG, WebP, or AVIF." };

  try {
    const response = await fetch(imageUrl, { method: "HEAD" });
    if (!response.ok) return { status: "broken", message: `Image URL returned HTTP ${response.status}.` };

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 2_000_000) return { status: "warning", message: "Image is larger than 2 MB; consider compressing it." };

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.startsWith("image/")) return { status: "broken", message: "URL does not appear to be an image." };

    return { status: "ok", message: "Image URL is reachable and uses a supported format." };
  } catch {
    return { status: "warning", message: "Image URL could not be checked from this browser session." };
  }
}
