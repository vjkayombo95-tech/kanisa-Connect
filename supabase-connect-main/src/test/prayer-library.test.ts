import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { orderCollectionPrayers, prayerMatchesSearch, validatePrayerPublish } from "@/lib/prayer-library";
import type { PrayerAdminInput } from "@/types/prayer-library";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260718120000_expand_catholic_prayer_library.sql"), "utf8");
const memberPage = readFileSync(resolve(process.cwd(), "src/pages/portal/MemberPrayerLibraryPage.tsx"), "utf8");
const detailPage = readFileSync(resolve(process.cwd(), "src/pages/portal/MemberPrayerDetailPage.tsx"), "utf8");
const adminPage = readFileSync(resolve(process.cwd(), "src/pages/church-admin/PrayerLibraryPage.tsx"), "utf8");
const service = readFileSync(resolve(process.cwd(), "src/lib/prayer-library.ts"), "utf8");

const validDraft: PrayerAdminInput = {
  title: "Sala ya Jaribio", slug: "sala-ya-jaribio", summary: "", body: "", category_id: "category",
  parent_prayer_id: null, language_id: "sw", status: "draft", prayer_type: "single", recommended_time: "",
  scripture_reference: "", liturgical_season: "", featured: false, sort_order: 0, audio_url: "",
  source_title: "Roman Missal", source_type: "roman_missal", source_organization: "", source_reference: "RM-1",
  source_url: "", source_notes: "", copyright_holder: "", copyright_notice: "", license_type: "licensed",
  license_reference: "LIC-1", content_edition: "Third Edition", content_version_label: "1.0",
  ecclesial_approval_status: "approved", ecclesial_approval_authority: "Conference", ecclesial_approval_reference: "",
  reviewed_by: "Reviewer", reviewed_at: "2026-07-18",
};

describe("Catholic Prayer Library", () => {
  it("searches title, summary, and prayer text case-insensitively", () => {
    const prayer = { title: "Baba Yetu", summary: "Sala ya msingi", body: "Ufalme wako ufike" };
    expect(prayerMatchesSearch(prayer as never, "baba")).toBe(true);
    expect(prayerMatchesSearch(prayer as never, "MSINGI")).toBe(true);
    expect(prayerMatchesSearch(prayer as never, "ufalme")).toBe(true);
    expect(prayerMatchesSearch(prayer as never, "rozari")).toBe(false);
  });

  it("blocks publication without reviewed prayer text", () => {
    expect(validatePrayerPublish({ ...validDraft, status: "published" })).toMatch(/text is required/i);
    expect(validatePrayerPublish({ ...validDraft, status: "published", body: "Reviewed text" })).toBeNull();
  });

  it("orders structured collection sections by sort order", () => {
    const ordered = orderCollectionPrayers([{ title: "Third", sort_order: 3 }, { title: "First", sort_order: 1 }, { title: "Second", sort_order: 2 }] as never);
    expect(ordered.map((item) => item.title)).toEqual(["First", "Second", "Third"]);
  });

  it("defines tenant and personal-data RLS boundaries", () => {
    expect(migration).toContain("public.is_church_member(auth.uid(), church_id)");
    expect(migration).toContain("public.can_manage_church_workspace(auth.uid(), church_id)");
    expect(migration).toContain("is_global\n  and church_id is null");
    expect(migration).toContain("not is_global\n  and church_id is not null");
    expect(migration.match(/user_id = auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain("Church admins update parish prayers");
    expect(migration).toContain("is_global\n  and church_id is null\n  and (public.is_platform_super_admin");
    expect(migration).toContain("status in ('published', 'featured')");
  });

  it("keeps all title-only seeds as drafts with null bodies", () => {
    expect(migration).toContain("Titles only: bodies remain null and records remain drafts");
    expect(migration).toContain("parent.language_id, 'draft', 'member', 'section'");
    expect(migration).not.toMatch(/insert into public\.content_prayers[\s\S]*?'published'/i);
  });

  it("implements member filtering, draft exclusion, favorites, and empty/error states", () => {
    expect(memberPage).toContain('categoryId === "all" || prayer.category_id === categoryId');
    expect(service).toContain('.in("status", ["published", "featured"]');
    expect(service).toContain('body.ilike.%${query}%');
    expect(detailPage).toContain("togglePrayerFavorite");
    expect(memberPage).toContain("Hakuna sala zilizochapishwa zinazolingana");
    expect(memberPage).toContain("Imeshindikana kupakia sala");
  });

  it("keeps church identity trusted and global content read-only in the admin UI", () => {
    expect(adminPage).toContain("createChurchPrayer(churchId!, draft)");
    expect(adminPage).toContain("const editable = !prayer.is_global && prayer.church_id === churchId");
    expect(adminPage).toContain("validatePrayerPublish(draft)");
    expect(service).toContain(".eq(\"church_id\" as never, churchId as never).eq(\"is_global\" as never, false as never)");
  });

  it("renders provenance, safe translation links, and member-safe attribution", () => {
    expect(adminPage).toContain("Chanzo na Uidhinishaji");
    expect(adminPage).toContain("Global translation attachment is managed by super-admin");
    expect(detailPage).toContain("listPublishedTranslations");
    expect(detailPage).toContain("Chanzo");
    expect(detailPage).not.toContain("ecclesial_approval_reference");
    expect(detailPage).not.toContain("reviewed_by");
    expect(service).toContain('.in("status", ["published", "featured"]');
  });
});
