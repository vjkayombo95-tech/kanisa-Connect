import { beforeEach, describe, expect, it, vi } from "vitest";

type ContributionRow = { church_id: string; member_id: string; amount: number | string | null };

const state = vi.hoisted(() => ({
  rows: [] as ContributionRow[],
  selects: [] as string[],
  filters: [] as Array<[string, string]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "contributions") throw new Error(`Unexpected table ${table}`);
      const localFilters: Array<[string, string]> = [];
      const builder = {
        select: (columns: string) => {
          state.selects.push(columns);
          return builder;
        },
        eq: (column: string, value: string) => {
          localFilters.push([column, value]);
          state.filters.push([column, value]);
          if (localFilters.length < 2) return builder;
          return Promise.resolve({
            data: state.rows.filter((row) => localFilters.every(([key, expected]) => row[key as keyof ContributionRow] === expected)),
            error: null,
          });
        },
      };
      return builder;
    },
  },
}));

import { fetchMemberContributionTotal } from "@/lib/member-contributions";

describe("portal member contribution summary", () => {
  beforeEach(() => {
    state.rows = [];
    state.selects.length = 0;
    state.filters.length = 0;
  });

  it("sums multiple own contributions and excludes same-church and foreign-church rows", async () => {
    state.rows = [
      { church_id: "church-a", member_id: "member-a", amount: 1000 },
      { church_id: "church-a", member_id: "member-a", amount: "2500" },
      { church_id: "church-a", member_id: "member-b", amount: 9000 },
      { church_id: "church-b", member_id: "member-a", amount: 8000 },
    ];

    await expect(fetchMemberContributionTotal("church-a", "member-a")).resolves.toBe(3500);
    expect(state.filters).toEqual([["church_id", "church-a"], ["member_id", "member-a"]]);
  });

  it("returns zero for no authorized contributions", async () => {
    state.rows = [{ church_id: "church-a", member_id: "member-b", amount: 9000 }];
    await expect(fetchMemberContributionTotal("church-a", "member-a")).resolves.toBe(0);
  });

  it("uses a plain authorized amount projection instead of a PostgREST aggregate", async () => {
    await fetchMemberContributionTotal("church-a", "member-a");
    expect(state.selects).toEqual(["amount"]);
    expect(state.selects.join(" ")).not.toMatch(/sum\(|amount\.sum|total:/);
  });
});
