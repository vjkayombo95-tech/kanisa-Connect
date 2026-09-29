import { beforeEach, describe, expect, it, vi } from "vitest";

type MockContributionRow = {
  id?: string;
  created_at?: string;
  amount: number | string | null;
};

type MockContributionQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  queries: [] as MockContributionQuery[],
  pages: [] as Array<{ data: MockContributionRow[] | null; error: Error | null }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import {
  MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE,
  fetchMemberContributionTotalForRange,
  getMemberContributionRangeBounds,
} from "@/lib/member-contributions";

function createRows(count: number, amount: number | string | null): MockContributionRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `contribution-${index}`,
    created_at: `2026-09-28T00:${String(index % 60).padStart(2, "0")}:00.000Z`,
    amount,
  }));
}

function createQuery(): MockContributionQuery {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    then: vi.fn(),
  } as MockContributionQuery;

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.then.mockImplementation((resolve: (value: { data: MockContributionRow[] | null; error: Error | null }) => unknown) => {
    const page = mocks.pages.shift() ?? { data: [], error: null };
    return Promise.resolve(resolve(page));
  });

  mocks.queries.push(query);
  return query;
}

describe("member Uliza Kanisa contribution range helper", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.queries = [];
    mocks.pages = [{ data: createRows(1, 12000), error: null }];
    mocks.from.mockImplementation(() => createQuery());
  });

  it("always scopes contribution totals by church_id", async () => {
    await fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time");

    expect(mocks.from).toHaveBeenCalledWith("contributions");
    expect(mocks.queries[0].eq).toHaveBeenCalledWith("church_id", "church-current");
  });

  it("always scopes contribution totals by member_id", async () => {
    await fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time");

    expect(mocks.queries[0].eq).toHaveBeenCalledWith("member_id", "member-linked");
  });

  it("fetches multiple contribution pages and sums all amounts", async () => {
    mocks.pages = [
      { data: createRows(MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE, 10), error: null },
      { data: createRows(2, 25), error: null },
    ];

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).resolves.toBe(5050);
    expect(mocks.queries).toHaveLength(2);
    expect(mocks.queries[0].range).toHaveBeenCalledWith(0, MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE - 1);
    expect(mocks.queries[1].range).toHaveBeenCalledWith(MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE, (MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE * 2) - 1);
  });

  it("keeps church_id and member_id filters on subsequent pages", async () => {
    mocks.pages = [
      { data: createRows(MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE, 1), error: null },
      { data: createRows(1, 1), error: null },
    ];

    await fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time");

    expect(mocks.queries[1].eq).toHaveBeenCalledWith("church_id", "church-current");
    expect(mocks.queries[1].eq).toHaveBeenCalledWith("member_id", "member-linked");
  });

  it("preserves date filters across paginated range queries", async () => {
    mocks.pages = [
      { data: createRows(MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE, 1), error: null },
      { data: createRows(1, 1), error: null },
    ];

    await fetchMemberContributionTotalForRange("church-current", "member-linked", "today", new Date("2026-09-28T09:00:00Z"));

    for (const query of mocks.queries) {
      expect(query.gte).toHaveBeenCalledWith("created_at", "2026-09-27T21:00:00.000Z");
      expect(query.lt).toHaveBeenCalledWith("created_at", "2026-09-28T21:00:00.000Z");
    }
  });

  it("stops pagination when a short page is returned", async () => {
    mocks.pages = [{ data: createRows(2, 15), error: null }];

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).resolves.toBe(30);
    expect(mocks.queries).toHaveLength(1);
  });

  it("rejects database errors from later pages without returning a partial total", async () => {
    mocks.pages = [
      { data: createRows(MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE, 10), error: null },
      { data: null, error: new Error("later page failed") },
    ];

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).rejects.toThrow("later page failed");
  });

  it("rejects when the pagination safety limit is exhausted instead of returning a partial total", async () => {
    mocks.pages = Array.from({ length: 1000 }, () => ({
      data: createRows(MEMBER_CONTRIBUTION_TOTAL_PAGE_SIZE, 1),
      error: null,
    }));

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).rejects.toThrow("Contribution total pagination exceeded the safety limit.");
    expect(mocks.queries).toHaveLength(1000);
  });

  it("returns zero for no contribution records", async () => {
    mocks.pages = [{ data: [], error: null }];

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).resolves.toBe(0);
  });

  it("does not produce NaN for null amounts", async () => {
    mocks.pages = [{ data: createRows(1, null), error: null }];

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).resolves.toBe(0);
  });

  it("does not produce NaN for invalid amounts", async () => {
    mocks.pages = [{ data: createRows(1, "not-a-number"), error: null }];

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).resolves.toBe(0);
  });

  it("handles numeric-string amounts", async () => {
    mocks.pages = [{ data: createRows(2, "1250.50"), error: null }];

    await expect(fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time")).resolves.toBe(2501);
  });

  it("does not add created_at bounds for all-time contribution totals", async () => {
    await fetchMemberContributionTotalForRange("church-current", "member-linked", "all_time");

    expect(mocks.queries[0].gte).not.toHaveBeenCalled();
    expect(mocks.queries[0].lt).not.toHaveBeenCalled();
  });

  it("uses Tanzania-local today boundaries for created_at", async () => {
    await fetchMemberContributionTotalForRange("church-current", "member-linked", "today", new Date("2026-09-28T09:00:00Z"));

    expect(mocks.queries[0].gte).toHaveBeenCalledWith("created_at", "2026-09-27T21:00:00.000Z");
    expect(mocks.queries[0].lt).toHaveBeenCalledWith("created_at", "2026-09-28T21:00:00.000Z");
  });

  it("starts the contribution week on Monday in Tanzania", () => {
    expect(getMemberContributionRangeBounds("this_week", new Date("2026-10-01T12:00:00Z"))).toEqual({
      startIso: "2026-09-27T21:00:00.000Z",
      endIso: "2026-10-04T21:00:00.000Z",
    });
  });

  it("uses Tanzania-local month boundaries", async () => {
    await fetchMemberContributionTotalForRange("church-current", "member-linked", "this_month", new Date("2026-09-15T12:00:00Z"));

    expect(mocks.queries[0].gte).toHaveBeenCalledWith("created_at", "2026-08-31T21:00:00.000Z");
    expect(mocks.queries[0].lt).toHaveBeenCalledWith("created_at", "2026-09-30T21:00:00.000Z");
  });

  it("treats a UTC Sunday night rollover as Monday in Tanzania", () => {
    expect(getMemberContributionRangeBounds("today", new Date("2026-09-27T21:30:00Z"))).toEqual({
      startIso: "2026-09-27T21:00:00.000Z",
      endIso: "2026-09-28T21:00:00.000Z",
    });
  });

  it("handles Dec 31 to Jan 1 Tanzania-local day boundaries", () => {
    expect(getMemberContributionRangeBounds("today", new Date("2026-12-31T22:30:00Z"))).toEqual({
      startIso: "2026-12-31T21:00:00.000Z",
      endIso: "2027-01-01T21:00:00.000Z",
    });
  });
});
