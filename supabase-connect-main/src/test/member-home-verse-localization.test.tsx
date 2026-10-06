import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeAppLanguage } from "@/i18n";

const state = vi.hoisted(() => ({
  featureKeys: [] as string[],
  queryOptions: [] as Array<{ queryKey: readonly unknown[]; enabled: boolean }>,
  verseRecords: [
    {
      id: "verse-a",
      verse_text: "Dynamic verse text remains exactly as authored.",
      reference: "Dynamic 1:1",
      language: "sw",
    },
  ] as Array<{ id: string; verse_text: string; reference: string; language: unknown }>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: readonly unknown[]; enabled: boolean }) => {
    state.queryOptions.push({ queryKey: options.queryKey, enabled: options.enabled });
    return { data: state.verseRecords };
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a" }),
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    isFeatureEnabled: (featureKey: string) => {
      state.featureKeys.push(featureKey);
      return featureKey === "bible_verses";
    },
  }),
}));

vi.mock("@/hooks/use-typewriter-advanced", () => ({
  useTypewriterAdvanced: (text: string) => ({
    displayedText: text,
    currentWordIndex: -1,
    isTyping: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import PortalHome from "@/pages/portal/PortalHome";

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
  throw new Error("Timed out waiting for PortalHome verse state.");
};

describe("PortalHome verse localization", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderHome = () => {
    act(() => {
      root.render(<PortalHome />);
    });
  };

  beforeEach(() => {
    window.localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    state.featureKeys = [];
    state.queryOptions = [];
    state.verseRecords = [
      {
        id: "verse-a",
        verse_text: "Dynamic verse text remains exactly as authored.",
        reference: "Dynamic 1:1",
        language: window.localStorage.getItem("ecclesia-verse-language") ?? "sw",
      },
    ];
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("keeps English and Kiswahili member_home verse keys symmetric", () => {
    const en = JSON.parse(read("src/locales/en.json"));
    const sw = JSON.parse(read("src/locales/sw.json"));

    expect(flattenKeys(en.member_home.verse).sort()).toEqual(flattenKeys(sw.member_home.verse).sort());
  });

  it("renders English verse UI from app language while selected verse language remains Kiswahili", async () => {
    await changeAppLanguage("en");
    window.localStorage.setItem("ecclesia-verse-language", "sw");

    renderHome();
    await waitFor(() => host.textContent?.includes("Dynamic verse text remains exactly as authored.") === true);

    expect(host.textContent).toContain("Verse of the Day");
    expect(host.textContent).toContain("Read slowly and reflect.");
    expect(host.textContent).toContain("Dynamic verse text remains exactly as authored.");
    expect(host.textContent).toContain("Dynamic 1:1");
    expect(host.querySelector('button[aria-label="Enable typing sound"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Open focus mode"]')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.textContent).toBe("sw");

    host.querySelector<HTMLButtonElement>("button[aria-label='Open focus mode']")?.click();
    const source = read("src/pages/portal/PortalHome.tsx");
    expect(source).toContain('aria-label={t("member_home.verse.actions.close_focus")}');
    expect(source).toContain('t("member_home.verse.focus.sound_off")');
  });

  it("renders Kiswahili verse UI from app language while selected verse language remains English", async () => {
    await changeAppLanguage("sw");
    window.localStorage.setItem("ecclesia-verse-language", "en");

    renderHome();
    await waitFor(() => host.textContent?.includes("Dynamic verse text remains exactly as authored.") === true);

    expect(host.textContent).toContain("Neno la Leo");
    expect(host.textContent).toContain("Soma kwa utulivu na tafakari.");
    expect(host.textContent).toContain("Dynamic verse text remains exactly as authored.");
    expect(host.textContent).toContain("Dynamic 1:1");
    expect(host.querySelector('button[aria-label="Washa sauti ya kuchapa"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Fungua hali ya kutazama kwa makini"]')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.textContent).toBe("en");

    host.querySelector<HTMLButtonElement>("button[aria-label='Washa sauti ya kuchapa']")?.click();
    await waitFor(() => host.querySelector('button[aria-label="Zima sauti ya kuchapa"]') !== null);
  });

  it("preserves verse-language toggle storage behavior and localized empty state", async () => {
    await changeAppLanguage("en");
    state.verseRecords = [];

    renderHome();
    await waitFor(() => host.textContent?.includes("No verses available") === true);

    host.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (button.textContent === "en") button.click();
    });
    await waitFor(() => window.localStorage.getItem("ecclesia-verse-language") === "en");
    expect(host.textContent).toContain("No verses available");
  });

  it("keeps the advanced verse upsell disabled and preserves query/feature contracts", async () => {
    await changeAppLanguage("en");

    renderHome();
    await waitFor(() => state.queryOptions.length > 0);

    expect(host.textContent).not.toContain("Advanced verse tools are LOCKED");
    expect(state.featureKeys).toContain("bible_verses");
    expect(state.queryOptions[0]).toEqual({ queryKey: ["portal-bible-verses", "sw"], enabled: true });

    const source = read("src/pages/portal/PortalHome.tsx");
    expect(source).toContain('queryKey: ["portal-bible-verses", selectedLanguage]');
    expect(source).toContain('.from("bible_verses")');
    expect(source).toContain('.eq("church_id", churchId)');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain('.order("created_at", { ascending: false })');
    expect(source).toContain('enabled: !!churchId && isFeatureEnabled("bible_verses")');
    expect(source).toContain("const showAdvancedVerseUpsell = false;");
    expect(source).not.toContain('language === "sw" ? "Neno la Leo"');
    expect(source).not.toContain('aria-label="Open focus mode"');
  });
});
