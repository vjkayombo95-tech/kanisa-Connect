import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/church-admin/AnnouncementsPage.tsx"), "utf8");

describe("church admin announcement composer", () => {
  it("presents one professional composer for create and edit workflows", () => {
    expect(source).toContain('form.id ? "Edit Announcement" : "New Announcement"');
    expect(source).toContain("Save Draft");
    expect(source).toContain("Publish Announcement");
    expect(source).toContain("Announcement preview");
    expect(source).toContain('submitAnnouncement("draft")');
    expect(source).toContain('submitAnnouncement("publish")');
  });

  it("preserves real publishing controls and validates scheduled publishing", () => {
    expect(source).toContain('value="schedule"');
    expect(source).toContain('errors.publishAt = "Choose a future date and time."');
    expect(source).toContain("form.notificationStrategy");
    expect(source).toContain("form.showOnCalendar");
    expect(source).toContain("form.featured");
    expect(source).toContain('["announcement-target-options", churchId]');
    expect(source).toContain('supabase.from("ministries").select("id,name").eq("church_id", churchId)');
    expect(source).toContain('supabase.from("communities").select("id,name").eq("church_id", churchId)');
    expect(source).toContain('searchPlaceholder="Type a ministry name..."');
    expect(source).toContain('searchPlaceholder="Type a community name..."');
    expect(source).toContain('supabase.rpc("save_church_announcement"');
    expect(source).toContain("sanitizeAnnouncementHtml(normalizeAnnouncementContent(form.content))");
    expect(source).toContain("disabled={saveAnnouncement.isPending}");
    expect(source).not.toContain('{ value: "super_admin", label: "Super Admin" }');
  });

  it("lets admins import Word documents without replacing the existing editor or publish flow", () => {
    expect(source).toContain("Import Word");
    expect(source).toContain("WORD_IMPORT_ACCEPT");
    expect(source).toContain('type="file"');
    expect(source).toContain('accept={WORD_IMPORT_ACCEPT}');
    expect(source).toContain("importAnnouncementDocx(file)");
    expect(source).toContain("setForm((current) => ({ ...current, content: result.content }))");
    expect(source).toContain("Document imported. Review the announcement before publishing.");
    expect(source).toContain('type="button"');
    expect(source).toContain("submitAnnouncement(\"publish\")");
  });

  it("protects existing announcement text before replacing it with a Word import", () => {
    expect(source).toContain("Replace current message?");
    expect(source).toContain(
      "Importing this Word document will replace the message currently in the editor.",
    );
    expect(source).toContain("Replace and import");
    expect(source).toContain("if (!isRichTextEmpty(form.content))");
    expect(source).toContain("setPendingWordImportFile(file)");
    expect(source).toContain("setReplaceWordImportOpen(true)");
  });

  it("shows safe Word import validation and failure messages", () => {
    expect(source).toContain("Please choose a Word .docx document.");
    expect(source).toContain("This document is too large. Choose a Word document smaller than 10 MB.");
    expect(source).toContain("We couldn't find announcement content in this document.");
    expect(source).toContain("We couldn't read this Word document. Check the file and try again.");
    expect(source).toContain("Something went wrong while importing the document. Try again.");
    expect(source).toContain("resetWordImportInput()");
  });

  it("supports optional announcement images without replacing the publish flow", () => {
    expect(source).toContain('Label htmlFor="announcement-image"');
    expect(source).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(source).toContain("validateAnnouncementImageFile(file)");
    expect(source).toContain("Image selected. It will upload when you save the announcement.");
    expect(source).toContain("uploadSelectedAnnouncementImage()");
    expect(source).toContain('fetch("/api/announcement-image-upload"');
    expect(source).toContain('method: "PUT"');
    expect(source).toContain("_image_key: imageKey");
    expect(source).toContain("image_key: imageKey");
    expect(source).toContain('submitAnnouncement("publish")');
  });

  it("preserves, removes, and duplicates saved announcement image keys deliberately", () => {
    expect(source).toContain("image_key?: string | null");
    expect(source).toContain("imageKey: null as string | null");
    expect(source).toContain("imageKey: announcement.image_key ?? null");
    expect(source).toContain("removeAnnouncementImage");
    expect(source).toContain("setForm((current) => ({ ...current, imageKey: null }))");
    expect(source).toContain("_image_key: announcement.image_key ?? null");
    expect(source).toContain("image_key: announcement.image_key ?? null");
  });

  it("guides the admin through one audience choice at a time", () => {
    expect(source).toContain("Who is this for? *");
    expect(source).toContain('label: "Everyone"');
    expect(source).toContain('label: "A ministry"');
    expect(source).toContain('label: "A community"');
    expect(source).toContain('label: "Specific roles"');

    expect(source).toContain('audienceMode === "ministry"');
    expect(source).toContain('audienceMode === "community"');
    expect(source).toContain('audienceMode === "roles"');

    expect(source).toContain(
      'targetMinistry: option.value === "ministry" ? current.targetMinistry : ""',
    );
    expect(source).toContain(
      'targetCommunity: option.value === "community" ? current.targetCommunity : ""',
    );
    expect(source).toContain(
      'option.value === "community" ? current.communityAudience : "all"',
    );
  });

  it("supports targeting everyone or leaders within a selected community", () => {
    expect(source).toContain('type CommunityAudience = "all" | "leaders"');
    expect(source).toContain('communityAudience: "all" as CommunityAudience');
    expect(source).toContain("Everyone in this community");
    expect(source).toContain("Community leaders only");
    expect(source).toContain('checked={form.communityAudience === "all"}');
    expect(source).toContain('checked={form.communityAudience === "leaders"}');

    expect(source).toContain(
      'communityAudience: announcement.community_audience === "leaders" ? "leaders" : "all"',
    );

    expect(source).toContain("_community_audience: form.communityAudience");
    expect(source).toContain("community_audience: form.communityAudience");
    expect(source).toContain(
      '_community_audience: announcement.community_audience === "leaders" ? "leaders" : "all"',
    );
  });

  it("requires an explicit target for targeted announcements", () => {
    expect(source).toContain(
      'audienceMode === "roles" && form.audience.length === 0',
    );
    expect(source).toContain('errors.audience = "Select at least one role."');

    expect(source).toContain(
      'audienceMode === "ministry" && !form.targetMinistry.trim()',
    );
    expect(source).toContain('errors.audience = "Choose a ministry."');

    expect(source).toContain(
      'audienceMode === "community" && !form.targetCommunity.trim()',
    );
    expect(source).toContain('errors.audience = "Choose a community."');

    expect(source).not.toContain(': ["members"]');
  });

  it("infers targeting when editing or duplicating announcements", () => {
    expect(source).toContain("function resolveAudienceMode({");
    expect(source).toContain('if (targetMinistry) return "ministry"');
    expect(source).toContain('if (targetCommunity) return "community"');
    expect(source).toContain('return "roles"');
    expect(source).toContain("setAudienceMode(");
  });

  it("keeps advanced settings behind More options", () => {
    expect(source).toContain("More options");
    expect(source).toContain("setShowMoreOptions((current) => !current)");
    expect(source).toContain("aria-expanded={showMoreOptions}");
    expect(source).toContain("{showMoreOptions && (");
  });

  it("shows the real target in announcement summaries and preview", () => {
    expect(source).toContain("function getAudienceSummary({");
    expect(source).toContain('return `Ministry: ${targetMinistry.trim()}`');
    expect(source).toContain('communityAudience?: CommunityAudience | null');
    expect(source).toContain(
      '`Community: ${targetCommunity.trim()} - Leaders only`',
    );
    expect(source).toContain(
      '`Community: ${targetCommunity.trim()} - Everyone`',
    );
    expect(source).toContain('if (normalizedAudience.includes("everyone")) return "Everyone"');
    expect(source).toContain("Audience: {audienceSummary}");
    expect(source).toContain("communityAudience: form.communityAudience");
    expect(source).toContain("communityAudience: announcement.community_audience");
  });

  it("places audience targeting before publish timing", () => {
    const audienceIndex = source.indexOf("<Label>Who is this for? *</Label>");
    const timingIndex = source.indexOf("<Label>Publish timing</Label>");
    const moreOptionsIndex = source.indexOf("More options");

    expect(audienceIndex).toBeGreaterThan(-1);
    expect(timingIndex).toBeGreaterThan(audienceIndex);
    expect(moreOptionsIndex).toBeGreaterThan(timingIndex);
  });

  it("does not present the former mock AI generation workflow", () => {
    expect(source).not.toContain("Announcement Generator");
    expect(source).not.toContain("Generated variations");
    expect(source).not.toContain("AI style note");
    expect(source).not.toContain("mockTemplates");
    expect(source).not.toContain("generateMessages");
  });
});
