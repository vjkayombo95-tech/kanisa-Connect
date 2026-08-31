import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type QueryError = { code?: string; message: string; details?: string; hint?: string };

const database: Record<string, Row[]> = {};
const tableErrors: Record<string, QueryError | null> = {};
const queryLog: Array<{ table: string; operation: string; args: unknown[] }> = [];

class QueryMock implements PromiseLike<{ data: unknown; error: QueryError | null }> {
  private rows: Row[];
  private mode: "many" | "maybeSingle" = "many";
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;

  constructor(private table: string) {
    this.rows = [...(database[table] ?? [])];
  }

  private log(operation: string, args: unknown[]) {
    queryLog.push({ table: this.table, operation, args });
    return this;
  }

  select(...args: unknown[]) {
    return this.log("select", args);
  }

  eq(column: string, value: unknown) {
    this.rows = this.rows.filter((row) => row[column] === value);
    return this.log("eq", [column, value]);
  }

  in(column: string, values: unknown[]) {
    this.rows = this.rows.filter((row) => values.includes(row[column]));
    return this.log("in", [column, values]);
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this.log("order", [column, options]);
  }

  limit(count: number) {
    this.limitCount = count;
    return this.log("limit", [count]);
  }

  maybeSingle() {
    this.mode = "maybeSingle";
    return this.log("maybeSingle", []);
  }

  private materializeRows() {
    const sorted = this.orders.length
      ? [...this.rows].sort((left, right) => {
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
        })
      : this.rows;

    return this.limitCount == null ? sorted : sorted.slice(0, this.limitCount);
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
    from: (table: string) => new QueryMock(table),
  },
}));

import { fetchPublishedDailyReading, getDarEsSalaamDateKey } from "@/lib/daily-readings";

const cmsBase = {
  id: "cms-published",
  reading_date: "2026-08-31",
  liturgical_season: "Ordinary Time",
  first_reading_reference: "1 Thes 4:13-18",
  responsorial_psalm_reference: "Ps 96:1, 3-5, 11-13",
  second_reading_reference: null,
  gospel_reference: "Lk 4:16-30",
  reflection: "CMS reflection",
  prayer: "CMS prayer",
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
};

beforeEach(() => {
  for (const key of Object.keys(database)) delete database[key];
  for (const key of Object.keys(tableErrors)) delete tableErrors[key];
  queryLog.length = 0;
  database.content_daily_readings = [];
  database.daily_readings = [];
  database.daily_reading_passages = [];
});

describe("fetchPublishedDailyReading CMS-first behavior", () => {
  it("returns a published CMS reading in the existing DailyReadingEntry shape", async () => {
    database.content_daily_readings = [cmsBase];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading).toMatchObject({
      id: "cms-published",
      date: "2026-08-31",
      liturgicalSeason: "Ordinary Time",
      reflection: "CMS reflection",
      prayer: "CMS prayer",
    });
    expect(reading?.readings).toEqual([
      { id: "first", title: "First Reading", reference: "1 Thes 4:13-18", text: null },
      { id: "psalm", title: "Responsorial Psalm", reference: "Ps 96:1, 3-5, 11-13", text: null },
      { id: "gospel", title: "Gospel", reference: "Lk 4:16-30", text: null },
    ]);
  });

  it("prefers featured CMS rows over published rows deterministically", async () => {
    database.content_daily_readings = [
      { ...cmsBase, id: "aaa-published-would-win-by-id", status: "published", updated_at: "2026-08-31T12:00:00.000Z" },
      { ...cmsBase, id: "zzz-featured-must-win-by-status", status: "featured", reflection: "Featured reflection", updated_at: "2026-08-30T12:00:00.000Z" },
    ];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading?.id).toBe("zzz-featured-must-win-by-status");
    expect(reading?.reflection).toBe("Featured reflection");
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "content_daily_readings", operation: "order", args: ["status", { ascending: true }] }));
  });

  it("orders same-status CMS rows by updated_at, then created_at, then id", async () => {
    database.content_daily_readings = [
      {
        ...cmsBase,
        id: "same-status-older-update",
        status: "published",
        reflection: "Older update",
        updated_at: "2026-08-30T12:00:00.000Z",
        created_at: "2026-08-30T12:00:00.000Z",
      },
      {
        ...cmsBase,
        id: "same-status-newer-update",
        status: "published",
        reflection: "Newest update",
        updated_at: "2026-08-31T12:00:00.000Z",
        created_at: "2026-08-29T12:00:00.000Z",
      },
    ];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("same-status-newer-update");

    database.content_daily_readings = [
      {
        ...cmsBase,
        id: "same-status-older-create",
        status: "published",
        reflection: "Older create",
        updated_at: "2026-08-31T12:00:00.000Z",
        created_at: "2026-08-29T12:00:00.000Z",
      },
      {
        ...cmsBase,
        id: "same-status-newer-create",
        status: "published",
        reflection: "Newest create",
        updated_at: "2026-08-31T12:00:00.000Z",
        created_at: "2026-08-30T12:00:00.000Z",
      },
    ];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("same-status-newer-create");

    database.content_daily_readings = [
      {
        ...cmsBase,
        id: "z-same-status-id",
        status: "published",
        reflection: "Later id",
        updated_at: "2026-08-31T12:00:00.000Z",
        created_at: "2026-08-30T12:00:00.000Z",
      },
      {
        ...cmsBase,
        id: "a-same-status-id",
        status: "published",
        reflection: "Earlier id",
        updated_at: "2026-08-31T12:00:00.000Z",
        created_at: "2026-08-30T12:00:00.000Z",
      },
    ];

    expect((await fetchPublishedDailyReading("2026-08-31"))?.id).toBe("a-same-status-id");
  });

  it("ignores draft, review, and archived CMS rows", async () => {
    database.content_daily_readings = [
      { ...cmsBase, id: "draft", status: "draft" },
      { ...cmsBase, id: "review", status: "review" },
      { ...cmsBase, id: "archived", status: "archived" },
    ];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading).toBeNull();
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "daily_readings", operation: "maybeSingle" }));
  });

  it("prefers CMS over legacy when both exist", async () => {
    database.content_daily_readings = [cmsBase];
    database.daily_readings = [legacyReading];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading?.id).toBe("cms-published");
    expect(queryLog.some((entry) => entry.table === "daily_readings")).toBe(false);
  });

  it("falls back to legacy when no eligible CMS row exists", async () => {
    database.daily_readings = [legacyReading];
    database.daily_reading_passages = [
      {
        id: "passage-1",
        daily_reading_id: "legacy-reading",
        reading_kind: "gospel",
        title: "Gospel",
        reference: "Jn 1:1-5",
        text: "Legacy passage gospel text",
        book_id: null,
        chapter_start: null,
        verse_start: null,
        chapter_end: null,
        verse_end: null,
        sort_order: 4,
      },
    ];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading?.id).toBe("legacy-reading");
    expect(reading?.liturgicalSeason).toBe("Legacy Season");
    expect(reading?.readings.find((item) => item.id === "gospel")?.text).toBe("Legacy passage gospel text");
  });

  it("does not silently fall back when the CMS query errors", async () => {
    database.daily_readings = [legacyReading];
    tableErrors.content_daily_readings = { code: "42501", message: "permission denied", details: "RLS rejected row", hint: "Check CMS policy" };

    await expect(fetchPublishedDailyReading("2026-08-31")).rejects.toMatchObject({
      code: "42501",
      message: "permission denied",
      details: "RLS rejected row",
      hint: "Check CMS policy",
    });
    expect(queryLog.some((entry) => entry.table === "daily_readings")).toBe(false);
  });

  it("handles optional second reading only when a CMS reference is present", async () => {
    database.content_daily_readings = [{ ...cmsBase, second_reading_reference: "Heb 12:1-4" }];

    const readingWithSecond = await fetchPublishedDailyReading("2026-08-31");
    expect(readingWithSecond?.readings.map((item) => item.id)).toEqual(["first", "psalm", "second", "gospel"]);

    database.content_daily_readings = [{ ...cmsBase, second_reading_reference: "   " }];
    const readingWithoutSecond = await fetchPublishedDailyReading("2026-08-31");
    expect(readingWithoutSecond?.readings.map((item) => item.id)).toEqual(["first", "psalm", "gospel"]);
  });

  it("handles empty reflection, prayer, and required references safely", async () => {
    database.content_daily_readings = [
      {
        ...cmsBase,
        first_reading_reference: "",
        responsorial_psalm_reference: "",
        gospel_reference: "",
        reflection: null,
        prayer: null,
      },
    ];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading?.reflection).toBe("");
    expect(reading?.prayer).toBe("");
    expect(reading?.readings.map((item) => item.reference)).toEqual([
      "Daily reading reference pending",
      "Psalm reference pending",
      "Gospel reference pending",
    ]);
  });

  it("uses the supplied date key deterministically", async () => {
    database.content_daily_readings = [cmsBase, { ...cmsBase, id: "other-date", reading_date: "2026-09-01" }];

    const reading = await fetchPublishedDailyReading("2026-08-31");

    expect(reading?.id).toBe("cms-published");
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "content_daily_readings", operation: "eq", args: ["reading_date", "2026-08-31"] }));
    expect(getDarEsSalaamDateKey(new Date("2026-08-30T21:30:00.000Z"))).toBe("2026-08-31");
  });
});
