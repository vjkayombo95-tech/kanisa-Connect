import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const phrase = (...parts: string[]) => parts.join("");

describe("Wave 18 announcement template reliability", () => {
  const page = read("src/pages/church-admin/AnnouncementsPage.tsx");

  it("keeps live templates as the only generated-template source", () => {
    expect(page).toContain('.from("message_templates")');
    expect(page).toContain(".in(\"type\", templateTypeAliases[type] ?? [type])");
    expect(page).toContain(".eq(\"language\", selectedLanguage)");
    expect(page).toContain("normalizeMessageTemplate(template, type, selectedLanguage, index)");
    expect(page).toContain("setAiResults(templates)");
    expect(page).toContain("templateRequestSequence");
    expect(page).toContain("requestId !== templateRequestSequence.current");
    expect(page).toContain("setAiDraft({");
    expect(page).toContain("content: first.content");
    expect(page).toContain("aiResults.map((template, index) =>");
  });

  it("does not keep an embedded sample template catalogue", () => {
    expect(page).not.toContain(phrase("mock", "Templates"));
    expect(page).not.toContain(phrase("get", "MockTemplates"));
    expect(page).not.toContain("mock-${type}");
    expect(page).not.toContain(phrase("Using local ", "mock templates"));
  });

  it("does not ship known demo announcement content", () => {
    for (const demoCopy of [
      phrase("Join us this Sunday for a powerful ", "worship service"),
      phrase("All young people are invited to this week's ", "youth meeting"),
      phrase("We are excited to announce a special church event ", "coming soon"),
      phrase("Karibuni kwenye ", "ibada ", "yetu ya ", "Jumapili hii"),
      phrase("Tunayo furaha kuwatangazia ", "tukio maalum"),
    ]) {
      expect(page).not.toContain(demoCopy);
    }
  });

  it("renders empty template results as an explicit no-template state", () => {
    expect(page).toContain("templates.length === 0");
    expect(page).toContain("No saved templates are configured for this message type and language yet.");
    expect(page).toContain('aiNotice ?? "Tap a suggestion above to load saved message templates."');
    expect(page).not.toContain(phrase("No live templates were returned from Supabase. ", "Using local ", "mock templates for now."));
  });

  it("keeps retrieval failures empty, retryable, and sanitized", () => {
    expect(page).toContain('console.error("Failed to load announcement templates:", err)');
    expect(page).toContain("setAiResults([])");
    expect(page).toContain('toast({ title: "Templates unavailable"');
    expect(page).toContain("Templates could not be loaded. Retry when your connection or configuration is ready.");
    expect(page).toContain("Retry loading templates");
    expect(page).not.toContain("Connection failed while reaching Supabase. Please check your project URL");
    expect(page).not.toContain("Setup incomplete: Please refresh Supabase schema in Settings -> API -> Refresh");
  });

  it("preserves announcement create/edit/publish compatibility", () => {
    expect(page).toContain('supabase.rpc("save_church_announcement" as never');
    expect(page).toContain("_announcement_id: form.id");
    expect(page).toContain("_is_published: form.isPublished");
    expect(page).toContain('toast({ title: form.id ? "Announcement updated" : "Announcement created" })');
    expect(page).toContain('supabase.rpc("set_church_announcement_archived" as never');
    expect(page).toContain('supabase.rpc("delete_church_announcement" as never');
  });
});
