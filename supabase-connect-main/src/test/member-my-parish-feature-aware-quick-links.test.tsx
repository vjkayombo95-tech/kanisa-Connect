import { act, type ComponentPropsWithoutRef, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PortalFeatureKey } from "@/lib/portal-features";

const state = vi.hoisted(() => ({
  features: new Map<string, boolean>(),
  livestream: {
    featureEnabled: false,
    error: null as Error | null,
    data: null as null | {
      id: string;
      churchId: string;
      status: "live";
      title: string;
      provider: "youtube";
      watchUrl: string;
      providerExternalId: string;
      scheduledStart: string | null;
      scheduledEnd: string | null;
      actualStartedAt: string | null;
      actualEndedAt: string | null;
    },
    churchId: "church-a",
  },
  radio: {
    featureEnabled: false,
    isError: false,
    data: [] as Array<{ id: string; name: string }>,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const [key] = queryKey;
    if (key === "member-parish-identity") {
      return { data: { id: "church-a", name: "Parokia Test", logoUrl: null, phone: null, email: null, address: null }, isLoading: false, isError: false };
    }
    if (key === "my-member-record") {
      return { data: { id: "member-a", full_name: "Member Test", church_id: "church-a" }, isLoading: false, isError: false };
    }
    if (key === "production-member-ministries") {
      return { data: [], isLoading: false, isError: false };
    }
    if (key === "portal-events") {
      return { data: [], isLoading: false, isError: false };
    }
    return { data: null, isLoading: false, isError: false };
  },
}));

vi.mock("@/components/AppLink", () => ({
  AppLink: ({ to, children, ...props }: { to: string } & ComponentPropsWithoutRef<"a">) =>
    createElement("a", { href: to, ...props }, children),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a", user: { id: "user-a" } }),
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    getFeatureState: (key: PortalFeatureKey) => ({
      key,
      exists: true,
      enabled: state.features.get(key) ?? true,
      visible: state.features.get(key) ?? true,
      locked: false,
    }),
  }),
}));

vi.mock("@/hooks/use-church-livestream", () => ({ useChurchLivestream: () => state.livestream }));
vi.mock("@/hooks/use-church-radio", () => ({ useChurchRadioStations: () => state.radio }));
vi.mock("@/hooks/use-linked-member", () => ({
  useLinkedMember: () => ({ data: { id: "member-a", full_name: "Member Test", church_id: "church-a" }, isLoading: false, isError: false }),
}));

import { isOrdinaryMemberPathAllowed } from "@/lib/member-service-registry";
import MemberMyParishPage from "@/pages/portal/MemberMyParishPage";

describe("My Parish feature-aware quick links", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.features = new Map();
    state.livestream = {
      featureEnabled: false,
      error: null,
      data: null,
      churchId: "church-a",
    };
    state.radio = { featureEnabled: false, isError: false, data: [] };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderPage = () => act(() => root.render(<MemoryRouter><MemberMyParishPage /></MemoryRouter>));

  it("keeps My Parish accessible to ordinary members", () => {
    expect(isOrdinaryMemberPathAllowed("/portal/my-parish")).toBe(true);
  });

  it("hides unavailable livestream and radio quick actions", () => {
    renderPage();
    expect(host.textContent).not.toContain("Misa Mubashara");
    expect(host.textContent).not.toContain("Radio");
  });

  it("shows available livestream and radio quick actions", () => {
    state.livestream = {
      featureEnabled: true,
      error: null,
      churchId: "church-a",
      data: {
        id: "stream-a",
        churchId: "church-a",
        status: "live",
        title: "Misa Mubashara",
        provider: "youtube",
        watchUrl: "https://youtu.be/M7lc1UVf-VE",
        providerExternalId: "M7lc1UVf-VE",
        scheduledStart: null,
        scheduledEnd: null,
        actualStartedAt: "2026-08-31T09:00:00Z",
        actualEndedAt: null,
      },
    };
    state.radio = { featureEnabled: true, isError: false, data: [{ id: "radio-a", name: "Radio" }] };
    renderPage();
    expect(host.textContent).toContain("Misa Mubashara");
    expect(host.textContent).toContain("Radio");
    expect(host.querySelector('a[href="/portal/live/stream-a"]')).not.toBeNull();
    expect(host.querySelector('a[href="/portal/radio"]')).not.toBeNull();
  });

  it("hides feature-backed quick actions when their feature is unavailable", () => {
    for (const key of ["give", "mass_intentions", "prayer_requests", "sermons", "events"] satisfies PortalFeatureKey[]) {
      state.features.set(key, false);
    }
    renderPage();
    for (const label of ["Michango", "Nia za Misa", "Maombi", "Mahubiri", "Kalenda"]) {
      expect(host.textContent).not.toContain(label);
    }
  });

  it("preserves non-gated library access", () => {
    for (const key of ["give", "mass_intentions", "prayer_requests", "sermons", "events"] satisfies PortalFeatureKey[]) {
      state.features.set(key, false);
    }
    renderPage();
    expect(host.textContent).toContain("Maktaba");
    expect(host.querySelector('a[href="/portal/library"]')).not.toBeNull();
  });
});
