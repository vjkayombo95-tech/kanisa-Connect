import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/i18n";
import { formatAppDate } from "@/lib/localization";

const state = vi.hoisted(() => ({
  mode: "data" as "data" | "empty" | "error" | "loading",
  featureKeys: [] as string[],
  queries: [] as Array<{
    table: string;
    filters: Array<{ method: "eq" | "is"; column: string; value: unknown }>;
    order?: { column: string; options: unknown };
  }>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a" }),
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isFeatureEnabled: (featureKey: string) => {
      state.featureKeys.push(featureKey);
      return featureKey === "sermons";
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        table,
        filters: [] as Array<{ method: "eq" | "is"; column: string; value: unknown }>,
        order: undefined as { column: string; options: unknown } | undefined,
      };
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          query.filters.push({ method: "eq", column, value });
          return builder;
        },
        is: (column: string, value: unknown) => {
          query.filters.push({ method: "is", column, value });
          return builder;
        },
        order: async (column: string, options: unknown) => {
          query.order = { column, options };
          state.queries.push(query);
          if (state.mode === "loading") {
            return new Promise(() => undefined);
          }
          if (state.mode === "error") {
            return { data: null, error: new Error("sermons failed") };
          }
          if (state.mode === "empty") {
            return { data: [], error: null };
          }
          return {
            data: [
              {
                id: "sermon-a",
                title: "Dynamic Sermon Title",
                preacher: "Dynamic Preacher",
                content: "Dynamic church-authored notes",
                video_url: "https://media.example/sermon-video",
                audio_url: "https://media.example/sermon-audio",
                date: "2026-10-05",
              },
              {
                id: "sermon-b",
                title: "Missing Notes Sermon",
                preacher: null,
                content: null,
                video_url: null,
                audio_url: null,
                date: "2026-10-06",
              },
            ],
            error: null,
          };
        },
      };
      return builder;
    },
  },
}));

import PortalSermons from "@/pages/portal/PortalSermons";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const flattenKeys = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
};
const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("Timed out waiting for Sermons localization state.");
};

describe("member Sermons localization", () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  const renderPage = () => {
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <PortalSermons />
        </QueryClientProvider>,
      );
    });
  };

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    state.mode = "data";
    state.featureKeys = [];
    state.queries = [];
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    client.clear();
  });

  it("keeps English and Kiswahili member_sermons keys symmetric", () => {
    const en = JSON.parse(read("src/locales/en.json"));
    const sw = JSON.parse(read("src/locales/sw.json"));

    expect(flattenKeys(en.member_sermons).sort()).toEqual(flattenKeys(sw.member_sermons).sort());
  });

  it("renders English app-owned copy while preserving dynamic sermon content", async () => {
    await changeAppLanguage("en");

    renderPage();
    await waitFor(() => host.textContent?.includes("Dynamic Sermon Title") === true);

    expect(host.textContent).toContain("Sermons");
    expect(host.textContent).toContain("Listen to or watch sermons shared by your parish.");
    expect(host.textContent).toContain("Dynamic Sermon Title");
    expect(host.textContent).toContain("Dynamic Preacher");
    expect(host.textContent).toContain("Dynamic church-authored notes");
    expect(host.textContent).toContain("No notes available.");
    expect(host.textContent).toContain("Watch video");
    expect(host.textContent).toContain("Listen to audio");
    expect(host.textContent).toContain(formatAppDate("2026-10-05", "en", { dateStyle: "medium" }));

    const videoLink = host.querySelector<HTMLAnchorElement>('a[href="https://media.example/sermon-video"]');
    const audioLink = host.querySelector<HTMLAnchorElement>('a[href="https://media.example/sermon-audio"]');
    expect(videoLink?.target).toBe("_blank");
    expect(videoLink?.rel).toBe("noopener noreferrer");
    expect(audioLink?.target).toBe("_blank");
    expect(audioLink?.rel).toBe("noopener noreferrer");
  });

  it("renders Kiswahili app-owned copy while preserving dynamic sermon content", async () => {
    await changeAppLanguage("sw");

    renderPage();
    await waitFor(() => host.textContent?.includes("Dynamic Sermon Title") === true);

    expect(host.textContent).toContain("Mahubiri");
    expect(host.textContent).toContain("Sikiliza au tazama mahubiri yaliyoshirikiwa na parokia.");
    expect(host.textContent).toContain("Dynamic Sermon Title");
    expect(host.textContent).toContain("Dynamic Preacher");
    expect(host.textContent).toContain("Dynamic church-authored notes");
    expect(host.textContent).toContain("Hakuna maelezo yaliyopo.");
    expect(host.textContent).toContain("Tazama video");
    expect(host.textContent).toContain("Sikiliza sauti");
    expect(host.textContent).toContain(formatAppDate("2026-10-05", "sw", { dateStyle: "medium" }));
  });

  it("keeps loading, error, retry, and empty states distinct and localized", async () => {
    await changeAppLanguage("sw");

    state.mode = "loading";
    renderPage();
    expect(host.textContent).toContain("Mahubiri yanapakiwa...");

    client.clear();
    state.mode = "error";
    renderPage();
    await waitFor(() => host.textContent?.includes("Imeshindikana kupakia mahubiri.") === true);
    expect(host.textContent).toContain("Jaribu tena kupata mahubiri ya parokia.");
    expect(host.textContent).toContain("Jaribu tena");
    expect(host.textContent).not.toContain("Hakuna mahubiri kwa sasa.");

    client.clear();
    state.mode = "empty";
    renderPage();
    await waitFor(() => host.textContent?.includes("Hakuna mahubiri kwa sasa.") === true);
    expect(host.textContent).toContain("Mahubiri mapya yataonekana hapa yatakapochapishwa.");
    expect(host.textContent).not.toContain("Imeshindikana kupakia mahubiri.");
  });

  it("preserves Sermons query, feature, formatting, and media contracts", async () => {
    await changeAppLanguage("en");

    renderPage();
    await waitFor(() => state.queries.length > 0);

    expect(state.featureKeys).toContain("sermons");
    expect(state.queries[0]).toMatchObject({
      table: "sermons",
      filters: [
        { method: "eq", column: "church_id", value: "church-a" },
        { method: "is", column: "archived_at", value: null },
      ],
      order: { column: "date", options: { ascending: false } },
    });

    const source = read("src/pages/portal/PortalSermons.tsx");
    expect(source).toContain('queryKey: ["portal-sermons", churchId]');
    expect(source).toContain('enabled: !!churchId && isFeatureEnabled("sermons")');
    expect(source).toContain("formatAppDate(s.date, i18n.language");
    expect(source).not.toContain("new Date(s.date).toLocaleDateString()");
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});
