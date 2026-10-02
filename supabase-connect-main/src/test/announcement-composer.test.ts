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
    expect(source).toContain("disabled={saveAnnouncement.isPending}");
    expect(source).not.toContain('{ value: "super_admin", label: "Super Admin" }');
  });

  it("does not present the former mock AI generation workflow", () => {
    expect(source).not.toContain("Announcement Generator");
    expect(source).not.toContain("Generated variations");
    expect(source).not.toContain("AI style note");
    expect(source).not.toContain("mockTemplates");
    expect(source).not.toContain("generateMessages");
  });
});
