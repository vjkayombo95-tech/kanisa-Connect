import { beforeEach, describe, expect, it, vi } from "vitest";

type MockCountQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  then: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  queries: [] as MockCountQuery[],
  results: [] as Array<{ count: number | null; error: Error | null }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { fetchOwnMassIntentionsSummary } from "@/lib/member-linked-requests";

function createQuery(): MockCountQuery {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    then: vi.fn(),
  } as MockCountQuery;

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.then.mockImplementation((resolve: (value: { count: number | null; error: Error | null }) => unknown) => {
    const result = mocks.results.shift() ?? { count: 0, error: null };
    return Promise.resolve(resolve(result));
  });
  mocks.queries.push(query);
  return query;
}

describe("member Uliza Kanisa own Mass Intentions summary helper", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.queries = [];
    mocks.results = [
      { count: 1, error: null },
      { count: 2, error: null },
      { count: 3, error: null },
      { count: 4, error: null },
      { count: 5, error: null },
      { count: 6, error: null },
    ];
    mocks.from.mockImplementation(() => createQuery());
  });

  it("uses exact head counts for complete status totals", async () => {
    await expect(fetchOwnMassIntentionsSummary("church-current", "member-linked")).resolves.toEqual({
      total: 21,
      pending: 1,
      approved: 2,
      rejected: 3,
      scheduled: 4,
      completed: 5,
      archived: 6,
    });

    for (const query of mocks.queries) {
      expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    }
  });

  it("scopes every status count by church_id and member_id", async () => {
    await fetchOwnMassIntentionsSummary("church-current", "member-linked");

    for (const query of mocks.queries) {
      expect(query.eq).toHaveBeenCalledWith("church_id", "church-current");
      expect(query.eq).toHaveBeenCalledWith("member_id", "member-linked");
    }
  });

  it("counts only verified Mass Intention statuses", async () => {
    await fetchOwnMassIntentionsSummary("church-current", "member-linked");

    expect(mocks.queries[0].eq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.queries[1].eq).toHaveBeenCalledWith("status", "approved");
    expect(mocks.queries[2].eq).toHaveBeenCalledWith("status", "rejected");
    expect(mocks.queries[3].eq).toHaveBeenCalledWith("status", "scheduled");
    expect(mocks.queries[4].eq).toHaveBeenCalledWith("status", "completed");
    expect(mocks.queries[5].eq).toHaveBeenCalledWith("status", "archived");
  });

  it("propagates database errors instead of returning partial counts", async () => {
    mocks.results = [
      { count: 1, error: null },
      { count: null, error: new Error("count failed") },
      { count: 3, error: null },
      { count: 4, error: null },
      { count: 5, error: null },
      { count: 6, error: null },
    ];

    await expect(fetchOwnMassIntentionsSummary("church-current", "member-linked")).rejects.toThrow("count failed");
  });
});
