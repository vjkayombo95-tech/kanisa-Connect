import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const database: Record<string, Row[]> = {};
const queryLog: Array<{ table: string; operation: string; args: unknown[] }> = [];

class QueryMock implements PromiseLike<{ data: unknown; error: null }> {
  private rows: Row[];
  private mode: "many" | "single" | "maybeSingle" = "many";
  constructor(private table: string) { this.rows = [...(database[table] ?? [])]; }
  private log(operation: string, args: unknown[]) { queryLog.push({ table: this.table, operation, args }); return this; }
  select(...args: unknown[]) { return this.log("select", args); }
  eq(column: string, value: unknown) { this.rows = this.rows.filter((row) => row[column] === value); return this.log("eq", [column, value]); }
  in(column: string, values: unknown[]) { this.rows = this.rows.filter((row) => values.includes(row[column])); return this.log("in", [column, values]); }
  not(column: string, operator: string, value: unknown) { if (operator === "is" && value === null) this.rows = this.rows.filter((row) => row[column] != null); return this.log("not", [column, operator, value]); }
  order(...args: unknown[]) { return this.log("order", args); }
  limit(count: number) { this.rows = this.rows.slice(0, count); return this.log("limit", [count]); }
  range(...args: unknown[]) { return this.log("range", args); }
  gte(...args: unknown[]) { return this.log("gte", args); }
  lte(...args: unknown[]) { return this.log("lte", args); }
  or(...args: unknown[]) { return this.log("or", args); }
  single() { this.mode = "single"; return this.log("single", []); }
  maybeSingle() { this.mode = "maybeSingle"; return this.log("maybeSingle", []); }
  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    const data = this.mode === "many" ? this.rows : (this.rows[0] ?? null);
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => new QueryMock(table) } }));

import ReflectionsPage from "@/pages/portal/ReflectionsPage";
import ReflectionDetailPage from "@/pages/portal/ReflectionDetailPage";
import PrayersPage from "@/pages/portal/PrayersPage";
import PrayerDetailPage from "@/pages/portal/PrayerDetailPage";
import MemberSaintDetailsPage from "@/pages/portal/MemberSaintDetailsPage";
import MemberBibleHomePage from "@/pages/portal/MemberBibleHomePage";
import MemberBibleBookPage from "@/pages/portal/MemberBibleBookPage";
import MemberBibleChapterPage from "@/pages/portal/MemberBibleChapterPage";
import DailyReadingsPage from "@/pages/portal/DailyReadingsPage";
import LiturgicalCalendarPage from "@/pages/portal/LiturgicalCalendarPage";

const reflection = { id: "11111111-1111-4111-8111-111111111111", reading_date: "2026-08-14", liturgical_season: "Ordinary Time", gospel: "Gospel context", reflection: "Published reflection body", is_published: true };
const publishedPrayer = { id: "p1", title: "Evening Prayer", slug: "evening-prayer", summary: "At day end", body: "Published prayer body", status: "published", featured: false };
const draftPrayer = { id: "p2", title: "Draft Secret", slug: "draft-secret", summary: "Hidden", body: "Unpublished secret body", status: "draft", featured: false };
const saint = { id: "a5a01a73-d580-4669-b372-1c5872fda7bb", slug: "st-paul", name: "Saint Paul", title: "Apostle", feast_month: 6, feast_day: 29, patron_of: "Missionaries", country: "Tarsus", biography_short: "Short life", biography_long: "Long life", quote: null, reflection: "Saint reflection", prayer: "Saint prayer", image_url: null, color_theme: null, liturgical_rank: null, is_featured: false, scripture_reference: "Acts 9", tags: [], is_active: true };

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function candidatesByText(text: string) {
  return [...document.body.querySelectorAll<HTMLElement>("*")].filter((element) => element.textContent?.trim() === text && ![...element.children].some((child) => child.textContent?.trim() === text));
}
function roleCandidates(role: string) {
  const selector = role === "heading" ? "h1,h2,h3,h4,h5,h6,[role=heading]" : role === "button" ? "button,[role=button]" : role === "link" ? "a,[role=link]" : `[role=${role}]`;
  return [...document.body.querySelectorAll<HTMLElement>(selector)];
}
const waitFor = async (assertion: () => unknown, timeout = 3000) => {
  const started = Date.now();
  while (true) {
    try { return assertion(); } catch (error) { if (Date.now() - started >= timeout) throw error; await act(() => new Promise((resolve) => setTimeout(resolve, 20))); }
  }
};
const screen = {
  getByText: (text: string) => { const element = candidatesByText(text)[0]; if (!element) throw new Error(`Text not found: ${text}`); return element; },
  queryByText: (text: string) => candidatesByText(text)[0] ?? null,
  findByText: (text: string) => waitFor(() => screen.getByText(text)),
  getByRole: (role: string, options: { name?: string | RegExp; level?: number } = {}) => { const element = roleCandidates(role).find((candidate) => { const name = candidate.textContent?.trim() ?? ""; const nameMatches = options.name === undefined || (typeof options.name === "string" ? name === options.name : options.name.test(name)); const levelMatches = options.level === undefined || candidate.tagName === `H${options.level}`; return nameMatches && levelMatches; }); if (!element) throw new Error(`Role not found: ${role}`); return element; },
  queryByRole: (role: string, options: { name?: string | RegExp; level?: number } = {}) => { try { return screen.getByRole(role, options); } catch { return null; } },
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
  database.daily_reading_passages = [];
  database.saints = [];
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("Wave 4C behavioral content boundaries", () => {
  it("renders a published reflection list through the publication predicate without audio surfaces", async () => {
    database.daily_readings = [reflection];
    mount("/portal/reflections", [{ path: "/portal/reflections", element: <ReflectionsPage /> }]);
    expect(await screen.findByText("Published reflection body")).toBeInTheDocument();
    expect(screen.getByText("Ordinary Time")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play|listen|audio/i })).not.toBeInTheDocument();
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "daily_readings", operation: "eq", args: ["is_published", true] }));
  });

  it("direct-mounts published reflection detail and clears it after invalid navigation", async () => {
    database.daily_readings = [reflection];
    mount(`/portal/reflections/${reflection.id}`, [{ path: "/portal/reflections/:reflectionId", element: <ReflectionDetailPage /> }]);
    expect(await screen.findByText("Published reflection body")).toBeInTheDocument();
    database.daily_readings = [];
    mount("/portal/reflections/22222222-2222-4222-8222-222222222222", [{ path: "/portal/reflections/:reflectionId", element: <ReflectionDetailPage /> }]);
    expect(await screen.findByText("Tafakari haijapatikana.")).toBeInTheDocument();
    expect(screen.queryByText("Published reflection body")).not.toBeInTheDocument();
  });

  it("shows only published prayers and applies the production status filter", async () => {
    database.content_prayers = [publishedPrayer, draftPrayer];
    mount("/portal/prayers", [{ path: "/portal/prayers", element: <PrayersPage /> }]);
    expect(await screen.findByText("Evening Prayer")).toBeInTheDocument();
    expect(screen.queryByText("Draft Secret")).not.toBeInTheDocument();
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "content_prayers", operation: "in", args: ["status", ["published", "featured"]] }));
  });

  it("renders published prayer detail on direct mount and clears it for unpublished content", async () => {
    database.content_prayers = [publishedPrayer, draftPrayer];
    mount("/portal/prayers/evening-prayer", [{ path: "/portal/prayers/:slug", element: <PrayerDetailPage /> }]);
    expect(await screen.findByText("Published prayer body")).toBeInTheDocument();
    mount("/portal/prayers/draft-secret", [{ path: "/portal/prayers/:slug", element: <PrayerDetailPage /> }]);
    expect(await screen.findByText("Sala haijapatikana.")).toBeInTheDocument();
    expect(screen.queryByText("Published prayer body")).not.toBeInTheDocument();
    expect(screen.queryByText("Unpublished secret body")).not.toBeInTheDocument();
    expect(queryLog).toContainEqual(expect.objectContaining({ operation: "eq", args: ["slug", "draft-secret"] }));
  });

  it("renders a safe unavailable state for an invalid prayer slug", async () => {
    database.content_prayers = [];
    mount("/portal/prayers/not-real", [{ path: "/portal/prayers/:slug", element: <PrayerDetailPage /> }]);
    expect(await screen.findByText("Sala haijapatikana.")).toBeInTheDocument();
  });

  it("direct-mounts the saints ID alias with the existing data contract", async () => {
    database.saints = [saint];
    mount(`/portal/saints/${saint.id}`, [{ path: "/portal/saints/:saintId", element: <MemberSaintDetailsPage /> }]);
    expect(await screen.findByRole("heading", { name: "Saint Paul", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Long life")).toBeInTheDocument();
    expect(queryLog).toContainEqual(expect.objectContaining({ table: "saints", operation: "eq", args: ["id", saint.id] }));
  });

  it("shows a safe invalid saint state without a redirect loop", async () => {
    database.saints = [];
    mount("/portal/saints/00000000-0000-4000-8000-000000000000", [{ path: "/portal/saints/:saintId", element: <MemberSaintDetailsPage /> }]);
    expect(await screen.findByText("Saint not found.")).toBeInTheDocument();
  });

  it("behaviorally mounts the existing Bible route hierarchy", async () => {
    database.bible_books = [{ id: "book-1", book_number: 1, name: "Genesis", abbreviation: "Gen", testament: "old" }];
    database.bible_chapters = [{ id: "chapter-1", book_id: "book-1", chapter_number: 1 }];
    database.bible_verses = [{ id: "verse-1", book_id: "book-1", chapter_number: 1, verse_number: 1, verse_text: "In the beginning", text: null }];
    mount("/portal/bible", [{ path: "/portal/bible", element: <MemberBibleHomePage /> }]);
    expect(await screen.findByText("Genesis")).toBeInTheDocument();
  });

  it("behaviorally mounts Bible book and chapter direct routes", async () => {
    database.bible_books = [{ id: "book-1", book_number: 1, name: "Genesis", abbreviation: "Gen", testament: "old" }];
    database.bible_chapters = [{ id: "chapter-1", book_id: "book-1", chapter_number: 1 }];
    database.bible_verses = [{ id: "verse-1", book_id: "book-1", chapter_number: 1, verse_number: 1, verse_text: "In the beginning", text: null }];
    mount("/portal/bible/book-1", [{ path: "/portal/bible/:bookId", element: <MemberBibleBookPage /> }]);
    expect(await screen.findByText("Chapter 1")).toBeInTheDocument();
    mount("/portal/bible/book-1/chapter/1", [{ path: "/portal/bible/:bookId/chapter/:chapterNumber", element: <MemberBibleChapterPage /> }]);
    expect(await screen.findByRole("heading", { name: "Genesis", level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(queryLog.some((entry) => entry.table === "bible_verses" && entry.operation === "eq")).toBe(true));
  });

  it("fails closed when no published daily reading exists", async () => {
    database.daily_readings = [];
    mount("/portal/daily-readings", [{ path: "/portal/daily-readings", element: <DailyReadingsPage /> }]);
    expect(await screen.findByRole("heading", { name: "Masomo ya leo hayajapatikana" })).toBeInTheDocument();
    await waitFor(() => expect(queryLog).toContainEqual(expect.objectContaining({ table: "daily_readings", operation: "eq", args: ["is_published", true] })));
  });

  it("mounts the liturgical calendar regression surface", async () => {
    database.saints = [saint];
    mount("/portal/liturgical-calendar", [{ path: "/portal/liturgical-calendar", element: <LiturgicalCalendarPage /> }]);
    expect(await screen.findByRole("heading", { name: "Kalenda ya Liturujia" })).toBeInTheDocument();
  });

  it("exposes no audio, import, favorite, history, bookmark, note, or translation controls", async () => {
    database.daily_readings = [reflection]; database.content_prayers = [publishedPrayer];
    mount("/portal/reflections", [{ path: "/portal/reflections", element: <ReflectionsPage /> }]);
    await screen.findByText("Published reflection body");
    const forbidden = /audio|listen|import|favorite|history|bookmark|notes?|translation management/i;
    expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: forbidden })).not.toBeInTheDocument();
  });
});
