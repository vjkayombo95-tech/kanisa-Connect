import { describe, expect, it } from "vitest";
import {
  DAILY_READINGS_NORMALIZATION_VERSION,
  DailyReadingNormalizationError,
  DailyReadingSourceRecord,
  normalizeDailyReadingSource,
  prepareDailyReadingSource,
  serializeDailyReadingSource,
} from "@/lib/daily-readings-import-normalization";

const baseRecord: DailyReadingSourceRecord = {
  source_key: "test-source",
  source_record_id: "synthetic-2026-09-10-sw",
  source_version: "fixture-v1",
  source_url: "https://example.invalid/daily-readings/synthetic-2026-09-10-sw",
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

async function hashFor(record: DailyReadingSourceRecord) {
  return (await prepareDailyReadingSource(record)).source_hash;
}

describe("Daily Readings import normalization and hashing", () => {
  it("normalizes the same exact input into the same payload without mutating caller input", () => {
    const original = { ...baseRecord };
    const first = normalizeDailyReadingSource(baseRecord);
    const second = normalizeDailyReadingSource(baseRecord);

    expect(first.normalized_payload).toEqual(second.normalized_payload);
    expect(baseRecord).toEqual(original);
    expect(first.normalized_payload).not.toBe(baseRecord);
  });

  it("returns the normalization version beside the payload", async () => {
    const prepared = await prepareDailyReadingSource(baseRecord);

    expect(DAILY_READINGS_NORMALIZATION_VERSION).toBe("daily-readings-v1");
    expect(prepared.normalization_version).toBe("daily-readings-v1");
    expect(prepared.canonical_source).toBe(serializeDailyReadingSource(prepared.normalized_payload));
  });

  it("produces a stable literal golden SHA-256 vector from synthetic source fields", async () => {
    await expect(hashFor(baseRecord)).resolves.toBe(
      "2f0341279867beda4eae71ee5a015280c5676be7ab1523a0fd9523b0de18f5d5",
    );
  });

  it("uses lowercase 64-character SHA-256 hexadecimal output", async () => {
    await expect(hashFor(baseRecord)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes surrounding whitespace without changing the hash", async () => {
    const spaced: DailyReadingSourceRecord = {
      ...baseRecord,
      source_key: "  test-source  ",
      source_record_id: "  synthetic-2026-09-10-sw  ",
      source_version: "  fixture-v1  ",
      reading_date: "  2026-09-10  ",
      first_reading_reference: "  Synthetic 1:1-2  ",
      source_attribution: "  Synthetic attribution for tests  ",
    };

    await expect(hashFor(spaced)).resolves.toBe(await hashFor(baseRecord));
  });

  it("normalizes language casing without changing the hash", async () => {
    await expect(hashFor({ ...baseRecord, language_code: " SW " })).resolves.toBe(await hashFor(baseRecord));
  });

  it("treats optional empty strings and null as the same hash input", async () => {
    const emptyOptionals: DailyReadingSourceRecord = {
      ...baseRecord,
      source_version: "",
      liturgical_year: "",
      liturgical_season: "",
      celebration: "",
      liturgical_color: "",
      second_reading_reference: "",
      gospel_acclamation_reference: "",
    };
    const nullOptionals: DailyReadingSourceRecord = {
      ...baseRecord,
      source_version: null,
      liturgical_year: null,
      liturgical_season: null,
      celebration: null,
      liturgical_color: null,
      second_reading_reference: null,
      gospel_acclamation_reference: null,
    };

    await expect(hashFor(emptyOptionals)).resolves.toBe(await hashFor(nullOptionals));
  });

  it("changes the hash when source-controlled reading content changes", async () => {
    await expect(hashFor({ ...baseRecord, gospel_reference: "Synthetic Gospel 9:9" })).resolves.not.toBe(
      await hashFor(baseRecord),
    );
    await expect(hashFor({ ...baseRecord, source_attribution: "Synthetic attribution update" })).resolves.not.toBe(
      await hashFor(baseRecord),
    );
  });

  it("changes the hash when source identity changes", async () => {
    await expect(hashFor({ ...baseRecord, source_record_id: "synthetic-2026-09-11-sw" })).resolves.not.toBe(
      await hashFor(baseRecord),
    );
  });

  it("includes source_version in the normalized payload and hash", async () => {
    const withoutVersion = { ...baseRecord, source_version: null };

    expect(normalizeDailyReadingSource(baseRecord).normalized_payload.source_version).toBe("fixture-v1");
    await expect(hashFor(withoutVersion)).resolves.not.toBe(await hashFor(baseRecord));
  });

  it("validates source_url but excludes it from the semantic source hash", async () => {
    const changedUrl = { ...baseRecord, source_url: "https://example.invalid/changed-location" };
    const emptyUrl = { ...baseRecord, source_url: "" };
    const nullUrl = { ...baseRecord, source_url: null };

    expect(normalizeDailyReadingSource(changedUrl).source_url).toBe("https://example.invalid/changed-location");
    await expect(hashFor(changedUrl)).resolves.toBe(await hashFor(baseRecord));
    await expect(hashFor(emptyUrl)).resolves.toBe(await hashFor(nullUrl));
  });

  it("rejects invalid required fields with stable machine-readable codes", () => {
    expect(() => normalizeDailyReadingSource({ ...baseRecord, source_key: " " })).toThrowError(
      expect.objectContaining({ code: "invalid_source_identity", field: "source_key" }),
    );
    expect(() => normalizeDailyReadingSource({ ...baseRecord, source_attribution: " " })).toThrowError(
      expect.objectContaining({ code: "invalid_required_field", field: "source_attribution" }),
    );
    expect(() => normalizeDailyReadingSource({ ...baseRecord, gospel_reference: " " })).toThrowError(
      expect.objectContaining({ code: "invalid_reference", field: "gospel_reference" }),
    );
  });

  it("rejects invalid dates and accepts valid leap-year dates", () => {
    expect(() => normalizeDailyReadingSource({ ...baseRecord, reading_date: "2026-02-29" })).toThrowError(
      expect.objectContaining({ code: "invalid_date" }),
    );

    expect(normalizeDailyReadingSource({ ...baseRecord, reading_date: "2028-02-29" }).normalized_payload.reading_date).toBe(
      "2028-02-29",
    );
  });

  it("rejects dangerous or unexpected URL schemes", () => {
    expect(() => normalizeDailyReadingSource({ ...baseRecord, source_url: "javascript:alert(1)" })).toThrowError(
      expect.objectContaining({ code: "invalid_source_url" }),
    );
    expect(() => normalizeDailyReadingSource({ ...baseRecord, source_url: "data:text/plain,test" })).toThrowError(
      DailyReadingNormalizationError,
    );
  });

  it("preserves scripture reference casing, punctuation, and internal spacing", () => {
    const record = {
      ...baseRecord,
      first_reading_reference: "  Synthetic Ref.  1:1 - 2; Alt 3  ",
    };

    expect(normalizeDailyReadingSource(record).normalized_payload.first_reading_reference).toBe(
      "Synthetic Ref.  1:1 - 2; Alt 3",
    );
  });

  it("serializes with stable field ordering and explicit nulls", () => {
    const normalized = normalizeDailyReadingSource({
      ...baseRecord,
      source_version: null,
      second_reading_reference: null,
      gospel_acclamation_reference: null,
    }).normalized_payload;

    expect(serializeDailyReadingSource(normalized)).toBe(
      '{"source_key":"test-source","source_record_id":"synthetic-2026-09-10-sw","source_version":null,"reading_date":"2026-09-10","language_code":"sw","liturgical_year":"A","liturgical_season":"Synthetic Season","celebration":"Synthetic Celebration","liturgical_color":"Green","first_reading_reference":"Synthetic 1:1-2","responsorial_psalm_reference":"Synthetic Psalm 1:3","second_reading_reference":null,"gospel_acclamation_reference":null,"gospel_reference":"Synthetic Gospel 1:6-7","source_attribution":"Synthetic attribution for tests"}',
    );
  });

  it("does not allow editorial fields into the source contract", async () => {
    // @ts-expect-error reflection is intentionally outside DailyReadingSourceRecord.
    const recordWithEditorialData: DailyReadingSourceRecord = {
      ...baseRecord,
      reflection: "Synthetic reflection outside source contract",
      prayer: "Synthetic prayer outside source contract",
      status: "published",
      visibility: "public",
    };

    const prepared = await prepareDailyReadingSource(recordWithEditorialData);

    expect(prepared.canonical_source).not.toContain("reflection");
    expect(prepared.canonical_source).not.toContain("prayer");
    expect(prepared.canonical_source).not.toContain("published");
    expect(prepared.canonical_source).not.toContain("public");
  });
});
