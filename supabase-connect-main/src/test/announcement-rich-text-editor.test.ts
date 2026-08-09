import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createAnnouncementEditorExtensions } from "@/components/announcements/AnnouncementRichTextEditor";

const editorSource = readFileSync(
  resolve(process.cwd(), "src/components/announcements/AnnouncementRichTextEditor.tsx"),
  "utf8",
);
const pageSource = readFileSync(resolve(process.cwd(), "src/pages/church-admin/AnnouncementsPage.tsx"), "utf8");

const editors: Editor[] = [];

function createEditor(content = "<p>Announcement text</p>") {
  const editor = new Editor({ extensions: createAnnouncementEditorExtensions("Write an announcement"), content });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe("announcement rich-text editor", () => {
  it("replaces the old message textarea and exposes the approved toolbar", () => {
    expect(pageSource).toContain("<AnnouncementRichTextEditor");
    expect(pageSource).not.toContain('<Textarea\n                    id="announcement-message"');
    [
      "Undo (Ctrl+Z)",
      "Redo (Ctrl+Y)",
      "Bold (Ctrl+B)",
      "Italic (Ctrl+I)",
      "Underline (Ctrl+U)",
      "Bullet list",
      "Numbered list",
      "Insert link",
      "Align center",
      "Horizontal divider",
      "Clear formatting",
    ].forEach((label) => expect(editorSource).toContain(label));
  });

  it("applies bold formatting", () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.toggleBold();
    expect(editor.getHTML()).toContain("<strong>Announcement text</strong>");
  });

  it("creates bullet and numbered lists", () => {
    const bulletEditor = createEditor();
    bulletEditor.commands.selectAll();
    bulletEditor.commands.toggleBulletList();
    expect(bulletEditor.getHTML()).toContain("<ul>");

    const numberedEditor = createEditor();
    numberedEditor.commands.selectAll();
    numberedEditor.commands.toggleOrderedList();
    expect(numberedEditor.getHTML()).toContain("<ol>");
  });

  it("supports undo and redo", () => {
    const editor = createEditor();
    const original = editor.getHTML();
    editor.commands.insertContent("More text");
    const changed = editor.getHTML();
    expect(changed).not.toBe(original);
    editor.commands.undo();
    expect(editor.getHTML()).toBe(original);
    editor.commands.redo();
    expect(editor.getHTML()).toBe(changed);
  });

  it("allows safe links and blocks unsafe links", () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setLink({ href: "https://example.com" });
    expect(editor.getHTML()).toContain('href="https://example.com"');

    editor.commands.unsetLink();
    editor.commands.selectAll();
    editor.commands.setLink({ href: "javascript:alert(1)" });
    expect(editor.getHTML()).not.toContain("javascript:");
  });

  it("keeps the toolbar mobile-safe and works without AI assistance", () => {
    expect(editorSource).toContain("flex flex-wrap items-center");
    expect(editorSource).toContain("max-w-full overflow-x-hidden");
    expect(editorSource).not.toContain("generateMessages");
  });
});
