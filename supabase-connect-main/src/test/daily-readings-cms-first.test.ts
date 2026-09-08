import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type QueryError = { code?: string; message: string; details?: string; hint?: string };

const database: Record<string, Row[]> = {};
const tableErrors: Record<string, QueryError | null> = {};
const queryLog: Array<{ table: string; operation: string; args: unknown[] }> = [];

function languageCode(row: Row) {
  if (row.language_id == null) return null;
  return (database.content_languages ?? []).find((language) => language.id === row.language_id)?.code ?? null;
}

function statusRank(status: unknown) {
  if (status === "featured") return 1;
  if (status === "published") return 2;
  return 3;
}

function languageRank(row: Row) {
  const code = languageCode(row);
  if (code === "sw") return 1;
  if (code === "en") return 2;
  if (row.language_id == null) return 3;
  return 4;
}

function byCanonicalPriority(left: Row, right: Row) {
  const languageComparison = languageRank(left) - languageRank(right);
  if (languageComparison) return languageComparison;
  const statusComparison = statusRank(left.status) - statusRank(right.status);
  if (statusComparison) return statusComparison;
  const updatedComparison = String(right.updated_at).localeCompare(String(left.updated_at));
  if (updatedComparison) return updatedComparison;
  const createdComparison = String(right.created_at).localeCompare(String(left.created_at));
  if (createdComparison) return createdComparison;
  return String(left.id).localeCompare(String(right.id));
}

function hasLegacyText(row: Row) {
  return ["first_reading", "psalm", "second_reading", "gospel"].some((key) => String(row[key] ?? "").trim())
    || (database.daily_reading_passages ?? []).some((passage) => passage.daily_reading_id === row.id && String(passage.text ?? "").trim());
}

function canonicalDailyReading(date: string) {
  const cms = (database.content_daily_readings ?? [])
    .filter((row) => row.reading_date === date)
    .filter((row) => ["published", "featured"].includes(String(row.status)))
    .filter((row) => ["public", "member"].includes(String(row.visibility ?? "member")))
    .filter((row) => row.language_id == null || ["sw", "en"].includes(String(languageCode(row))))
    .sort(byCanonicalPriority)[0];

  if (cms) {
    const liturgicalDay = (database.liturgical_days ?? []).find((day) => day.date === cms.reading_date);
    const batch = (database.content_import_batches ?? []).find((item) => item.id === cms.import_batch_id);
    return {
      id: cms.id,
      reading_date: cms.reading_date,
      source: "cms",
      language_code: languageCode(cms),
      status: cms.status,
      liturgical_day_id: liturgicalDay?.id ?? null,
      celebration: liturgicalDay?.celebration ?? cms.celebration ?? null,
      liturgical_season: liturgicalDay?.season ?? cms.liturgical_season ?? null,
      liturgical_year: liturgicalDay?.liturgical_year ?? cms.liturgical_year ?? null,
      weekday_cycle: liturgicalDay?.weekday_cycle ?? null,
      liturgical_color: liturgicalDay?.liturgical_color ?? cms.liturgical_color ?? null,
      rank: liturgicalDay?.rank ?? null,
      lectionary_number: liturgicalDay?.lectionary_number ?? null,
      first_reading_reference: cms.first_reading_reference,
      responsorial_psalm_reference: cms.responsorial_psalm_reference,
      second_reading_reference: cms.second_reading_reference,
      gospel_acclamation_reference: cms.gospel_acclamation_reference ?? null,
      gospel_reference: cms.gospel_reference,
      reflection: cms.reflection ?? null,
      prayer: cms.prayer ?? null,
      is_reference_only: true,
      source_attribution: cms.source_attribution ?? null,
      source_organization: batch?.source_organization ?? null,
      source_publication: batch?.source_publication ?? null,
      source_year: batch?.source_year ?? null,
      source_edition: batch?.source_edition ?? null,
    };
  }

  const legacy = (database.daily_readings ?? [])
    .filter((row) => row.reading_date === date && row.is_published === true)
    .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)) || String(left.id).localeCompare(String(right.id)))[0];

  const legacyLiturgicalDay = legacy
    ? (database.liturgical_days ?? []).find((day) => day.id === legacy.liturgical_day_id)
    : null;

  return legacy ? {
    id: legacy.id,
    reading_date: legacy.reading_date,
    source: "legacy",
    language_code: null,
    status: "published",
    liturgical_day_id: legacyLiturgicalDay?.id ?? null,
    celebration: legacyLiturgicalDay?.celebration ?? null,
    liturgical_season: legacyLiturgicalDay?.season ?? legacy.liturgical_season ?? null,
    liturgical_year: legacyLiturgicalDay?.liturgical_year ?? null,
    weekday_cycle: legacyLiturgicalDay?.weekday_cycle ?? null,
    liturgical_color: legacyLiturgicalDay?.liturgical_color ?? null,
    rank: legacyLiturgicalDay?.rank ?? null,
    lectionary_number: legacyLiturgicalDay?.lectionary_number ?? null,
    first_reading_reference: legacy.first_reading_reference ?? "Daily reading reference pending",
    responsorial_psalm_reference: legacy.responsorial_psalm_reference ?? "Psalm reference pending",
    second_reading_reference: legacy.second_reading_reference ?? null,
    gospel_acclamation_reference: legacy.gospel_acclamation ?? null,
    gospel_reference: legacy.gospel_reference ?? "Gospel reference pending",
    reflection: legacy.reflection ?? null,
    prayer: legacy.prayer ?? null,
    is_reference_only: !hasLegacyText(legacy),
    source_attribution: null,
    source_organization: null,
    source_publication: null,
    source_year: null,
    source_edition: null,
  } : null;
}

class QueryMock implements PromiseLike<{ data: unknown; error: QueryError | null }> {
  private rows: Row[];
  private mode: "many" | "maybeSingle" = "many";
  private orders: Array<{ column: string; ascending: boolean }> = [];

  constructor(private table: string) {
    this.rows = [...(database[table] ?? [])];
  }

  private log(operation: string, args: unknown[]) {
    queryLog.push({ table: this.table, operation, args });
    return this;
  }

  select(...args: unknown[]) { return this.log("select", args); }

  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((row) => row[column] === value);
    return this.log("eq", [column, value]);
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this.log("order", [column, options]);
  }

  maybeSingle() {
    this.mode = "maybeSingle";
    return this.log("maybeSingle", []);
  }

  private materializeRows() {
    const sorted = this.orders.length ? [...this.rows].sort((left, right) => {
      for (const order of this.orders) {
        const a = left[order.column];
        const b = right[order.column];
        if (a === b) continue;
        if (a == null) return 1;
        if (b == null) return -1;
        const comparison = String(a).localeCompare(String(b));
        if (comparison !== 0) return order.ascending ? comparison : -comparison;
      }
      return 0;
    }) : this.rows;

    return sorted;
  }

  then<TResult1 = { data: unknown; error: QueryError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: QueryError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const error = tableErrors[this.table] ?? null;
    const rows = this.materializeRows();
    const data = error ? null : this.mode === "maybeSingle" ? rows[0] ?? null : rows;
    return Promise.resolve({ data, error }).then(onfulfilled, onrejected);
  }
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args: { p_reading_date: string }) => {
      queryLog.push({ table: "rpc", operation: name, args: [args] });
      const error = tableErrors.rpc ?? null;
      return Promise.resolve({ data: error ? null : [canonicalDailyReading(args.p_reading_date)].filter(Boolean), error });
    },
    from: (table: string) => new QueryMock(table),
  },
}));

import { fetchPublishedDailyReading, getDarEsSalaamDateKey } from "@/lib/daily-readings";

const cmsBase = {
  id: "cms-published",
  reading_date: "2026-08-31",
  language_id: "sw-language",
  visibility: "member",
  liturgical_season: "Ordinary Time",
  liturgical_year: "C",
  liturgical_color: "green",
  celebration: "CMS celebration",
  first_reading_reference: "1 Thes 4:13-18",
  responsorial_psalm_reference: "Ps 96:1, 3-5, 11-13",
  second_reading_reference: null,
  gospel_reference: "Lk 4:16-30",
  gospel_acclamation_reference: "Alleluia reference",
  reflection: "CMS reflection",
  prayer: "CMS prayer",
  source_attribution: "Approved lectionary source",
  import_batch_id: "batch-1",
  status: "published",
  updated_at: "2026-08-30T12:00:00.000Z",
  created_at: "2026-08-29T12:00:00.000Z",
};

const legacyReading = {
  id: "legacy-reading",
  reading_date: "2026-08-31",
  liturgical_season: "Legacy Season",
  first_reading: "Legacy first text",
  psalm: "Legacy psalm text",
  second_reading: "Legacy second text",
  gospel: "Legacy gospel text",
  reflection: "Legacy reflection",
  prayer: "Legacy prayer",
  is_published: true,
  updated_at: "2026-08-30T12:00:00.000Z",
};

beforeEach(() => {
  for (const key of Object.keys(database)) delete database[key];
  for (const key of Object.keys(tableErrors)) delete tableErrors[key];
  queryLog.length = 0;
  database.content_languages = [
    { id: "sw-language", code: "sw" },
    { id: "en-language", code: "en" },
  ];
  database.content_daily_readings = [];
  database.content_import_batches = [];
  database.liturgical_days = [];
  database.daily_readings = [];
  database.daily_reading_passages = [];
});

describe("fetchPublishedDailyReading canonical member behavior", () => {
  it("uses the canonical RPC and returns a CMS reading in the existing DailyReadingEntry shape", async () => {
    database.content_daily_readings = [cmsBase];
    database.content_import_batches = [
      {
        id: "batch-1",
        source_organization: "Source Org",
        source_publication: "Source Publication",
        source_year: 2026,
        source_edition: "Member edition",
      },
    ];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading).toMatchObject({
      id: "cms-published",
      date: "2026-08-31",
      source: "cms",
      languageCode: "sw",
      status: "published",
      liturgicalSeason: "Ordinary Time",
      liturgicalYear: "C",
      liturgicalColor: "green",
      celebration: "CMS celebration",
      reflection: "CMS reflection",
      prayer: "CMS prayer",
      isReferenceOnly: true,
      sourceAttribution: "Approved lectionary source",
      sourceOrganization: "Source Org",
      sourcePublication: "Source Publication",
      sourceYear: 2026,
      sourceEdition: "Member edition",
    });
    expect(reading?.readings).toEqual([
      { id: "first", title: "First Reading", reference: "1 Thes 4:13-18", text: null, bibleReference: null },
      { id: "psalm", title: "Responsorial Psalm", reference: "Ps 96:1, 3-5, 11-13", text: null, bibleReference: null },
      { id: "gospel_acclamation", title: "Gospel Acclamation", reference: "Alleluia reference", text: null, bibleReference: null },
      { id: "gospel", title: "Gospel", reference: "Lk 4:16-30", text: null, bibleReference: null },
    ]);
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "rpc", operation: "get_member_daily_reading", args: [{ p_reading_date: "2026-08-31" }] }));
    expect(queryLog.some((entry) => entry.table === "content_daily_readings")).toBe(false);
  });

  it("uses deterministic language precedence before publication status", async () => {
    database.content_daily_readings = [
      { ...cmsBase, id: "en-featured", language_id: "en-language", status: "featured", reflection: "English featured" },
      { ...cmsBase, id: "sw-published", language_id: "sw-language", status: "published", reflection: "Swahili published" },
    ];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("sw-published");
  });

  it("falls back from Kiswahili to English, then NULL language", async () => {
    database.content_daily_readings = [
      { ...cmsBase, id: "null-language", language_id: null, reflection: "Neutral" },
      { ...cmsBase, id: "en-language", language_id: "en-language", reflection: "English" },
    ];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("en-language");

    database.content_daily_readings = [{ ...cmsBase, id: "null-language", language_id: null, reflection: "Neutral" }];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("null-language");
  });

  it("prefers featured over published inside one language and breaks ties deterministically", async () => {
    database.content_daily_readings = [
      { ...cmsBase, id: "sw-published-newer", status: "published", updated_at: "2026-08-31T12:00:00.000Z" },
      { ...cmsBase, id: "sw-featured-older", status: "featured", updated_at: "2026-08-30T12:00:00.000Z" },
    ];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("sw-featured-older");

    database.content_daily_readings = [
      { ...cmsBase, id: "z-same-status-id", status: "published", updated_at: "2026-08-31T12:00:00.000Z", created_at: "2026-08-30T12:00:00.000Z" },
      { ...cmsBase, id: "a-same-status-id", status: "published", updated_at: "2026-08-31T12:00:00.000Z", created_at: "2026-08-30T12:00:00.000Z" },
    ];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("a-same-status-id");
  });

  it("ignores draft, review, archived, pastoral, and admin CMS rows", async () => {
    database.content_daily_readings = [
      { ...cmsBase, id: "draft", status: "draft" },
      { ...cmsBase, id: "review", status: "review" },
      { ...cmsBase, id: "archived", status: "archived" },
      { ...cmsBase, id: "pastoral", visibility: "pastoral" },
      { ...cmsBase, id: "admin", visibility: "admin" },
    ];

    expect(await fetchPublishedDailyReading("2026-08-31")).toBeNull();
    expect(queryLog.some((entry) => entry.table === "daily_readings")).toBe(false);
  });

  it("uses liturgical day metadata over CMS fields while surviving absent liturgical rows", async () => {
    database.content_daily_readings = [cmsBase];
    database.liturgical_days = [{ id: "liturgical-day", date: "2026-08-31", season: "Authoritative Season", celebration: "Authoritative Celebration", liturgical_year: "A", liturgical_color: "white", weekday_cycle: "II", rank: "memorial", lectionary_number: "431" }];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.liturgicalSeason).toBe("Authoritative Season");

    database.liturgical_days = [];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.liturgicalSeason).toBe("Ordinary Time");
  });

  it("preserves canonical liturgical metadata without inventing absent optional fields", async () => {
    database.content_daily_readings = [{
      ...cmsBase,
      second_reading_reference: null,
      gospel_acclamation_reference: null,
      source_attribution: null,
      reflection: "   ",
      prayer: null,
    }];
    database.liturgical_days = [{
      id: "liturgical-day",
      date: "2026-08-31",
      season: "Advent",
      celebration: "Memorial",
      liturgical_year: "A",
      weekday_cycle: "I",
      liturgical_color: "purple",
      rank: "optional memorial",
      lectionary_number: "431",
    }];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading).toMatchObject({
      liturgicalDayId: "liturgical-day",
      celebration: "Memorial",
      liturgicalSeason: "Advent",
      liturgicalYear: "A",
      weekdayCycle: "I",
      liturgicalColor: "purple",
      rank: "optional memorial",
      lectionaryNumber: "431",
      reflection: null,
      prayer: null,
      sourceAttribution: null,
    });
    expect(reading?.readings.map((item) => item.id)).toEqual(["first", "psalm", "gospel"]);
  });

  it("falls back to explicit legacy compatibility only when no eligible CMS row exists", async () => {
    database.daily_readings = [legacyReading];
    database.daily_reading_passages = [
      { id: "passage-1", daily_reading_id: "legacy-reading", reading_kind: "gospel", title: "Gospel", reference: "Jn 1:1-5", text: "Legacy passage gospel text", book_id: null, chapter_start: null, verse_start: null, chapter_end: null, verse_end: null, sort_order: 4 },
    ];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading?.id).toBe("legacy-reading");
    expect(reading?.source).toBe("legacy");
    expect(reading?.liturgicalSeason).toBe("Legacy Season");
    expect(reading?.readings.find((item) => item.id === "gospel")?.text).toBe("Legacy passage gospel text");
    expect(reading?.sourceAttribution).toBeNull();
    expect(reading?.sourceOrganization).toBeNull();
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "daily_readings", operation: "eq", args: ["id", "legacy-reading"] }));
  });

  it("does not fabricate missing legacy references or CMS provenance", async () => {
    database.daily_readings = [{ ...legacyReading, first_reading: null, psalm: null, second_reading: null, gospel: null, reflection: null, prayer: null }];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading?.source).toBe("legacy");
    expect(reading?.sourceAttribution).toBeNull();
    expect(reading?.sourceOrganization).toBeNull();
    expect(reading?.sourcePublication).toBeNull();
    expect(reading?.sourceYear).toBeNull();
    expect(reading?.sourceEdition).toBeNull();
    expect(reading?.reflection).toBeNull();
    expect(reading?.prayer).toBeNull();
    expect(reading?.readings).toEqual([]);
  });

  it("never returns unpublished legacy and does not run a duplicate frontend CMS fallback", async () => {
    database.daily_readings = [{ ...legacyReading, is_published: false }];

    expect(await fetchPublishedDailyReading("2026-08-31")).toBeNull();
    expect(queryLog.some((entry) => entry.table === "daily_readings")).toBe(false);
    expect(queryLog.filter((entry) => entry.table === "rpc" && entry.operation === "get_member_daily_reading")).toHaveLength(1);
  });

  it("does not silently fall back when the canonical RPC errors", async () => {
    database.daily_readings = [legacyReading];
    tableErrors.rpc = { code: "42501", message: "permission denied", details: "RPC rejected row", hint: "Check RPC grant" };

    await expect(fetchPublishedDailyReading("2026-08-31")).rejects.toMatchObject({ code: "42501", message: "permission denied" });
    expect(queryLog.some((entry) => entry.table === "daily_readings")).toBe(false);
  });

  it("returns null for no published reading instead of throwing", async () => {
    await expect(fetchPublishedDailyReading("2026-08-31")).resolves.toBeNull();
  });

  it("handles optional second reading only when a CMS reference is present", async () => {
    database.content_daily_readings = [{ ...cmsBase, second_reading_reference: "Heb 12:1-4" }];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.readings.map((item) => item.id)).toEqual(["first", "psalm", "second", "gospel_acclamation", "gospel"]);

    database.content_daily_readings = [{ ...cmsBase, second_reading_reference: "   " }];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.readings.map((item) => item.id)).toEqual(["first", "psalm", "gospel_acclamation", "gospel"]);
  });

  it("handles optional gospel acclamation only when a CMS reference is present", async () => {
    database.content_daily_readings = [{ ...cmsBase, gospel_acclamation_reference: "Jn 6:63c, 68c" }];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.readings.map((item) => item.id)).toContain("gospel_acclamation");

    database.content_daily_readings = [{ ...cmsBase, gospel_acclamation_reference: "   " }];
    expect((await fetchPublishedDailyReading("2026-08-31"))?.readings.map((item) => item.id)).toEqual(["first", "psalm", "gospel"]);
  });

  it("does not emit synthetic reference-pending values from canonical data", async () => {
    database.content_daily_readings = [{
      ...cmsBase,
      first_reading_reference: "Daily reading reference pending",
      responsorial_psalm_reference: "Psalm reference pending",
      gospel_acclamation_reference: "Optional reading reference pending",
      gospel_reference: "Gospel reference pending",
    }];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.readings).toEqual([]);
  });

  it("uses the supplied Tanzania date key deterministically", async () => {
    database.content_daily_readings = [cmsBase, { ...cmsBase, id: "other-date", reading_date: "2026-09-01" }];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("cms-published");
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "rpc", operation: "get_member_daily_reading", args: [{ p_reading_date: "2026-08-31" }] }));
    expect(getDarEsSalaamDateKey(new Date("2026-08-30T21:30:00.000Z"))).toBe("2026-08-31");
  });
});
