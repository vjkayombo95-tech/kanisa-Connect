import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import type { ChurchLivestream } from "@/lib/church-livestreams";

const state = vi.hoisted(() => ({
  features: new Map<string, { exists: boolean; visible: boolean }>(),
  livestream: {
    churchId: "church-a",
    data: null as ChurchLivestream | null,
    error: null as Error | null,
    featureEnabled: false,
    featureLoading: false,
    isLoading: false,
  },
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    getFeatureState: (key: string) => {
      const feature = state.features.get(key);
      return { key, exists: feature?.exists ?? true, enabled: feature?.visible ?? true, visible: feature?.visible ?? true, locked: false };
    },
    isFeatureExplicitlyEnabledForChurch: (key: string) => state.features.get(key)?.visible ?? true,
  }),
}));

vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => state.livestream,
}));

import MemberServicesPage from "@/pages/portal/MemberServicesPage";

function renderPage() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/portal/services"]}>
        <MemberServicesPage />
      </MemoryRouter>,
    );
  });
  return { host, root };
}

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function textOf(host: HTMLElement) {
  return host.textContent ?? "";
}

function changeLanguage(language: "en" | "sw") {
  act(() => {
    void i18n.changeLanguage(language);
  });
}

describe("member Services page localization", () => {
  let mounted: { host: HTMLDivElement; root: Root } | null = null;

  beforeEach(() => {
    state.features = new Map();
    state.livestream = {
      churchId: "church-a",
      data: null,
      error: null,
      featureEnabled: false,
      featureLoading: false,
      isLoading: false,
    };
    window.localStorage.clear();
    changeLanguage("en");
  });

  afterEach(() => {
    if (mounted) {
      act(() => mounted?.root.unmount());
      mounted.host.remove();
      mounted = null;
    }
    changeLanguage("en");
  });

  it("renders English Services copy from page keys and registry helpers", () => {
    mounted = renderPage();

    expect(textOf(mounted.host)).toContain("More");
    expect(textOf(mounted.host)).toContain("Find more Kanisa Connect services and spaces.");
    expect(mounted.host.querySelector("input")?.getAttribute("placeholder")).toBe("Search services...");
    expect(mounted.host.querySelector("input")?.getAttribute("aria-label")).toBe("Search services");
    expect(textOf(mounted.host)).toContain("Parish Services");
    expect(textOf(mounted.host)).toContain("Services for participating in and following parish life.");
    expect(textOf(mounted.host)).toContain("Give");
    expect(textOf(mounted.host)).toContain("Contribute to your parish");
    expect(mounted.host.querySelector('a[href="/portal/give"]')?.getAttribute("aria-label")).toBe("Open Give");
  });

  it("renders Kiswahili Services copy from the same keys and registry helpers", () => {
    changeLanguage("sw");
    mounted = renderPage();

    expect(textOf(mounted.host)).toContain("Zaidi");
    expect(textOf(mounted.host)).toContain("Pata huduma na maeneo mengine ya Kanisa Connect.");
    expect(mounted.host.querySelector("input")?.getAttribute("placeholder")).toBe("Tafuta huduma...");
    expect(mounted.host.querySelector("input")?.getAttribute("aria-label")).toBe("Tafuta huduma");
    expect(textOf(mounted.host)).toContain("Huduma za Parokia");
    expect(textOf(mounted.host)).toContain("Huduma za kushiriki na kufuatilia maisha ya parokia.");
    expect(textOf(mounted.host)).toContain("Toa Mchango");
    expect(textOf(mounted.host)).toContain("Changia parokia yako");
    expect(mounted.host.querySelector('a[href="/portal/give"]')?.getAttribute("aria-label")).toBe("Fungua Toa Mchango");
  });

  it("updates already-mounted static copy when language changes", () => {
    mounted = renderPage();
    expect(textOf(mounted.host)).toContain("More");
    expect(textOf(mounted.host)).toContain("Give");

    changeLanguage("sw");

    expect(textOf(mounted.host)).toContain("Zaidi");
    expect(textOf(mounted.host)).toContain("Toa Mchango");
    expect(textOf(mounted.host)).not.toContain("Find more Kanisa Connect services and spaces.");
  });

  it("preserves service routes and feature-gated visibility", () => {
    state.features.set("give", { exists: true, visible: false });
    state.features.set("mass_intentions", { exists: true, visible: true });
    state.features.set("announcements", { exists: true, visible: true });
    mounted = renderPage();

    expect(mounted.host.querySelector('a[href="/portal/give"]')).toBeNull();
    expect(mounted.host.querySelector('a[href="/portal/mass-intentions"]')).not.toBeNull();
    expect(mounted.host.querySelector('a[href="/portal/announcements"]')).not.toBeNull();
    expect(mounted.host.querySelector('a[href="/portal/calendar"]')).not.toBeNull();
  });

  it("searches the translated presentation text in English and Kiswahili", () => {
    mounted = renderPage();
    const input = mounted.host.querySelector("input")!;

    changeInput(input, "contribute");

    expect(textOf(mounted.host)).toContain("Give");
    expect(textOf(mounted.host)).not.toContain("Mass Intentions");

    changeLanguage("sw");
    changeInput(input, "nia");

    expect(textOf(mounted.host)).toContain("Nia za Misa");
    expect(textOf(mounted.host)).not.toContain("Toa Mchango");

    changeInput(input, "zzzz");
    expect(textOf(mounted.host)).toContain("Hakuna huduma iliyopatikana.");
  });

  it("keeps livestream routing dynamic while localizing only app-owned presentation copy", () => {
    state.livestream = {
      churchId: "church-a",
      data: {
        id: "stream-a",
        churchId: "church-a",
        status: "live",
        title: "Tenant Supplied Stream Title",
        provider: "youtube",
        watchUrl: "https://www.youtube.com/watch?v=03pYP2Nmreo",
        providerExternalId: "03pYP2Nmreo",
        scheduledStart: "2026-10-05T06:00:00.000Z",
        scheduledEnd: null,
        actualStartedAt: "2026-10-05T06:00:00.000Z",
        actualEndedAt: null,
      },
      error: null,
      featureEnabled: true,
      featureLoading: false,
      isLoading: false,
    };
    mounted = renderPage();

    expect(mounted.host.querySelector('a[href="/portal/live/stream-a"]')).not.toBeNull();
    expect(textOf(mounted.host)).toContain("Live Mass");
    expect(textOf(mounted.host)).toContain("Watch Mass live");
    expect(textOf(mounted.host)).not.toContain("Tenant Supplied Stream Title");
  });
});
