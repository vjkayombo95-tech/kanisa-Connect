import { describe, expect, it } from "vitest";
import { planDailyReadingImport, ExistingDailyReadingForImportPlan } from "@/lib/daily-readings-import-planning";
import {
  DAILY_READINGS_NORMALIZATION_VERSION,
  NormalizedDailyReadingSourcePayload,
  PreparedDailyReadingSource,
} from "@/lib/daily-readings-import-normalization";

const normalizedPayload: NormalizedDailyReadingSourcePayload = {
  source_key: "test-source",
  source_record_id: "synthetic-2026-09-10-sw",
  source_version: "fixture-v1",
  reading_date: "2026-09-10",
  language_code: "sw",
  liturgical_year: "A",
  liturgical_season: "Synthetic Season",
  celebration: "Synthetic Celebration",
  liturgical_color: "Green",
  first_reading_reference: "Synthetic 1:1-2",
  responsorial_psalm_reference: "Synthetic Psalm 1:3",
  second_reading_reference: "Synthetic 2:4",
  gospel_acclamation_reference: "Synthetic Acclamation 1:5",
  gospel_reference: "Synthetic Gospel 1:6-7",
  source_attribution: "Synthetic attribution for tests",
};

const preparedSource: PreparedDailyReadingSource = {
  normalized_payload: normalizedPayload,
  canonical_source: JSON.stringify(normalizedPayload),
  source_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  normalization_version: DAILY_READINGS_NORMALIZATION_VERSION,
  source_url: "https://example.invalid/daily-readings/synthetic-2026-09-10-sw",
};

function existing(overrides: Partial<ExistingDailyReadingForImportPlan> = {}): ExistingDailyReadingForImportPlan {
  return {
    id: "cms-existing",
    reading_date: normalizedPayload.reading_date,
    language_code: normalizedPayload.language_code,
    language_id: "language-sw",
    source_key: normalizedPayload.source_key,
    source_record_id: normalizedPayload.source_record_id,
    source_version: normalizedPayload.source_version,
    source_url: preparedSource.source_url,
    last_imported_source_hash: preparedSource.source_hash,
    last_imported_source_payload: normalizedPayload,
    status: "draft",
    visibility: "member",
    liturgical_year: normalizedPayload.liturgical_year,
    liturgical_season: normalizedPayload.liturgical_season,
    celebration: normalizedPayload.celebration,
    liturgical_color: normalizedPayload.liturgical_color,
    first_reading_reference: normalizedPayload.first_reading_reference,
    responsorial_psalm_reference: normalizedPayload.responsorial_psalm_reference,
    second_reading_reference: normalizedPayload.second_reading_reference,
    gospel_acclamation_reference: normalizedPayload.gospel_acclamation_reference,
    gospel_reference: normalizedPayload.gospel_reference,
    source_attribution: normalizedPayload.source_attribution,
    ...overrides,
  };
}

function changedSource(overrides: Partial<PreparedDailyReadingSource> = {}): PreparedDailyReadingSource {
  return {
    ...preparedSource,
    source_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ...overrides,
  };
}

describe("Daily Readings import planning", () => {
  it("plans a new source record as draft/member without publication", () => {
    const plan = planDailyReadingImport({ source: preparedSource, language_id: "language-sw" });

    expect(plan).toMatchObject({
      decision: "create_draft",
      ledger_status: "imported",
      error_code: null,
      target_record_id: null,
      conflict_record_id: null,
      preserves_editorial_fields: true,
      auto_publish: false,
    });
    expect(plan.insert_values).toMatchObject({
      status: "draft",
      visibility: "member",
      language_id: "language-sw",
      source_key: "test-source",
      source_record_id: "synthetic-2026-09-10-sw",
      last_imported_source_hash: preparedSource.source_hash,
    });
    expect(Object.keys(plan.insert_values ?? {})).not.toEqual(
      expect.arrayContaining(["reflection", "prayer", "editorial_notes", "created_by", "updated_by"]),
    );
    expect(plan.update_values).toBeNull();
  });

  it("skips an unchanged same-source record", () => {
    const plan = planDailyReadingImport({ source: preparedSource, existing_by_source: existing() });

    expect(plan).toMatchObject({
      decision: "skip_unchanged",
      ledger_status: "skipped",
      error_code: null,
      target_record_id: "cms-existing",
      insert_values: null,
      update_values: null,
      auto_publish: false,
    });
  });

  it("plans a draft same-source hash change as a source-only update", () => {
    const plan = planDailyReadingImport({ source: changedSource(), existing_by_source: existing() });

    expect(plan).toMatchObject({
      decision: "update_draft_from_source",
      ledger_status: "imported",
      error_code: null,
      target_record_id: "cms-existing",
      insert_values: null,
      conflict_record_id: null,
      auto_publish: false,
    });
    expect(plan.update_values).toMatchObject({
      source_key: normalizedPayload.source_key,
      source_record_id: normalizedPayload.source_record_id,
      last_imported_source_hash: changedSource().source_hash,
      first_reading_reference: normalizedPayload.first_reading_reference,
      source_attribution: normalizedPayload.source_attribution,
    });
    expect(Object.keys(plan.update_values ?? {})).not.toEqual(
      expect.arrayContaining(["status", "visibility", "reflection", "prayer", "editorial_notes"]),
    );
  });

  it("conflicts when manual drift changed the current row after the last imported source payload", () => {
    const plan = planDailyReadingImport({
      source: changedSource(),
      existing_by_source: existing({ gospel_reference: "Synthetic Gospel 9:9" }),
    });

    expect(plan).toMatchObject({
      decision: "conflict_manual_drift",
      ledger_status: "conflict",
      error_code: "manual_drift",
      target_record_id: "cms-existing",
      conflict_record_id: "cms-existing",
      insert_values: null,
      update_values: null,
    });
  });

  it("treats manual drift as a conflict even when the upstream source hash is unchanged", () => {
    const plan = planDailyReadingImport({
      source: preparedSource,
      existing_by_source: existing({ source_attribution: "Manually adjusted attribution" }),
    });

    expect(plan).toMatchObject({
      decision: "conflict_manual_drift",
      ledger_status: "conflict",
      error_code: "manual_drift",
    });
  });

  it("does not treat normalized null values stored as empty CMS text as manual drift", () => {
    const plan = planDailyReadingImport({
      source: changedSource(),
      existing_by_source: existing({
        last_imported_source_payload: {
          ...normalizedPayload,
          liturgical_year: null,
          celebration: null,
        },
        liturgical_year: "",
        celebration: "",
      }),
    });

    expect(plan.decision).toBe("update_draft_from_source");
  });

  it("conflicts instead of silently changing published or featured content whose source changed", () => {
    expect(planDailyReadingImport({ source: changedSource(), existing_by_source: existing({ status: "published" }) }))
      .toMatchObject({
        decision: "conflict_published_source_changed",
        ledger_status: "conflict",
        error_code: "published_source_changed",
        update_values: null,
      });

    expect(planDailyReadingImport({ source: changedSource(), existing_by_source: existing({ status: "featured" }) }))
      .toMatchObject({
        decision: "conflict_published_source_changed",
        ledger_status: "conflict",
        error_code: "published_source_changed",
      });
  });

  it("conflicts when a different source identity already owns the same reading date and language", () => {
    const plan = planDailyReadingImport({
      source: preparedSource,
      existing_by_date_language: existing({
        id: "cms-other-source",
        source_key: "other-source",
        source_record_id: "other-2026-09-10-sw",
      }),
    });

    expect(plan).toMatchObject({
      decision: "conflict_date_language_source_collision",
      ledger_status: "conflict",
      error_code: "date_language_collision",
      target_record_id: null,
      conflict_record_id: "cms-other-source",
      insert_values: null,
      update_values: null,
    });
  });

  it("conflicts when manual or null-source content already exists for the same reading date and language", () => {
    const plan = planDailyReadingImport({
      source: preparedSource,
      existing_by_date_language: existing({
        id: "cms-manual",
        source_key: null,
        source_record_id: null,
        last_imported_source_hash: null,
        last_imported_source_payload: null,
      }),
    });

    expect(plan).toMatchObject({
      decision: "conflict_manual_content_collision",
      ledger_status: "conflict",
      error_code: "manual_content_collision",
      target_record_id: null,
      conflict_record_id: "cms-manual",
      insert_values: null,
      update_values: null,
    });
  });

  it("ignores non-colliding date/language rows and creates draft content", () => {
    const plan = planDailyReadingImport({
      source: preparedSource,
      existing_by_date_language: [
        existing({ id: "different-date", reading_date: "2026-09-11", source_key: "other", source_record_id: "other-1" }),
        existing({ id: "different-language", language_code: "en", source_key: "other", source_record_id: "other-2" }),
      ],
    });

    expect(plan.decision).toBe("create_draft");
    expect(plan.insert_values?.status).toBe("draft");
    expect(plan.insert_values?.visibility).toBe("member");
  });

  it("does not classify the same source row as a date/language collision", () => {
    const sameSource = existing();
    const plan = planDailyReadingImport({
      source: changedSource(),
      existing_by_source: sameSource,
      existing_by_date_language: [sameSource],
    });

    expect(plan.decision).toBe("update_draft_from_source");
    expect(plan.conflict_record_id).toBeNull();
  });

  it("keeps editorial-controlled fields out of planned mutations", () => {
    const updatePlan = planDailyReadingImport({ source: changedSource(), existing_by_source: existing() });
    const createPlan = planDailyReadingImport({ source: preparedSource });
    const forbidden = [
      "reflection",
      "prayer",
      "meditation_questions",
      "daily_challenge",
      "editorial_notes",
      "created_by",
      "updated_by",
      "created_at",
      "updated_at",
      "id",
      "import_batch_id",
      "last_import_item_id",
    ];

    expect(Object.keys(updatePlan.update_values ?? {})).not.toEqual(expect.arrayContaining(forbidden));
    expect(Object.keys(createPlan.insert_values ?? {})).not.toEqual(expect.arrayContaining(forbidden));
  });
});
