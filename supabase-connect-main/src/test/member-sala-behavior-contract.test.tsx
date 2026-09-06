import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const database: Record<string, Row[]> = {};
const queryLog: Array<{ table: string; operation: string; args: unknown[] }> = [];
let tableError: Error | null = null;
let holdQueries = false;

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

class QueryMock implements PromiseLike<{ data: unknown; error: Error | null }> {
  private rows: Row[];
  private mode: "many" | "maybeSingle" = "many";

  constructor(private table: string) {
    this.rows = [...(database[table] ?? [])];
  }

  private log(operation: string, args: unknown[]) {
    queryLog.push({ table: this.table, operation, args });
    return this;
  }

  select(...args: unknown[]) { return this.log("select", args); }
  eq(column: string, value: unknown) { this.rows = this.rows.filter((row) => row[column] === value); return this.log("eq", [column, value]); }
  in(column: string, values: unknown[]) { this.rows = this.rows.filter((row) => values.includes(row[column])); return this.log("in", [column, values]); }
  order(...args: unknown[]) { return this.log("order", args); }
  maybeSingle() { this.mode = "maybeSingle"; return this.log("maybeSingle", []); }
  insert(...args: unknown[]) { return this.log("insert", args); }
  update(...args: unknown[]) { return this.log("update", args); }
  delete(...args: unknown[]) { return this.log("delete", args); }
  upsert(...args: unknown[]) { return this.log("upsert", args); }

  then<TResult1 = { data: unknown; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    if (holdQueries) return new Promise<{ data: unknown; error: Error | null }>(() => undefined).then(onfulfilled, onrejected);
    const data = this.mode === "many" ? this.rows : (this.rows[0] ?? null);
    return Promise.resolve({ data, error: tableError }).then(onfulfilled, onrejected);
  }
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => new QueryMock(table),
  },
}));

import PrayerDetailPage from "@/pages/portal/PrayerDetailPage";
import PrayersPage from "@/pages/portal/PrayersPage";

const publishedPrayer = {
  id: "prayer-1",
  title: "Sala ya Asubuhi",
  slug: "sala-ya-asubuhi",
  summary: "Sala fupi ya kuanza siku.",
  body: "Ee Bwana, niongoze leo.",
  status: "published",
  featured: false,
};

const featuredPrayer = {
  id: "prayer-2",
  title: "Sala ya Jioni",
  slug: "sala-ya-jioni",
  summary: null,
  body: "Asante kwa ulinzi wa siku hii.",
  status: "featured",
  featured: true,
};

const draftPrayer = {
  id: "prayer-3",
  title: "Draft Prayer",
  slug: "draft-prayer",
  summary: "Hidden",
  body: "Draft body",
  status: "draft",
  featured: false,
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function leafText(text: string) {
  return [...document.body.querySelectorAll<HTMLElement>("*")].filter(
    (element) => element.textContent?.trim() === text && ![...element.children].some((child) => child.textContent?.trim() === text),
  );
}

function roleCandidates(role: string) {
  const selector = role === "heading" ? "h1,h2,h3,h4,h5,h6,[role=heading]" : role === "button" ? "button,[role=button]" : role === "link" ? "a,[role=link]" : `[role=${role}]`;
  return [...document.body.querySelectorAll<HTMLElement>(selector)];
}

const waitFor = async (assertion: () => unknown, timeout = 3000) => {
  const started = Date.now();
  while (true) {
    try {
      return assertion();
    } catch (error) {
      if (Date.now() - started >= timeout) throw error;
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    }
  }
};

const screen = {
  getByText: (text: string) => {
    const element = leafText(text)[0];
    if (!element) throw new Error(`Text not found: ${text}`);
    return element;
  },
  queryByText: (text: string) => leafText(text)[0] ?? null,
  findByText: (text: string) => waitFor(() => screen.getByText(text)),
  getByRole: (role: string, options: { name?: string | RegExp; level?: number } = {}) => {
    const element = roleCandidates(role).find((candidate) => {
      const name = candidate.textContent?.trim() ?? "";
      const nameMatches = options.name === undefined || (typeof options.name === "string" ? name === options.name : options.name.test(name));
      const levelMatches = options.level === undefined || candidate.tagName === `H${options.level}`;
      return nameMatches && levelMatches;
    });
    if (!element) throw new Error(`Role not found: ${role}`);
    return element;
  },
  queryByRole: (role: string, options: { name?: string | RegExp; level?: number } = {}) => {
    try {
      return screen.getByRole(role, options);
    } catch {
      return null;
    }
  },
  findByRole: (role: string, options: { name?: string | RegExp; level?: number } = {}) => waitFor(() => screen.getByRole(role, options)),
};

function mount(path: string, routes: Array<{ path: string; element: ReactNode }>) {
  if (root) act(() => root!.unmount());
  container?.remove();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>));
  return router;
}

beforeEach(() => {
  for (const key of Object.keys(database)) delete database[key];
  queryLog.length = 0;
  tableError = null;
  holdQueries = false;
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("member Sala behavior contract", () => {
  it("keeps the approved member Sala routes and navigation label", () => {
    const routes = read("src/routes/MemberRoutes.tsx");
    const registry = read("src/lib/member-service-registry.ts");
    const layout = read("src/components/portal/PortalLayout.tsx");

    expect(routes).toContain('path="prayers"');
    expect(routes).toContain('path="prayers/:slug"');
    expect(registry).toContain('id: "prayers"');
    expect(registry).toContain('path: "/portal/prayers"');
    expect(registry).toContain('label: "Sala"');
    expect(registry).toContain("featureKey: null");
    expect(layout).toContain('url: "/portal/prayers"');
    expect(layout).toContain('titleKey: "Sala"');
  });

  it("keeps Sala separate from Prayer Requests and parish-specific submissions", () => {
    const queries = read("src/lib/content-display.ts");
    const pages = read("src/pages/portal/PrayersPage.tsx") + read("src/pages/portal/PrayerDetailPage.tsx");

    expect(queries).toContain('supabase.from("content_prayers" as never)');
    expect(queries).not.toMatch(/prayer_requests|create_prayer_request|submit_prayer_request/i);
    expect(queries).not.toContain("church_id");
    expect(pages).not.toMatch(/prayer-requests|Ombi la Maombi|Tuma Ombi/i);
  });

  it("preserves the read-only published and featured data contract", () => {
    const queries = read("src/lib/content-display.ts");
    const listPage = read("src/pages/portal/PrayersPage.tsx");
    const detailPage = read("src/pages/portal/PrayerDetailPage.tsx");

    expect(queries.match(/\.in\("status", \["published", "featured"\]\)/g)).toHaveLength(2);
    expect(queries).toContain('.eq("slug", slug)');
    expect(listPage).toContain('queryKey: ["published-prayers"]');
    expect(listPage).toContain("staleTime: 10 * 60 * 1000");
    expect(detailPage).toContain('queryKey: ["published-prayer", slug]');
    expect(queries).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  });

  it("does not introduce member write, admin CMS, fake media, or fake filtering controls", () => {
    const pages = read("src/pages/portal/PrayersPage.tsx") + read("src/pages/portal/PrayerDetailPage.tsx");
    const forbidden = /create prayer|edit prayer|delete prayer|approve prayer|publish controls|admin cms|audio player|favorite|bookmark|reading history|category filter|language filter/i;

    expect(pages).not.toMatch(forbidden);
  });

  it("lists published and featured prayers while excluding drafts", async () => {
    database.content_prayers = [publishedPrayer, featuredPrayer, draftPrayer];

    mount("/portal/prayers", [{ path: "/portal/prayers", element: <PrayersPage /> }]);

    expect(await screen.findByText("Sala ya Asubuhi")).toBeInTheDocument();
    expect(screen.getByText("Sala ya Jioni")).toBeInTheDocument();
    expect(screen.queryByText("Draft Prayer")).not.toBeInTheDocument();
    expect(screen.getByText("Imependekezwa")).toBeInTheDocument();
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "content_prayers", operation: "in", args: ["status", ["published", "featured"]] }));
    expect(queryLog).not.toContainEqual(expect.objectContaining({ operation: "insert" }));
    expect(queryLog).not.toContainEqual(expect.objectContaining({ operation: "update" }));
    expect(queryLog).not.toContainEqual(expect.objectContaining({ operation: "delete" }));
    expect(queryLog).not.toContainEqual(expect.objectContaining({ operation: "upsert" }));
  });

  it("renders prayer detail by slug and excludes unpublished slugs", async () => {
    database.content_prayers = [publishedPrayer, draftPrayer];

    mount("/portal/prayers/sala-ya-asubuhi", [{ path: "/portal/prayers/:slug", element: <PrayerDetailPage /> }]);

    expect(await screen.findByRole("heading", { name: "Sala ya Asubuhi", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Ee Bwana, niongoze leo.")).toBeInTheDocument();
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "content_prayers", operation: "eq", args: ["slug", "sala-ya-asubuhi"] }));
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "content_prayers", operation: "in", args: ["status", ["published", "featured"]] }));

    mount("/portal/prayers/draft-prayer", [{ path: "/portal/prayers/:slug", element: <PrayerDetailPage /> }]);

    expect(await screen.findByText("Sala haijapatikana.")).toBeInTheDocument();
    expect(screen.queryByText("Draft body")).not.toBeInTheDocument();
  });

  it("keeps calm empty, loading, error, and unavailable states", async () => {
    database.content_prayers = [];
    mount("/portal/prayers", [{ path: "/portal/prayers", element: <PrayersPage /> }]);
    expect(await screen.findByText("Hakuna sala iliyochapishwa kwa sasa.")).toBeInTheDocument();

    tableError = new Error("raw Supabase failure");
    mount("/portal/prayers", [{ path: "/portal/prayers", element: <PrayersPage /> }]);
    expect(await screen.findByText("Sala hazikuweza kupakiwa. Tafadhali jaribu tena.")).toBeInTheDocument();
    expect(screen.queryByText("raw Supabase failure")).not.toBeInTheDocument();

    holdQueries = true;
    tableError = null;
    mount("/portal/prayers", [{ path: "/portal/prayers", element: <PrayersPage /> }]);
    await waitFor(() => expect(document.body.querySelector("[data-sala-loading]")).toBeTruthy());

    holdQueries = false;
    database.content_prayers = [];
    mount("/portal/prayers/not-real", [{ path: "/portal/prayers/:slug", element: <PrayerDetailPage /> }]);
    expect(await screen.findByText("Sala haijapatikana.")).toBeInTheDocument();
  });

  it("protects mobile-safe wrapping for long prayer content", () => {
    const list = read("src/pages/portal/PrayersPage.tsx");
    const detail = read("src/pages/portal/PrayerDetailPage.tsx");

    expect(list).toContain("min-w-0");
    expect(list).toContain("break-words");
    expect(detail).toContain("whitespace-pre-wrap");
    expect(detail).toContain("break-words");
  });
});
