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
  mass: null as null | {
    mass: {
      id: string;
      title: string;
      description: string | null;
      massDate: string;
      startTime: string;
      endTime: string | null;
      responseDeadline: string | null;
      askForRsvp: boolean;
      memberId: string | null;
      memberResponse: "yes" | "maybe" | "no" | null;
    };
  },
  announcement: null as null | { id: string; church_id: string; title: string; content: string | null },
  events: [] as Array<{ id: string; churchId: string; title: string; description: string | null; startDate: string; location: string | null }>,
  ministries: [] as Array<{ id: string; name: string; description: string | null; joined: boolean }>,
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
      return { data: state.ministries, isLoading: false, isError: false };
    }
    if (key === "portal-events") {
      return { data: state.events, isLoading: false, isError: false };
    }
    if (key === "member-daily-life") {
      return { data: state.mass, isLoading: false, isError: false };
    }
    if (key === "portal-announcements") {
      return { data: state.announcement, isLoading: false, isError: false };
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
    state.mass = null;
    state.announcement = null;
    state.events = [];
    state.ministries = [];
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderPage = () => act(() => root.render(<MemoryRouter><MemberMyParishPage /></MemoryRouter>));
  const quickActionsText = () => host.querySelector('section[aria-label="Njia za haraka"]')?.textContent ?? "";

  it("keeps My Parish accessible to ordinary members", () => {
    expect(isOrdinaryMemberPathAllowed("/portal/my-parish")).toBe(true);
  });

  it("renders the next Mass section when data exists", () => {
    state.mass = {
      mass: {
        id: "mass-a",
        title: "Misa ya Jumapili",
        description: "Misa kuu ya parokia",
        massDate: "2026-09-06",
        startTime: "09:00",
        endTime: null,
        responseDeadline: null,
        askForRsvp: false,
        memberId: null,
        memberResponse: null,
      },
    };
    renderPage();
    expect(host.textContent).toContain("Misa ijayo");
    expect(host.textContent).toContain("Misa ya Jumapili");
    expect(host.textContent).toContain("Misa kuu ya parokia");
    expect(host.querySelector('a[href="/portal/calendar"]')).not.toBeNull();
  });

  it("keeps the next Mass empty state safe", () => {
    renderPage();
    expect(host.textContent).toContain("Hakuna Misa ijayo iliyopangwa kwa sasa.");
  });

  it("renders the latest announcement", () => {
    state.announcement = {
      id: "announcement-a",
      church_id: "church-a",
      title: "Tangazo la vijana",
      content: "Kikao kitafanyika Jumamosi.",
    };
    renderPage();
    expect(host.textContent).toContain("Tangazo la karibuni");
    expect(host.textContent).toContain("Tangazo la vijana");
    expect(host.textContent).toContain("Kikao kitafanyika Jumamosi.");
    expect(host.querySelector('a[href="/portal/announcements"]')).not.toBeNull();
  });

  it("renders compact upcoming events", () => {
    state.events = [
      { id: "event-a", churchId: "church-a", title: "Semina ya familia", description: null, startDate: "2099-09-06T09:00:00Z", location: "Ukumbi" },
      { id: "event-b", churchId: "church-a", title: "Kwaya", description: null, startDate: "2099-09-07T09:00:00Z", location: null },
      { id: "event-c", churchId: "church-a", title: "Vijana", description: null, startDate: "2099-09-08T09:00:00Z", location: null },
      { id: "event-d", churchId: "church-a", title: "Wanawake", description: null, startDate: "2099-09-09T09:00:00Z", location: null },
    ];
    renderPage();
    expect(host.textContent).toContain("Matukio yajayo");
    expect(host.textContent).toContain("Semina ya familia");
    expect(host.textContent).toContain("Kwaya");
    expect(host.textContent).toContain("Vijana");
    expect(host.textContent).not.toContain("Wanawake");
  });

  it("renders joined ministries and safe empty optional sections", () => {
    state.ministries = [
      { id: "ministry-a", name: "Kwaya ya Mt. Cecilia", description: "Mazoezi ya kila wiki", joined: true },
      { id: "ministry-b", name: "Vijana", description: null, joined: false },
    ];
    renderPage();
    expect(host.textContent).toContain("Huduma zangu");
    expect(host.textContent).toContain("Kwaya ya Mt. Cecilia");
    expect(host.textContent).toContain("Mazoezi ya kila wiki");
    expect(host.textContent).not.toContain("Vijana");
    expect(host.textContent).toContain("Hakuna Misa ijayo iliyopangwa kwa sasa.");
    expect(host.textContent).toContain("Hakuna tangazo jipya kwa sasa.");
    expect(host.textContent).toContain("Hakuna tukio lijalo lililochapishwa kwa sasa.");
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
    const actions = quickActionsText();
    for (const label of ["Michango", "Nia za Misa", "Maombi", "Mahubiri", "Kalenda"]) {
      expect(actions).not.toContain(label);
    }
  });

  it("preserves non-gated library access", () => {
    for (const key of ["give", "mass_intentions", "prayer_requests", "sermons", "events"] satisfies PortalFeatureKey[]) {
      state.features.set(key, false);
    }
    renderPage();
    expect(quickActionsText()).toContain("Maktaba");
    expect(host.querySelector('a[href="/portal/library"]')).not.toBeNull();
  });

  it("does not introduce staging-only imports", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src", "pages/portal/MemberMyParishPage.tsx"), "utf8");
    for (const disallowed of ["useParishCalendar", "@/lib/liturgy", "@/lib/prayers", "@/lib/universal-audio", "@/lib/ministries"]) {
      expect(source).not.toContain(disallowed);
    }
  });
});
