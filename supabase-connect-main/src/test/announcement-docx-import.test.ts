import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANNOUNCEMENT_DOCX_MAX_BYTES,
  AnnouncementDocxImportError,
  importAnnouncementDocx,
  isWordDocxFile,
} from "@/lib/announcement-docx-import";

const mammothMock = vi.hoisted(() => ({
  convertToHtml: vi.fn(),
}));

const convertToHtml = mammothMock.convertToHtml;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

function docxFile(name = "announcement.docx") {
  const file = new File(["docx"], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: vi.fn(async () => new ArrayBuffer(4)),
  });
  return file;
}

describe("announcement DOCX import", () => {
  beforeEach(() => {
    convertToHtml.mockReset();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("recognizes Word .docx files by filename without accepting legacy .doc", () => {
    expect(isWordDocxFile(docxFile("notice.DOCX"))).toBe(true);
    expect(isWordDocxFile(new File(["doc"], "notice.doc", { type: "application/msword" }))).toBe(false);
    expect(isWordDocxFile(new File(["txt"], "notice.txt", { type: "text/plain" }))).toBe(false);
  });

  it("converts valid DOCX HTML into sanitized editor content", async () => {
    convertToHtml.mockResolvedValue({
      value: '<h2>Sunday Notice</h2><p><strong>Welcome</strong> <a href="https://example.com">Read more</a></p>',
      messages: [],
    });

    const result = await importAnnouncementDocx(docxFile(), mammothMock);

    expect(convertToHtml).toHaveBeenCalledWith(
      { arrayBuffer: expect.any(ArrayBuffer) },
      expect.objectContaining({ styleMap: ["u => u"] }),
    );
    expect(result.content).toContain("<h2>Sunday Notice</h2>");
    expect(result.content).toContain("<strong>Welcome</strong>");
    expect(result.content).toContain('href="https://example.com"');
  });

  it("does not allow dangerous Mammoth HTML to enter content unsanitized", async () => {
    convertToHtml.mockResolvedValue({
      value: '<p onclick="bad()">Safe<script>alert(1)</script> <a href="javascript:alert(1)">Unsafe</a></p>',
      messages: [],
    });

    const result = await importAnnouncementDocx(docxFile(), mammothMock);

    expect(result.content).toContain("<p>Safe");
    expect(result.content).toContain("Unsafe");
    expect(result.content).not.toContain("onclick");
    expect(result.content).not.toContain("script");
    expect(result.content).not.toContain("javascript:");
  });

  it("rejects empty converted documents", async () => {
    convertToHtml.mockResolvedValue({ value: "<p><br></p>", messages: [] });

    await expect(importAnnouncementDocx(docxFile(), mammothMock)).rejects.toMatchObject({
      code: "empty_document",
    } satisfies Partial<AnnouncementDocxImportError>);
  });

  it("rejects invalid file types before conversion", async () => {
    await expect(
      importAnnouncementDocx(new File(["text"], "announcement.txt", { type: "text/plain" })),
    ).rejects.toMatchObject({ code: "unsupported_type" });
    expect(convertToHtml).not.toHaveBeenCalled();
  });

  it("rejects oversized files before conversion", async () => {
    const file = docxFile();
    Object.defineProperty(file, "size", { value: ANNOUNCEMENT_DOCX_MAX_BYTES + 1 });

    await expect(importAnnouncementDocx(file, mammothMock)).rejects.toMatchObject({ code: "too_large" });
    expect(convertToHtml).not.toHaveBeenCalled();
  });

  it("turns corrupt or unreadable conversion failures into a safe error code", async () => {
    convertToHtml.mockRejectedValue(new Error("zip parse failed"));

    await expect(importAnnouncementDocx(docxFile(), mammothMock)).rejects.toMatchObject({ code: "unreadable" });
  });

  it("keeps non-fatal Mammoth warnings from failing an otherwise valid import", async () => {
    convertToHtml.mockResolvedValue({
      value: "<p>Imported announcement</p>",
      messages: [{ type: "warning", message: "Unrecognised style" }],
    });

    await expect(importAnnouncementDocx(docxFile(), mammothMock)).resolves.toMatchObject({
      content: "<p>Imported announcement</p>",
      messages: [{ type: "warning", message: "Unrecognised style" }],
    });
  });
});
