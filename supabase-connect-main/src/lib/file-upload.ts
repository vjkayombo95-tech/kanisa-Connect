import { supabase } from "@/integrations/supabase/client";

// ── Upload profile configs ──────────────────────────────────────────
export type UploadProfile = "logo" | "banner" | "member-photo" | "import-file" | "channel-attachment";

interface UploadConfig {
  allowedTypes: string[];
  allowedExtensions: string[];
  maxSizeBytes: number;
  maxSizeLabel: string;
  /** Target max dimension (width or height) for resize. Null = no resize */
  resizeMaxDim: number | null;
  /** JPEG/WebP quality 0-1 */
  quality: number;
  storagePath: (churchId: string, entityId?: string) => string;
  bucket: string;
}

export const UPLOAD_CONFIGS: Record<UploadProfile, UploadConfig> = {
  logo: {
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "svg"],
    maxSizeBytes: 500 * 1024,
    maxSizeLabel: "500KB",
    resizeMaxDim: 512,
    quality: 0.85,
    storagePath: (churchId) => `${churchId}/logos/logo`,
    bucket: "church-assets",
  },
  banner: {
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: ["jpg", "jpeg", "png", "webp"],
    maxSizeBytes: 2 * 1024 * 1024,
    maxSizeLabel: "2MB",
    resizeMaxDim: 1920,
    quality: 0.82,
    storagePath: (churchId) => `${churchId}/banners/banner`,
    bucket: "church-assets",
  },
  "member-photo": {
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: ["jpg", "jpeg", "png", "webp"],
    maxSizeBytes: 500 * 1024,
    maxSizeLabel: "500KB",
    resizeMaxDim: 400,
    quality: 0.82,
    storagePath: (churchId, entityId) => `${churchId}/members/${entityId || "unknown"}`,
    bucket: "church-assets",
  },
  "import-file": {
    allowedTypes: [
      "text/csv",
    ],
    allowedExtensions: ["csv"],
    maxSizeBytes: 5 * 1024 * 1024,
    maxSizeLabel: "5MB",
    resizeMaxDim: null,
    quality: 1,
    storagePath: (churchId) => `${churchId}/imports/${Date.now()}`,
    bucket: "church-assets",
  },
  "channel-attachment": {
    allowedTypes: ["application/pdf"],
    allowedExtensions: ["pdf"],
    maxSizeBytes: 10 * 1024 * 1024,
    maxSizeLabel: "10MB",
    resizeMaxDim: null,
    quality: 1,
    storagePath: (churchId, entityId) => `${churchId}/channels/${entityId || Date.now()}`,
    bucket: "church-assets",
  },
};

// ── Validation ──────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File, profile: UploadProfile): ValidationResult {
  const cfg = UPLOAD_CONFIGS[profile];
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (!cfg.allowedExtensions.includes(ext)) {
    return { valid: false, error: `Invalid file type. Allowed: ${cfg.allowedExtensions.join(", ").toUpperCase()}` };
  }
  // Also check MIME for images (browsers may not set MIME correctly for all types)
  if (profile !== "import-file" && !cfg.allowedTypes.includes(file.type) && file.type !== "") {
    return { valid: false, error: `Invalid file type. Allowed: ${cfg.allowedExtensions.join(", ").toUpperCase()}` };
  }
  if (file.size > cfg.maxSizeBytes) {
    return { valid: false, error: `File too large (${formatBytes(file.size)}). Maximum: ${cfg.maxSizeLabel}` };
  }
  return { valid: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Client-side image optimization ──────────────────────────────────
export function optimizeImage(
  file: File,
  profile: UploadProfile
): Promise<{ blob: Blob; width: number; height: number }> {
  const cfg = UPLOAD_CONFIGS[profile];

  // SVGs don't need resize
  if (file.type === "image/svg+xml" || !cfg.resizeMaxDim) {
    return Promise.resolve({ blob: file, width: 0, height: 0 });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const max = cfg.resizeMaxDim!;

      // Only downscale, never upscale
      if (width > max || height > max) {
        const ratio = Math.min(max / width, max / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Output as WebP if supported, else JPEG
      const outputType = "image/webp";
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          resolve({ blob, width, height });
        },
        outputType,
        cfg.quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

// ── Upload to Supabase Storage ──────────────────────────────────────
export interface UploadResult {
  publicUrl: string;
  path: string;
}

export async function uploadFile(
  file: File | Blob,
  profile: UploadProfile,
  churchId: string,
  entityId?: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const cfg = UPLOAD_CONFIGS[profile];
  const ext = profile === "import-file" || profile === "channel-attachment"
    ? ((file as File).name?.split(".").pop()?.toLowerCase() || (profile === "import-file" ? "csv" : "pdf"))
    : "webp"; // optimized images are always webp

  // For SVGs keep original extension
  const finalExt = (file as File).type === "image/svg+xml" ? "svg" : ext;
  const basePath = cfg.storagePath(churchId, entityId);
  const fullPath = `${basePath}.${finalExt}`;

  // Simulate progress for UX (Supabase JS doesn't expose real upload progress)
  let progressInterval: ReturnType<typeof setInterval> | undefined;
  if (onProgress) {
    let pct = 0;
    progressInterval = setInterval(() => {
      pct = Math.min(pct + Math.random() * 15, 90);
      onProgress(Math.round(pct));
    }, 200);
  }

  try {
    const { error } = await supabase.storage
      .from(cfg.bucket)
      .upload(fullPath, file, { upsert: true, contentType: file.type || undefined });
    if (error) throw error;

    if (onProgress) onProgress(100);

    const { data } = supabase.storage.from(cfg.bucket).getPublicUrl(fullPath);
    return { publicUrl: data.publicUrl + "?t=" + Date.now(), path: fullPath };
  } finally {
    if (progressInterval) clearInterval(progressInterval);
  }
}

// ── Delete old file from storage ────────────────────────────────────
export async function deleteStorageFile(bucket: string, path: string): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // Silently ignore – old file may already be gone
  }
}

/** Extract storage path from a full public URL */
export function extractPathFromUrl(publicUrl: string | null, bucket: string): string | null {
  if (!publicUrl) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  let path = publicUrl.substring(idx + marker.length);
  // Strip cache-buster query
  const qIdx = path.indexOf("?");
  if (qIdx !== -1) path = path.substring(0, qIdx);
  return path;
}

// ── Full optimized upload pipeline ──────────────────────────────────
export async function optimizedUpload(
  file: File,
  profile: UploadProfile,
  churchId: string,
  entityId?: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const isImage = profile !== "import-file" && file.type !== "image/svg+xml";

  if (isImage) {
    const { blob } = await optimizeImage(file, profile);
    return uploadFile(blob, profile, churchId, entityId, onProgress);
  }

  return uploadFile(file, profile, churchId, entityId, onProgress);
}
