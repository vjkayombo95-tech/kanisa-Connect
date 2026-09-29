import { beforeEach, describe, expect, it, vi } from "vitest";

type ContributionRow = { id?: string; created_at?: string; church_id: string; member_id: string; amount: number | string | null };

const state = vi.hoisted(() => ({
  rows: [] as ContributionRow[],
  selects: [] as string[],
  filters: [] as Array<[string, string]>,
  orders: [] as string[],
  ranges: [] as Array<[number, number]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "contributions") throw new Error(`Unexpected table ${table}`);
      const localFilters: Array<[string, string]> = [];
      let startIso: string | null = null;
      let endIso: string | null = null;
      const builder = {
        select: (columns: string) => {
          state.selects.push(columns);
          return builder;
        },
        eq: (column: string, value: string) => {
          localFilters.push([column, value]);
          state.filters.push([column, value]);
          return builder;
        },
        gte: (column: string, value: string) => {
          if (column !== "created_at") throw new Error(`Unexpected gte column ${column}`);
          startIso = value;
          return builder;
        },
        lt: (column: string, value: string) => {
          if (column !== "created_at") throw new Error(`Unexpected lt column ${column}`);
          endIso = value;
          return builder;
        },
        order: (column: string) => {
          state.orders.push(column);
          return builder;
        },
        range: (from: number, to: number) => {
          state.ranges.push([from, to]);
          const rows = state.rows.filter((row) => {
            const matchesScope = localFilters.every(([key, expected]) => row[key as keyof ContributionRow] === expected);
            const createdAt = row.created_at ?? "";
            const matchesStart = !startIso || createdAt >= startIso;
            const matchesEnd = !endIso || createdAt < endIso;
            return matchesScope && matchesStart && matchesEnd;
          });
          return Promise.resolve({
            data: rows.slice(from, to + 1),
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
    state.orders.length = 0;
    state.ranges.length = 0;
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
    expect(state.orders).toEqual(["created_at", "id"]);
    expect(state.ranges).toEqual([[0, 499]]);
  });

  it("returns zero for no authorized contributions", async () => {
    state.rows = [{ church_id: "church-a", member_id: "member-b", amount: 9000 }];
    await expect(fetchMemberContributionTotal("church-a", "member-a")).resolves.toBe(0);
  });

  it("uses a plain authorized amount projection instead of a PostgREST aggregate", async () => {
    await fetchMemberContributionTotal("church-a", "member-a");
    expect(state.selects).toEqual(["id, created_at, amount"]);
    expect(state.selects.join(" ")).not.toMatch(/sum\(|amount\.sum|total:/);
  });
});
