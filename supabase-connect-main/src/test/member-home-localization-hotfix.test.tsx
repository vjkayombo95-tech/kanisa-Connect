import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { changeAppLanguage } from "@/i18n";
import type { ChurchLivestream } from "@/lib/church-livestreams";

const state = vi.hoisted(() => ({
  isDesktop: true,
  mutationResponses: [] as Array<"yes" | "maybe" | "no">,
  livestream: null as ChurchLivestream | null,
}));

vi.mock("@/components/AppLink", () => ({
  AppLink: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsDesktop: () => state.isDesktop,
}));

vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({
    getFeatureState: (key: string) => ({ key, exists: true, enabled: true, visible: true, locked: false }),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    user: { id: "user-a", email: "member@example.test", user_metadata: {} },
  }),
}));

vi.mock("@/contexts/PersistentLivestreamContext", () => ({
  useOptionalPersistentLivestream: () => ({ open: vi.fn() }),
}));

vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => ({
    data: state.livestream,
    featureEnabled: Boolean(state.livestream),
    churchId: "church-a",
    error: null,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({
    isPending: false,
    variables: null,
    mutate: (response: "yes" | "maybe" | "no") => {
      state.mutationResponses.push(response);
    },
  }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey[0];
    if (key === "simple-member-home") {
      return {
        data: {
          memberId: "member-a",
          memberName: "Amina Dynamic",
          churchName: "St Joseph Dynamic",
          churchBannerUrl: null,
          churchBannerPositionY: 38,
          totalPaid: null,
          pendingAmount: null,
          lastPayment: null,
          latestAnnouncement: {
            title: "Parish Meeting Tomorrow",
            content: "<p>Bring your family.</p>",
            date: "2026-10-04T21:30:00Z",
          },
        },
        isLoading: false,
        isError: false,
      };
    }

    if (key === "member-home-financials") {
      return {
        data: {
          totalPaid: 12000,
          pendingAmount: 3000,
          lastPayment: { amount: 5000, date: "2026-10-04T21:30:00Z", label: "payment" },
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    }

    if (key === "member-daily-life" && queryKey[1] === "next-mass") {
      return {
        data: {
          mass: {
            id: "mass-rsvp",
            title: "RSVP Mass Dynamic",
            description: null,
            massDate: "2026-10-05",
            startTime: "09:00",
            endTime: null,
            responseDeadline: "2099-10-04T21:30:00Z",
            askForRsvp: true,
            memberId: "member-a",
            memberResponse: "maybe",
          },
          responseCounts: { yes: 8, maybe: 2, no: 1 },
          responseRate: 75,
        },
        isLoading: false,
        isError: false,
      };
    }

    if (key === "member-daily-life" && queryKey[1] === "next-timetable-mass") {
      return {
        data: {
          id: "mass-next",
          title: "Youth Mass Dynamic",
          description: "Main Church Dynamic",
          massDate: "2026-10-05",
          startTime: "00:30:00",
          endTime: null,
          responseDeadline: null,
          askForRsvp: false,
          memberId: null,
          memberResponse: null,
        },
        isLoading: false,
        isError: false,
      };
    }

    return { data: null, isLoading: false, isError: false, refetch: vi.fn() };
  },
}));

import MemberDashboard from "@/components/portal/MemberDashboard";
import { MobileMemberHome } from "@/components/portal/MobileMemberHome";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";

function textOf(host: HTMLElement) {
  return host.textContent ?? "";
}

function render(root: Root, element: ReactNode) {
  act(() => {
    root.render(<>{element}</>);
  });
}

describe("member home localization hotfix", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await act(async () => {
      await changeAppLanguage("en");
    });
    state.isDesktop = true;
    state.mutationResponses = [];
    state.livestream = null;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it("localizes desktop Home while preserving dynamic content, routes, feature gates, RSVP values and Tanzania time", async () => {
    render(root, <MemberDashboard />);

    expect(textOf(host)).toContain("Welcome");
    expect(textOf(host)).toContain("Total Given");
    expect(textOf(host)).toContain("Pending Amount");
    expect(textOf(host)).toContain("Last Payment");
    expect(textOf(host)).toContain("Next Mass");
    expect(textOf(host)).toContain("Latest announcement");
    expect(textOf(host)).toContain("Quick actions");
    expect(textOf(host)).toContain("Give");
    expect(textOf(host)).toContain("Mass Intentions");
    expect(textOf(host)).toContain("Announcements");
    expect(textOf(host)).toContain("Will you attend?");
    expect(textOf(host)).toContain("Yes");
    expect(textOf(host)).toContain("Maybe");
    expect(textOf(host)).toContain("No");
    expect(textOf(host)).toContain("Response rate: 75%");
    expect(textOf(host)).toContain("00:30");
    expect(textOf(host)).toMatch(/Oct|October/);
    expect(textOf(host)).toContain("Amina Dynamic");
    expect(textOf(host)).toContain("St Joseph Dynamic");
    expect(textOf(host)).toContain("Youth Mass Dynamic");
    expect(textOf(host)).toContain("Parish Meeting Tomorrow");
    expect(host.querySelector('a[href="/portal/give"]')).not.toBeNull();
    expect(host.querySelector('a[href="/portal/mass-intentions"]')).not.toBeNull();
    expect(host.querySelector('a[href="/portal/announcements"]')).not.toBeNull();

    const yesButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Yes");
    act(() => yesButton?.click());
    expect(state.mutationResponses).toEqual(["yes"]);

    await act(async () => {
      await changeAppLanguage("sw");
    });

    expect(textOf(host)).toContain("Karibu");
    expect(textOf(host)).toContain("Jumla Uliyolipa");
    expect(textOf(host)).toContain("Kiasi Kinachosubiri");
    expect(textOf(host)).toContain("Malipo ya Mwisho");
    expect(textOf(host)).toContain("Misa ijayo");
    expect(textOf(host)).toContain("Tangazo la karibuni");
    expect(textOf(host)).toContain("Hatua za haraka");
    expect(textOf(host)).toContain("Toa Mchango");
    expect(textOf(host)).toContain("Nia za Misa");
    expect(textOf(host)).toContain("Matangazo");
    expect(textOf(host)).toContain("Utahudhuria?");
    expect(textOf(host)).toContain("Ndiyo");
    expect(textOf(host)).toContain("Labda");
    expect(textOf(host)).toContain("Hapana");
    expect(textOf(host)).toContain("Kiwango cha majibu: 75%");
    expect(textOf(host)).toContain("00:30");
    expect(textOf(host)).toMatch(/Okt|Oct/);
    expect(textOf(host)).toContain("Amina Dynamic");
    expect(textOf(host)).toContain("St Joseph Dynamic");
    expect(textOf(host)).toContain("Youth Mass Dynamic");
    expect(textOf(host)).toContain("Parish Meeting Tomorrow");
  });

  it("localizes mobile Home service cards and keeps destinations unchanged", async () => {
    state.isDesktop = false;
    render(root, (
      <MobileMemberHome
        announcementsVisible
        churchBannerPositionY={38}
        churchBannerUrl={null}
        churchName="St Joseph Dynamic"
        giveVisible
        latestAnnouncement={{ title: "Parish Meeting Tomorrow", content: "<p>Body</p>" }}
        massVisible
        memberName="Amina Dynamic"
        nextMass={{
          id: "mass-next",
          title: "Youth Mass Dynamic",
          description: "Main Church Dynamic",
          massDate: "2026-10-05",
          startTime: "00:30:00",
          endTime: null,
          responseDeadline: null,
          askForRsvp: false,
          memberId: null,
          memberResponse: null,
        }}
        nextMassError={false}
        nextMassLoading={false}
      />
    ));

    expect(textOf(host)).toContain("Hello, Amina");
    expect(textOf(host)).toContain("What would you like to do?");
    expect(textOf(host)).toContain("Give");
    expect(textOf(host)).toContain("Contribute to your parish");
    expect(textOf(host)).toContain("Mass Intentions");
    expect(textOf(host)).toContain("My History");
    expect(textOf(host)).toContain("All services");
    expect(textOf(host)).toContain("Daily Readings");
    expect(textOf(host)).toContain("My Parish");
    expect(textOf(host)).toContain("Youth Mass Dynamic");
    expect(textOf(host)).toContain("00:30");
    expect(host.querySelector('a[href="/portal/give"]')).not.toBeNull();
    expect(host.querySelector('a[href="/portal/mass-intentions"]')).not.toBeNull();
    expect(host.querySelector('a[href="/portal/announcements"]')).not.toBeNull();
    expect(host.querySelector('a[href="/portal/dashboard"]')).not.toBeNull();
    expect(host.querySelector('a[href="/portal/calendar"]')).not.toBeNull();

    await act(async () => {
      await changeAppLanguage("sw");
    });

    expect(textOf(host)).toContain("Habari, Amina");
    expect(textOf(host)).toContain("Ungependa kufanya nini?");
    expect(textOf(host)).toContain("Toa Mchango");
    expect(textOf(host)).toContain("Changia parokia yako");
    expect(textOf(host)).toContain("Nia za Misa");
    expect(textOf(host)).toContain("Historia Yangu");
    expect(textOf(host)).toContain("Huduma zote");
    expect(textOf(host)).toContain("Masomo ya Leo");
    expect(textOf(host)).toContain("Parokia Yangu");
    expect(textOf(host)).toContain("Youth Mass Dynamic");
    expect(textOf(host)).toContain("00:30");
  });

  it("localizes live and upcoming Home livestream presentation without changing stream identity", async () => {
    state.livestream = {
      id: "stream-live",
      churchId: "church-a",
      status: "live",
      title: "Mass Stream Dynamic",
      provider: "youtube",
      watchUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      providerExternalId: "abcdefghijk",
      scheduledStart: "2026-10-04T21:30:00Z",
      scheduledEnd: "2099-10-04T22:30:00Z",
      actualStartedAt: "2026-10-04T21:30:00Z",
      actualEndedAt: null,
    };

    render(root, <ProductionLiveMassCard />);
    expect(textOf(host)).toContain("LIVE NOW");
    expect(textOf(host)).toContain("Watch live");
    expect(textOf(host)).toContain("Mass Stream Dynamic");

    await act(async () => {
      await changeAppLanguage("sw");
    });
    expect(textOf(host)).toContain("LIVE SASA");
    expect(textOf(host)).toContain("Tazama moja kwa moja");
    expect(textOf(host)).toContain("Mass Stream Dynamic");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T21:20:00Z"));
    state.livestream = { ...state.livestream, id: "stream-upcoming", status: "scheduled", scheduledStart: "2026-10-04T21:30:00Z", scheduledEnd: "2026-10-04T22:30:00Z", actualStartedAt: null };
    render(root, <ProductionLiveMassCard />);
    expect(textOf(host)).toContain("INAKUJA KARIBUNI");
    expect(textOf(host)).toContain("Fungua Misa ijayo");
    expect(textOf(host)).toContain("Inaanza");
    expect(textOf(host)).toContain("00:30");

    await act(async () => {
      await changeAppLanguage("en");
    });
    expect(textOf(host)).toContain("COMING UP SOON");
    expect(textOf(host)).toContain("Open upcoming Mass");
    expect(textOf(host)).toContain("Starts");
    expect(textOf(host)).toContain("00:30");
  });
});
