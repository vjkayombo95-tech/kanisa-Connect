import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Loader2, CheckCircle2, AlertTriangle, Image as ImageIcon } from "lucide-react";
import {
  validateFile,
  optimizedUpload,
  deleteStorageFile,
  extractPathFromUrl,
  UPLOAD_CONFIGS,
  type UploadProfile,
  type UploadResult,
  formatBytes,
} from "@/lib/file-upload";

interface OptimizedImageUploadProps {
  profile: UploadProfile;
  churchId: string;
  entityId?: string;
  currentUrl?: string | null;
  onUploadComplete: (result: UploadResult) => void;
  onRemove?: () => void;
  /** Optional label override */
  label?: string;
  className?: string;
}

export default function OptimizedImageUpload({
  profile,
  churchId,
  entityId,
  currentUrl,
  onUploadComplete,
  onRemove,
  label,
  className = "",
}: OptimizedImageUploadProps) {
  const cfg = UPLOAD_CONFIGS[profile];
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const displayUrl = preview || currentUrl;
  const isImage = profile !== "import-file";

  const handleSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    setError(null);
    setSuccess(false);

    const validation = validateFile(file, profile);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    // Show preview for images
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }

    // Upload
    setUploading(true);
    setProgress(0);
    try {
      // Delete old file if replacing
      if (currentUrl) {
        const oldPath = extractPathFromUrl(currentUrl, cfg.bucket);
        if (oldPath) await deleteStorageFile(cfg.bucket, oldPath);
      }

      const result = await optimizedUpload(file, profile, churchId, entityId, setProgress);
      setSuccess(true);
      onUploadComplete(result);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }, [profile, churchId, entityId, currentUrl, cfg.bucket, isImage, onUploadComplete]);

  const handleRemove = useCallback(async () => {
    if (currentUrl) {
      const oldPath = extractPathFromUrl(currentUrl, cfg.bucket);
      if (oldPath) await deleteStorageFile(cfg.bucket, oldPath);
    }
    setPreview(null);
    setSuccess(false);
    onRemove?.();
  }, [currentUrl, cfg.bucket, onRemove]);

  const typeLabel = profile === "logo" ? "Logo" : profile === "banner" ? "Banner" : profile === "member-photo" ? "Photo" : "File";

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Preview */}
      {isImage && displayUrl && (
        <div className="relative inline-block">
          <img
            src={displayUrl}
            alt={typeLabel}
            className={`rounded-lg border border-border object-cover ${
              profile === "logo" ? "h-20 w-20" :
              profile === "member-photo" ? "h-24 w-24 rounded-full" :
              "h-32 w-full max-w-md"
            }`}
          />
          {onRemove && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Upload button */}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={cfg.allowedExtensions.map(e => `.${e}`).join(",")}
          className="hidden"
          onChange={handleSelect}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {uploading ? "Uploading..." : label || `Upload ${typeLabel}`}
        </Button>

        {success && !uploading && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
          </span>
        )}
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <Progress value={progress} className="h-1.5 w-full max-w-xs" />
      )}

      {/* Error */}
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}

      {/* Allowed info */}
      <p className="text-xs text-muted-foreground">
        {cfg.allowedExtensions.map(e => e.toUpperCase()).join(", ")} · Max {cfg.maxSizeLabel}
        {isImage && cfg.resizeMaxDim && ` · Auto-optimized for web`}
      </p>
    </div>
  );
}
