import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchMemberContributionTotal: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    profile: { full_name: "Test Member", church_name: "Test Parish" },
    user: { id: "user-a", user_metadata: {} },
  }),
}));
vi.mock("@/hooks/use-linked-member", () => ({
  useLinkedMember: () => ({ data: { id: "member-a", church_id: "church-a", full_name: "Test Member" } }),
}));
vi.mock("@/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ getFeatureState: () => ({ visible: false }) }),
}));
vi.mock("@/hooks/use-church-livestream", () => ({
  useChurchLivestream: () => ({ featureEnabled: false, data: null }),
}));
vi.mock("@/lib/member-contributions", () => ({
  fetchMemberContributionTotal: mocks.fetchMemberContributionTotal,
}));

import { resolveMemberAssistantIntent } from "@/lib/member-assistant";
import KanisaAssistantPage from "@/pages/portal/KanisaAssistantPage";

describe("Wave 5B Tafakari quick-action hotfix", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    mocks.fetchMemberContributionTotal.mockReset();
    mocks.fetch.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => host.remove());

  it("renders Tafakari and resolves its click through the existing deterministic reflection intent", async () => {
    const root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><KanisaAssistantPage /></MemoryRouter>));

    const expected = resolveMemberAssistantIntent("tafakari");
    expect(expected).toMatchObject({ intent: "reflections", action: "navigate", route: "/portal/reflections" });

    for (const label of ["Michango yangu", "Nia za Misa", "Matangazo", "Masomo ya leo", "Kalenda", "Sala", "Tafakari", "Watakatifu"]) {
      expect([...host.querySelectorAll("button")].some((button) => button.textContent?.trim() === label)).toBe(true);
    }

    const quickAction = [...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Tafakari");
    expect(quickAction).toBeDefined();
    await act(async () => quickAction?.click());

    const action = host.querySelector('a[href="/portal/reflections"]');
    expect(action).toHaveTextContent("Tafakari");
    expect(host).toHaveTextContent("Fungua tafakari za kiroho zilizochapishwa.");

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.fetchMemberContributionTotal).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
