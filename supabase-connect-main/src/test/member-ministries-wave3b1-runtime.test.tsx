import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ministries: [
    { id: "joined", churchId: "church-a", name: "Kwaya ya Mtakatifu Yosefu", description: null, memberCount: 4, joined: true, requestPending: false },
    { id: "pending", churchId: "church-a", name: "Vijana", description: null, memberCount: 8, joined: false, requestPending: true },
    { id: "available", churchId: "church-a", name: "Wahudumu wa Altare", description: null, memberCount: 2, joined: false, requestPending: false },
  ],
}));
const leaveMemberMinistry = vi.hoisted(() => vi.fn(async () => undefined));
const requestMinistryMembership = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ churchId: "church-a" }) }));
vi.mock("@/hooks/use-linked-member", () => ({ useLinkedMember: () => ({ data: { id: "member-a" }, isLoading: false, isError: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/member-ministries", () => ({
  memberMinistriesQueryKey: (churchId?: string, memberId?: string) => ["production-member-ministries", churchId, memberId],
  fetchMemberMinistries: vi.fn(async () => state.ministries),
  leaveMemberMinistry,
  requestMinistryMembership,
}));

import MemberMinistriesPage from "@/pages/portal/MemberMinistriesPage";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Wave 3B1 ministry hierarchy", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderPage = async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/portal/ministries"]}>
            <Routes><Route path="/portal/ministries" element={<MemberMinistriesPage />} /></Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    for (let attempt = 0; attempt < 5 && !host.querySelector('[data-testid^="member-ministry-"]') && !host.textContent?.includes("Hakuna huduma"); attempt += 1) {
      await act(async () => { await tick(); });
    }
  };

  const button = (label: string) => [...host.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);

  beforeEach(() => {
    leaveMemberMinistry.mockClear();
    requestMinistryMembership.mockClear();
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
});
