import { act, type ComponentPropsWithoutRef, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PortalFeatureKey } from "@/lib/portal-features";

const state = vi.hoisted(() => ({
  features: new Map<string, boolean>(),
  errors: new Set<string>(),
  loading: new Set<string>(),
  refetches: new Map<string, ReturnType<typeof vi.fn>>(),
  parish: {
    id: "church-a",
    name: "Parokia Test",
    logoUrl: null as string | null,
    phone: null as string | null,
    email: null as string | null,
    address: null as string | null,
  } as null | {
    id: string;
    name: string;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  },
  linkedMember: {
    data: { id: "member-a", full_name: "Member Test", church_id: "church-a" } as null | { id: string; full_name: string | null; church_id: string },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
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
    const queryName = String(key);
    const refetch = state.refetches.get(queryName) ?? vi.fn();
    state.refetches.set(queryName, refetch);
    const shell = {
      isLoading: state.loading.has(queryName),
      isFetching: state.loading.has(queryName),
      isError: state.errors.has(queryName),
      refetch,
    };
    if (key === "member-parish-identity") {
      return { data: shell.isError || shell.isLoading ? null : state.parish, ...shell };
    }
    if (key === "my-member-record") {
      return { data: shell.isError || shell.isLoading ? null : { id: "member-a", full_name: "Member Test", church_id: "church-a" }, ...shell };
    }
    if (key === "production-member-ministries") {
      return { data: shell.isError || shell.isLoading ? undefined : state.ministries, ...shell };
    }
    if (key === "portal-events") {
      return { data: shell.isError || shell.isLoading ? undefined : state.events, ...shell };
    }
    if (key === "member-daily-life") {
      return { data: shell.isError || shell.isLoading ? undefined : state.mass, ...shell };
    }
    if (key === "portal-announcements") {
      return { data: shell.isError || shell.isLoading ? undefined : state.announcement, ...shell };
    }
    return { data: null, ...shell };
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
  useLinkedMember: () => state.linkedMember,
}));

import { isOrdinaryMemberPathAllowed } from "@/lib/member-service-registry";
import MemberMyParishPage from "@/pages/portal/MemberMyParishPage";

describe("My Parish feature-aware quick links", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    state.features = new Map();
    state.errors = new Set();
    state.loading = new Set();
    state.refetches = new Map();
    state.parish = { id: "church-a", name: "Parokia Test", logoUrl: null, phone: null, email: null, address: null };
    state.linkedMember = {
      data: { id: "member-a", full_name: "Member Test", church_id: "church-a" },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
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

  it("renders parish identity success without fabricated contact data", () => {
    renderPage();

    expect(host.textContent).toContain("Parokia Yangu");
    expect(host.textContent).toContain("Parokia Test");
    expect(host.textContent).toContain("Umeunganishwa kama Member Test");
    expect(host.textContent).toContain("Mawasiliano");
    expect(host.textContent).toContain("Mawasiliano ya parokia bado hayajachapishwa.");
    expect(host.textContent).toContain("Mahali pa parokia");
    expect(host.textContent).toContain("Mahali pa parokia bado hapajawekwa.");
    expect(host.querySelector('a[href^="tel:"]')).toBeNull();
    expect(host.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(host.querySelector('a[href^="https://www.google.com/maps"]')).toBeNull();
    expect(host.textContent).not.toContain("church-a");
    expect(host.textContent).not.toContain("member-a");
  });

  it("renders a long parish name without dropping identity content", () => {
    state.parish = {
      id: "church-a",
      name: "Parokia ya Mtakatifu Maria Mama wa Kanisa Kuu la Waamini wa Kijiji cha Mlimani",
      logoUrl: null,
      phone: null,
      email: null,
      address: null,
    };

    renderPage();

    expect(host.textContent).toContain("Parokia ya Mtakatifu Maria Mama wa Kanisa Kuu la Waamini wa Kijiji cha Mlimani");
    expect(host.textContent).toContain("Umeunganishwa kama Member Test");
  });

  it("does not render a relationship sentence when the member name is null", () => {
    state.linkedMember = {
      ...state.linkedMember,
      data: { id: "member-a", full_name: null, church_id: "church-a" },
    };

    renderPage();

    expect(host.textContent).toContain("Parokia Yangu");
    expect(host.textContent).toContain("Parokia Test");
    expect(host.textContent).toContain("Mawasiliano");
    expect(host.textContent).toContain("Mahali pa parokia");
    expect(host.textContent).not.toContain("Umeunganishwa kama");
    expect(host.textContent).not.toContain("member-a");
    expect(host.textContent).not.toContain("church-a");
  });

  it("does not render a relationship sentence when the member name is blank", () => {
    state.linkedMember = {
      ...state.linkedMember,
      data: { id: "member-a", full_name: "   ", church_id: "church-a" },
    };

    renderPage();

    expect(host.textContent).toContain("Parokia Test");
    expect(host.textContent).not.toContain("Umeunganishwa kama");
  });

  it("renders real phone and email with safe semantic links", () => {
    state.parish = {
      id: "church-a",
      name: "Parokia Test",
      logoUrl: null,
      phone: "+255 712 345 678",
      email: "ofisi@example.org",
      address: null,
    };

    renderPage();

    expect(host.textContent).toContain("Piga simu");
    expect(host.textContent).toContain("+255 712 345 678");
    expect(host.textContent).toContain("Tuma barua pepe");
    expect(host.textContent).toContain("ofisi@example.org");
    expect(host.querySelector('a[href="tel:+255712345678"]')).not.toBeNull();
    const emailLink = host.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    expect(emailLink).not.toBeNull();
    expect(emailLink?.getAttribute("href")).toContain("ofisi");
    expect(emailLink?.getAttribute("href")).not.toMatch(/^javascript:/i);
    expect(host.textContent).toContain("Mahali pa parokia bado hapajawekwa.");
    expect(host.textContent).not.toContain("Mawasiliano ya parokia bado hayajachapishwa.");
  });

  it("renders real parish location with copy and safe map actions", () => {
    state.parish = {
      id: "church-a",
      name: "Parokia Test",
      logoUrl: null,
      phone: null,
      email: null,
      address: "Barabara ya Kanisa, Kata ya Mlimani, Dar es Salaam",
    };

    renderPage();

    expect(host.textContent).toContain("Mahali pa parokia");
    expect(host.textContent).toContain("Barabara ya Kanisa, Kata ya Mlimani, Dar es Salaam");
    expect(host.querySelector('button[type="button"]')?.textContent).toContain("Nakili anwani");
    const mapLink = host.querySelector<HTMLAnchorElement>('a[href^="https://www.google.com/maps/search/?api=1&query="]');
    expect(mapLink).not.toBeNull();
    expect(mapLink?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(mapLink?.getAttribute("href")).not.toMatch(/^javascript:/i);
    expect(host.textContent).toContain("Mawasiliano ya parokia bado hayajachapishwa.");
  });

  it("renders parish identity loading without fake parish information", () => {
    state.loading.add("member-parish-identity");

    renderPage();

    expect(host.querySelector(".animate-pulse")).not.toBeNull();
    expect(host.textContent).not.toContain("Parokia Test");
    expect(host.textContent).not.toContain("Taarifa za parokia bado hazijachapishwa.");
    expect(host.textContent).not.toContain("Hatukuweza kupakia taarifa za parokia kwa sasa.");
  });

  it("renders parish identity request failure with retry and no raw backend error", () => {
    state.errors.add("member-parish-identity");
    const retry = vi.fn();
    state.refetches.set("member-parish-identity", retry);

    renderPage();

    expect(host.textContent).toContain("Hatukuweza kupakia taarifa za parokia kwa sasa.");
    expect(host.textContent).toContain("Tafadhali jaribu tena.");
    expect(host.textContent).not.toMatch(/Supabase|database|RPC|permission denied|stack trace/i);
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Jaribu tena: Hatukuweza kupakia taarifa za parokia kwa sasa."]');
    expect(button).not.toBeNull();
    act(() => button!.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders missing parish identity as empty without retry", () => {
    state.parish = null;

    renderPage();

    expect(host.textContent).toContain("Taarifa za parokia bado hazijachapishwa.");
    expect(host.textContent).not.toContain("Hatukuweza kupakia taarifa za parokia kwa sasa.");
    expect(host.querySelector('button[aria-label^="Jaribu tena: Taarifa za parokia"]')).toBeNull();
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
    expect(host.textContent).not.toContain("Hatukuweza kupakia Misa ijayo kwa sasa.");
    expect(host.querySelector('button[aria-label^="Jaribu tena: Hakuna Misa"]')).toBeNull();
  });

  it("renders next Mass request failure as an error with retry while preserving parish identity", () => {
    state.errors.add("member-daily-life");
    const retry = vi.fn();
    state.refetches.set("member-daily-life", retry);

    renderPage();

    expect(host.textContent).toContain("Parokia Test");
    expect(host.textContent).toContain("Hatukuweza kupakia Misa ijayo kwa sasa.");
    expect(host.textContent).not.toContain("Hakuna Misa ijayo iliyopangwa kwa sasa.");
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Jaribu tena: Hatukuweza kupakia Misa ijayo kwa sasa."]');
    expect(button).not.toBeNull();
    act(() => button!.click());
    expect(retry).toHaveBeenCalledTimes(1);
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

  it("keeps announcement empty state distinct from a request failure", () => {
    renderPage();
    expect(host.textContent).toContain("Hakuna tangazo jipya kwa sasa.");
    expect(host.textContent).not.toContain("Hatukuweza kupakia tangazo la karibuni kwa sasa.");
  });

  it("renders announcement request failure as an error without hiding successful Mass", () => {
    state.mass = {
      mass: {
        id: "mass-a",
        title: "Misa ya Jioni",
        description: null,
        massDate: "2026-09-06",
        startTime: "18:00",
        endTime: null,
        responseDeadline: null,
        askForRsvp: false,
        memberId: null,
        memberResponse: null,
      },
    };
    state.errors.add("portal-announcements");
    state.refetches.set("portal-announcements", vi.fn());

    renderPage();
    expect(host.textContent).toContain("Misa ya Jioni");
    expect(host.textContent).toContain("Hatukuweza kupakia tangazo la karibuni kwa sasa.");
    expect(host.textContent).not.toContain("Hakuna tangazo jipya kwa sasa.");
    expect(host.querySelector('button[aria-label="Jaribu tena: Hatukuweza kupakia tangazo la karibuni kwa sasa."]')).not.toBeNull();
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

  it("renders upcoming events request failure as an error with retry", () => {
    state.errors.add("portal-events");
    state.refetches.set("portal-events", vi.fn());

    renderPage();

    expect(host.textContent).toContain("Hatukuweza kupakia matukio yajayo kwa sasa.");
    expect(host.textContent).not.toContain("Hakuna tukio lijalo lililochapishwa kwa sasa.");
    expect(host.querySelector('button[aria-label="Jaribu tena: Hatukuweza kupakia matukio yajayo kwa sasa."]')).not.toBeNull();
  });

  it("keeps Mass and event information while hiding event route actions when events are unavailable", () => {
    state.features.set("events", false);
    state.mass = {
      mass: {
        id: "mass-a",
        title: "Misa ya Asubuhi",
        description: null,
        massDate: "2026-09-06",
        startTime: "07:00",
        endTime: null,
        responseDeadline: null,
        askForRsvp: false,
        memberId: null,
        memberResponse: null,
      },
    };
    state.events = [
      { id: "event-a", churchId: "church-a", title: "Semina ya familia", description: null, startDate: "2099-09-06T09:00:00Z", location: "Ukumbi" },
    ];
    renderPage();
    expect(host.textContent).toContain("Misa ya Asubuhi");
    expect(host.textContent).toContain("Semina ya familia");
    expect(host.querySelector('a[href="/portal/calendar"]')).toBeNull();
    expect(host.querySelector('a[href="/portal/events"]')).toBeNull();
    expect(quickActionsText()).not.toContain("Kalenda");
  });

  it("keeps announcement information while hiding announcement route actions when unavailable", () => {
    state.features.set("announcements", false);
    state.announcement = {
      id: "announcement-a",
      church_id: "church-a",
      title: "Tangazo la sadaka",
      content: "Ofisi itakuwa wazi leo.",
    };
    renderPage();
    expect(host.textContent).toContain("Tangazo la sadaka");
    expect(host.textContent).toContain("Ofisi itakuwa wazi leo.");
    expect(host.querySelector('a[href="/portal/announcements"]')).toBeNull();
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

  it("keeps ministries loading while linked member is still loading", () => {
    state.linkedMember = {
      data: null,
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    };

    renderPage();

    expect(host.querySelector(".animate-pulse")).not.toBeNull();
    expect(host.textContent).toContain("Parokia Test");
    expect(host.textContent).not.toContain("Bado hujajiunga na huduma ya parokia.");
    expect(host.textContent).not.toContain("Hatukuweza kuthibitisha taarifa zako za mshiriki kwa sasa.");
  });

  it("renders linked-member failure as a member-safe ministries error with retry", () => {
    const retry = vi.fn();
    state.linkedMember = {
      data: null,
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch: retry,
    };

    renderPage();

    expect(host.textContent).toContain("Parokia Test");
    expect(host.textContent).toContain("Huduma zangu");
    expect(host.textContent).toContain("Hatukuweza kuthibitisha taarifa zako za mshiriki kwa sasa.");
    expect(host.textContent).not.toContain("Bado hujajiunga na huduma ya parokia.");
    expect(host.textContent).not.toMatch(/Supabase|database|RPC|member-a|church-a|permission denied|stack trace/i);
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Jaribu tena: Hatukuweza kuthibitisha taarifa zako za mshiriki kwa sasa."]');
    expect(button).not.toBeNull();
    act(() => button!.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("disables linked-member retry while member refetch is running", () => {
    state.linkedMember = {
      data: null,
      isLoading: false,
      isFetching: true,
      isError: true,
      refetch: vi.fn(),
    };

    renderPage();

    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Jaribu tena: Hatukuweza kuthibitisha taarifa zako za mshiriki kwa sasa."]');
    expect(button).not.toBeNull();
    expect(button).toBeDisabled();
    expect(button?.textContent).toContain("Inapakia...");
  });

  it("renders zero joined ministries as a legitimate empty state after linked-member success", () => {
    renderPage();

    expect(host.textContent).toContain("Huduma zangu");
    expect(host.textContent).toContain("Bado hujajiunga na huduma ya parokia.");
    expect(host.textContent).not.toContain("Hatukuweza kuthibitisha taarifa zako za mshiriki kwa sasa.");
  });

  it("renders ministries request failure as an error with retry", () => {
    state.errors.add("production-member-ministries");
    state.refetches.set("production-member-ministries", vi.fn());

    renderPage();

    expect(host.textContent).toContain("Huduma zangu");
    expect(host.textContent).toContain("Hatukuweza kupakia huduma zako kwa sasa.");
    expect(host.textContent).not.toContain("Bado hujajiunga na huduma ya parokia.");
    expect(host.querySelector('button[aria-label="Jaribu tena: Hatukuweza kupakia huduma zako kwa sasa."]')).not.toBeNull();
  });

  it("keeps joined ministry information while hiding ministry route actions when unavailable", () => {
    state.features.set("ministries", false);
    state.ministries = [
      { id: "ministry-a", name: "Kwaya ya Mt. Cecilia", description: "Mazoezi ya kila wiki", joined: true },
    ];
    renderPage();
    expect(host.textContent).toContain("Kwaya ya Mt. Cecilia");
    expect(host.textContent).toContain("Mazoezi ya kila wiki");
    expect(host.querySelector('a[href="/portal/ministries"]')).toBeNull();
    expect(host.querySelector('a[href="/portal/ministries/ministry-a"]')).toBeNull();
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
