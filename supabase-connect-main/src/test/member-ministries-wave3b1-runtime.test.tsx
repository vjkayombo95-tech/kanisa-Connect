import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type LinkedMemberMockState = {
  data?: { id: string };
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
};

const state = vi.hoisted((): {
  member: LinkedMemberMockState;
  ministries: Array<{ id: string; churchId: string; name: string; description: string | null; memberCount: number; joined: boolean; requestPending: boolean }>;
  ministriesError: Error | null;
} => ({
  member: { data: { id: "member-a" }, isLoading: false, isError: false, isFetching: false },
  ministries: [
    { id: "joined", churchId: "church-a", name: "Kwaya ya Mtakatifu Yosefu", description: null, memberCount: 4, joined: true, requestPending: false },
    { id: "pending", churchId: "church-a", name: "Vijana", description: null, memberCount: 8, joined: false, requestPending: true },
    { id: "available", churchId: "church-a", name: "Wahudumu wa Altare", description: null, memberCount: 2, joined: false, requestPending: false },
  ],
  ministriesError: null as Error | null,
}));
const memberRefetch = vi.hoisted(() => vi.fn(async () => ({ data: { id: "member-a" } })));
const leaveMemberMinistry = vi.hoisted(() => vi.fn(async () => undefined));
const requestMinistryMembership = vi.hoisted(() => vi.fn(async () => undefined));
const fetchMemberMinistries = vi.hoisted(() => vi.fn(async () => {
  if (state.ministriesError) throw state.ministriesError;
  return state.ministries;
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ churchId: "church-a" }) }));
vi.mock("@/hooks/use-linked-member", () => ({
  useLinkedMember: () => ({ ...state.member, refetch: memberRefetch }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/member-ministries", () => ({
  memberMinistriesQueryKey: (churchId?: string, memberId?: string) => ["production-member-ministries", churchId, memberId],
  fetchMemberMinistries,
  leaveMemberMinistry,
  requestMinistryMembership,
}));

import MemberMinistriesPage from "@/pages/portal/MemberMinistriesPage";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Wave 3B1 ministry hierarchy", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderPage = async (initialEntry = "/portal/ministries") => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/portal/ministries" element={<MemberMinistriesPage />} />
              <Route path="/portal/ministries/:ministryId" element={<MemberMinistriesPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    for (let attempt = 0; attempt < 8 && !host.querySelector('[data-testid^="member-ministry-"]') && !host.textContent?.includes("Hakuna huduma") && !host.textContent?.includes("Huduma hazikuweza") && !host.textContent?.includes("Huduma hii haipatikani"); attempt += 1) {
      await act(async () => { await tick(); });
    }
  };

  const button = (label: string) => [...host.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);

  beforeEach(() => {
    memberRefetch.mockClear();
    leaveMemberMinistry.mockClear();
    requestMinistryMembership.mockClear();
    fetchMemberMinistries.mockClear();
    toast.mockClear();
    state.member = { data: { id: "member-a" }, isLoading: false, isError: false, isFetching: false };
    state.ministriesError = null;
    state.ministries = [
      { id: "joined", churchId: "church-a", name: "Kwaya ya Mtakatifu Yosefu", description: null, memberCount: 4, joined: true, requestPending: false },
      { id: "pending", churchId: "church-a", name: "Vijana", description: null, memberCount: 8, joined: false, requestPending: true },
      { id: "available", churchId: "church-a", name: "Wahudumu wa Altare", description: null, memberCount: 2, joined: false, requestPending: false },
    ];
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("separates joined ministries and orders pending before available", async () => {
    await renderPage();
    const headings = [...host.querySelectorAll("h2")];
    expect(headings.map((heading) => heading.textContent)).toEqual(expect.arrayContaining(["Huduma zangu", "Huduma nyingine"]));
    expect(host.querySelector('[data-testid="member-ministry-pending"]')?.compareDocumentPosition(host.querySelector('[data-testid="member-ministry-available"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button("Ombi linasubiri")?.disabled).toBe(true);
  });

  it("renders a legitimate ministries list without fabricating missing descriptions", async () => {
    await renderPage();
    expect(host.textContent).toContain("Kwaya ya Mtakatifu Yosefu");
    expect(host.textContent).toContain("Maelezo bado hayajawekwa.");
    expect(host.textContent).not.toContain("Huduma ya parokia inayokukaribisha kushiriki.");
  });

  it("keeps loading distinct from the legitimate empty state", async () => {
    state.member = { data: undefined, isLoading: true, isError: false, isFetching: true };
    await renderPage();
    expect(host.querySelector(".animate-pulse")).toBeTruthy();
    expect(host.textContent).not.toContain("Hakuna huduma zilizowekwa kwa parokia hii.");
  });

  it("shows a safe retry state for linked-member failure", async () => {
    state.member = { data: undefined, isLoading: false, isError: true, isFetching: false };
    await renderPage();
    expect(host.textContent).toContain("Huduma hazikuweza kupakiwa kwa sasa. Jaribu tena.");
    expect(host.textContent).not.toContain("Hakuna huduma zilizowekwa kwa parokia hii.");
    await act(async () => {
      button("Jaribu tena")?.click();
      await tick();
    });
    expect(memberRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows a safe retry state for ministries read failure", async () => {
    state.ministriesError = new Error("permission denied for table member_ministries");
    await renderPage();
    expect(host.textContent).toContain("Huduma hazikuweza kupakiwa kwa sasa. Jaribu tena.");
    expect(host.textContent).not.toContain("permission denied");
    expect(host.textContent).not.toContain("Hakuna huduma zilizowekwa kwa parokia hii.");
    await act(async () => {
      button("Jaribu tena")?.click();
      await tick();
    });
    expect(fetchMemberMinistries).toHaveBeenCalledTimes(2);
  });

  it("distinguishes an empty search from no configured ministries", async () => {
    await renderPage();
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Tafuta huduma"]')!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "haipo kabisa");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.textContent).toContain("Hakuna huduma zinazolingana na utafutaji wako.");

    act(() => root.unmount());
    root = createRoot(host);
    state.ministries = [];
    await renderPage();
    expect(host.textContent).toContain("Hakuna huduma zilizowekwa kwa parokia hii.");
  });

  it("renders valid ministry detail and a safe unavailable state for unknown detail routes", async () => {
    state.ministries = [
      { id: "available", churchId: "church-a", name: "Wahudumu wa Altare", description: "Huduma ya madhabahuni", memberCount: 2, joined: false, requestPending: false },
    ];
    await renderPage("/portal/ministries/available");
    expect(host.textContent).toContain("Wahudumu wa Altare");
    expect(host.textContent).toContain("Huduma ya madhabahuni");

    act(() => root.unmount());
    root = createRoot(host);
    await renderPage("/portal/ministries/other-church-ministry");
    expect(host.textContent).toContain("Huduma hii haipatikani.");
    expect(host.textContent).toContain("Rudi kwenye huduma zote");
    expect(host.textContent).not.toContain("other-church-ministry");
  });

  it("hides raw backend details when join requests fail", async () => {
    requestMinistryMembership.mockRejectedValueOnce(new Error("duplicate key value violates unique constraint ministry_join_requests_one_pending_idx"));
    await renderPage();
    await act(async () => {
      button("Omba kujiunga")?.click();
      await tick();
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Ombi halijatumwa",
      description: "Hatukuweza kutuma ombi lako kwa sasa. Jaribu tena.",
      variant: "destructive",
    }));
    expect(JSON.stringify(toast.mock.calls)).not.toContain("duplicate key");
  });

  it("cancels with no mutation and confirms leave exactly once", async () => {
    await renderPage();
    act(() => button("Ondoka kwenye huduma")?.click());
    expect(host.textContent).toContain("Unakaribia kuondoka kwenye huduma ya Kwaya ya Mtakatifu Yosefu");
    act(() => button("Ghairi")?.click());
    expect(leaveMemberMinistry).not.toHaveBeenCalled();

    act(() => button("Ondoka kwenye huduma")?.click());
    const confirm = button("Thibitisha kuondoka")!;
    await act(async () => {
      confirm.click();
      confirm.click();
      await tick();
    });
    expect(leaveMemberMinistry).toHaveBeenCalledTimes(1);
    expect(leaveMemberMinistry).toHaveBeenCalledWith("member-a", "joined");
  });

  it("hides raw backend details when leaving fails", async () => {
    leaveMemberMinistry.mockRejectedValueOnce(new Error("permission denied for table member_ministries"));
    await renderPage();
    act(() => button("Ondoka kwenye huduma")?.click());
    await act(async () => {
      button("Thibitisha kuondoka")?.click();
      await tick();
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Ombi halijakamilika",
      description: "Hatukuweza kukamilisha ombi lako kwa sasa. Jaribu tena.",
      variant: "destructive",
    }));
    expect(JSON.stringify(toast.mock.calls)).not.toContain("permission denied");
  });

  it("preserves join success", async () => {
    await renderPage();
    await act(async () => {
      button("Omba kujiunga")?.click();
      await tick();
    });
    expect(requestMinistryMembership).toHaveBeenCalledWith("church-a", "member-a", "available");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Ombi limetumwa",
      description: "Parokia itakagua ombi lako.",
    }));
  });
});
