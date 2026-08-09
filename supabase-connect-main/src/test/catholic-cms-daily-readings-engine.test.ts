import { describe, expect, it } from "vitest";

import {
  buildDailyReadingCoverage,
  buildDailyReadingDryRunReport,
  buildDailyReadingRestoreDraft,
  filterMemberDailyReadings,
  importDailyReadingRowToDraft,
  isPublishedDailyReadingForMembers,
  summarizeDailyReadingImportBatch,
  validateDailyReadingImportRows,
  validateDailyReadingPublicationSafety,
  type CmsDailyReading,
  type ContentLanguage,
} from "@/lib/catholic-cms";

const language: ContentLanguage = { id: "lang-en", code: "en", name: "English", native_name: "English", is_default: true };

function reading(overrides: Partial<CmsDailyReading> = {}): CmsDailyReading {
  return {
    id: "reading-1",
    reading_date: "2026-07-04",
    liturgical_year: "A",
    liturgical_season: "Ordinary Time",
    celebration: "Saturday of Ordinary Time",
    liturgical_color: "Green",
    first_reading_reference: "Amos 9:11-15",
    responsorial_psalm_reference: "Psalm 85:9-14",
    second_reading_reference: null,
    gospel_acclamation_reference: "John 10:27",
    gospel_reference: "Matthew 9:14-17",
    reflection: "A short reflection.",
    prayer: "A short prayer.",
    meditation_questions: null,
    daily_challenge: null,
    language_id: language.id,
    status: "published",
    visibility: "member",
    source_attribution: "Lectionary reference",
    editorial_notes: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-07-04T00:00:00.000Z",
    updated_at: "2026-07-04T00:00:00.000Z",
    language,
    ...overrides,
  };
}

const reference = { languages: [language] };

describe("Catholic CMS daily readings engine", () => {
  it("allows member access only for published or featured member-visible readings", () => {
    expect(isPublishedDailyReadingForMembers(reading())).toBe(true);
    expect(isPublishedDailyReadingForMembers(reading({ status: "draft" }))).toBe(false);
    expect(isPublishedDailyReadingForMembers(reading({ visibility: "admin" }))).toBe(false);
  });

  it("filters member readings by date range, language, and search", () => {
    const visible = reading();
    const hidden = reading({ id: "hidden", status: "review" });

    expect(filterMemberDailyReadings([visible, hidden], { from: "2026-07-01", to: "2026-07-31", languageCode: "en" })).toHaveLength(1);
    expect(filterMemberDailyReadings([visible], { search: "Matthew 9" })).toHaveLength(1);
    expect(filterMemberDailyReadings([visible], { search: "Luke 2" })).toHaveLength(0);
  });

  it("validates required readings, lifecycle values, unknown languages, and duplicates", () => {
    const validation = validateDailyReadingImportRows(
      [
        { rowNumber: 2, date: "2026-07-04", firstReading: "Amos 9:11-15", psalm: "Psalm 85:9-14", gospel: "Matthew 9:14-17", language: "English", status: "published", visibility: "member" },
        { rowNumber: 3, date: "2026-07-04", firstReading: "", psalm: "", gospel: "", language: "Klingon", status: "bad", visibility: "hidden" },
        { rowNumber: 4, date: "2026-07-04", firstReading: "Amos 9:11-15", psalm: "Psalm 85:9-14", gospel: "Matthew 9:14-17", language: "English", status: "draft", visibility: "member" },
      ],
      reference,
      [reading()],
    );

    expect(validation.hasErrors).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Date" && issue.message.includes("Duplicate"))).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Date" && issue.severity === "warning")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "First Reading" && issue.severity === "error")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Language" && issue.severity === "error")).toBe(true);
    expect(validation.issues.some((issue) => issue.field === "Status" && issue.severity === "error")).toBe(true);
    expect(validation.summary.existingRecordCount).toBe(1);
  });

  it("uses information severity for absent optional readings", () => {
    const validation = validateDailyReadingImportRows(
      [{ rowNumber: 2, date: "2026-07-05", firstReading: "Isaiah 66:10-14", psalm: "Psalm 66:1-7", gospel: "Luke 10:1-12", status: "draft", visibility: "member" }],
      reference,
      [],
    );

    expect(validation.hasErrors).toBe(false);
    expect(validation.validRows).toHaveLength(1);
    expect(validation.issues.some((issue) => issue.field === "Second Reading" && issue.severity === "information")).toBe(true);
  });

  it("maps import rows into editor drafts with resolved language and normalized nulls", () => {
    const draft = importDailyReadingRowToDraft(
      { rowNumber: 2, date: "2026-07-05", liturgicalSeason: "Ordinary Time", firstReading: "Isaiah 66:10-14", psalm: "Psalm 66:1-7", gospel: "Luke 10:1-12", language: "English", status: "featured", visibility: "public" },
      reference,
    );

    expect(draft.language_id).toBe(language.id);
    expect(draft.second_reading_reference).toBeNull();
    expect(draft.status).toBe("featured");
    expect(draft.visibility).toBe("public");
  });

  it("builds leap-year coverage and separates liturgical completeness from enrichment", () => {
    const coverage = buildDailyReadingCoverage(
      [
        reading({ reading_date: "2028-01-01", reflection: null, prayer: null }),
        reading({ id: "incomplete", reading_date: "2028-01-02", gospel_reference: "" }),
      ],
      2028,
    );

    expect(coverage.totalDays).toBe(366);
    expect(coverage.datasetReadings).toBe(2);
    expect(coverage.completeLiturgicalReadings).toBe(1);
    expect(coverage.enrichedReadings).toBe(1);
    expect(coverage.publishedCoveragePercent).toBeCloseTo(0.5, 1);
    expect(coverage.incompleteDates).toContain("2028-01-02");
    expect(coverage.missingDates).toContain("2028-01-03");
  });

  it("builds restore drafts from version snapshots without changing the record identity", () => {
    const current = reading();
    const restored = buildDailyReadingRestoreDraft(current, { celebration: "Old Celebration", gospel_reference: "John 1:1-18", status: "review" });

    expect(restored.id).toBe(current.id);
    expect(restored.celebration).toBe("Old Celebration");
    expect(restored.gospel_reference).toBe("John 1:1-18");
    expect(restored.status).toBe("review");
    expect(restored.first_reading_reference).toBe(current.first_reading_reference);
  });

  it("builds dry-run reports without mutating existing readings", () => {
    const existing = [reading({ reading_date: "2026-07-05" })];
    const report = buildDailyReadingDryRunReport({
      rows: [
        { rowNumber: 2, date: "2026-07-05", firstReading: "Isaiah 66:10-14", psalm: "Psalm 66:1-7", gospel: "Luke 10:1-12", status: "draft", visibility: "member" },
        { rowNumber: 3, date: "2026-08-05", firstReading: "Jeremiah 31:1-7", psalm: "Psalm 31:1-7", gospel: "Matthew 15:21-28", status: "draft", visibility: "member" },
      ],
      reference,
      existingReadings: existing,
      metadata: { filename: "dev.xlsx", sourceOrganization: "Verified Source", sourcePublication: "Dev", sourceYear: 2026 },
      range: { from: "2026-07-01", to: "2026-07-31" },
    });

    expect(report.dryRun).toBe(true);
    expect(report.rowsInRange).toHaveLength(1);
    expect(report.validation.summary.existingRecordCount).toBe(1);
    expect(existing[0].status).toBe("published");
  });

  it("summarizes import batches with conflict and warning counts", () => {
    const validation = validateDailyReadingImportRows(
      [{ rowNumber: 2, date: "2026-07-05", firstReading: "Isaiah 66:10-14", psalm: "Psalm 66:1-7", gospel: "Luke 10:1-12", status: "draft", visibility: "member" }],
      reference,
      [reading({ reading_date: "2026-07-05" })],
    );
    const summary = summarizeDailyReadingImportBatch({ validation, importedRows: 1, updatedRows: 0, skippedRows: 0 });

    expect(summary.status).toBe("Ready for Import");
    expect(summary.importedRows).toBe(1);
    expect(summary.warningRows).toBeGreaterThan(0);
    expect(summary.conflictCount).toBe(1);
  });

  it("blocks invalid bulk publication and allows complete ranges", () => {
    const blocked = validateDailyReadingPublicationSafety(
      [reading({ reading_date: "2026-07-01" }), reading({ reading_date: "2026-07-02", gospel_reference: "" })],
      { from: "2026-07-01", to: "2026-07-03" },
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.issues.some((issue) => issue.code === "missing_publication_date")).toBe(true);
    expect(blocked.issues.some((issue) => issue.code === "publish_missing_gospel")).toBe(true);

    const allowed = validateDailyReadingPublicationSafety(
      [reading({ reading_date: "2026-07-01" }), reading({ reading_date: "2026-07-02" })],
      { from: "2026-07-01", to: "2026-07-02" },
    );
    expect(allowed.allowed).toBe(true);
  });
});
