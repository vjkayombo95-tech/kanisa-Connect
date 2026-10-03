import {
  isRichTextEmpty,
  normalizeAnnouncementContent,
  sanitizeAnnouncementHtml,
} from "@/lib/announcement-content";

export const ANNOUNCEMENT_DOCX_MAX_BYTES = 10 * 1024 * 1024;

export type AnnouncementDocxImportErrorCode =
  | "unsupported_type"
  | "too_large"
  | "empty_document"
  | "unreadable"
  | "failed";

export class AnnouncementDocxImportError extends Error {
  code: AnnouncementDocxImportErrorCode;

  constructor(code: AnnouncementDocxImportErrorCode) {
    super(code);
    this.name = "AnnouncementDocxImportError";
    this.code = code;
  }
}

export type AnnouncementDocxImportResult = {
  content: string;
  messages: Array<{ type: string; message: string }>;
};

type MammothApi = typeof import("mammoth");
type MammothConverter = Pick<MammothApi, "convertToHtml">;

async function loadMammothConverter(): Promise<MammothConverter> {
  const mammothModule = await import("mammoth") as MammothApi & { default?: MammothApi };
  return mammothModule.default ?? mammothModule;
}

export function isWordDocxFile(file: File) {
  return /\.docx$/i.test(file.name);
}

export async function importAnnouncementDocx(
  file: File,
  converter?: MammothConverter,
): Promise<AnnouncementDocxImportResult> {
  if (!isWordDocxFile(file)) {
    throw new AnnouncementDocxImportError("unsupported_type");
  }

  if (file.size > ANNOUNCEMENT_DOCX_MAX_BYTES) {
    throw new AnnouncementDocxImportError("too_large");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const mammothApi = converter ?? await loadMammothConverter();
    const result = await mammothApi.convertToHtml(
      { arrayBuffer },
      {
        includeDefaultStyleMap: true,
        styleMap: ["u => u"],
      },
    );

    const sanitizedContent = sanitizeAnnouncementHtml(
      normalizeAnnouncementContent(result.value),
    );

    if (isRichTextEmpty(sanitizedContent)) {
      throw new AnnouncementDocxImportError("empty_document");
    }

    if (result.messages.length > 0) {
      console.warn(
        "Word announcement import completed with conversion messages.",
        result.messages.map(({ type, message }) => ({ type, message })),
      );
    }

    return {
      content: sanitizedContent,
      messages: result.messages.map(({ type, message }) => ({ type, message })),
    };
  } catch (error) {
    if (error instanceof AnnouncementDocxImportError) {
      throw error;
    }

    throw new AnnouncementDocxImportError("unreadable");
  }
}
