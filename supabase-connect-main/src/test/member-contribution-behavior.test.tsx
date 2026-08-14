import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CHURCH_A = "church-a";
const CHURCH_B = "church-b";
const MEMBER_A = "member-a";
const MEMBER_B = "member-b";
const MEMBER_X = "member-x";
const OWN_ID = "11111111-1111-4111-8111-111111111111";
const FOREIGN_MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const FOREIGN_CHURCH_ID = "33333333-3333-4333-8333-333333333333";
const INVALID_ID = "44444444-4444-4444-8444-444444444444";

type Row = {
  id: string;
  amount: number;
  date: string;
  created_at: string;
  notes: string | null;
  payment_reference: string | null;
  category_id: string | null;
  church_id: string;
  member_id: string;
  donor_name: string;
  contribution_categories: { name: string } | null;
};

const testState = vi.hoisted(() => ({
  filters: [] as Array<[string, unknown]>,
  historyError: false,
  receiptErrorIds: new Set<string>(),
  rows: [] as Row[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a", user: { id: "user-a", email: "member-a@example.test" } }),
}));

vi.mock("@/hooks/use-linked-member", () => ({
  useLinkedMember: () => ({
    data: { id: "member-a", full_name: "Member A", church_id: "church-a" },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "contributions") throw new Error(`Unexpected table ${table}`);
      const localFilters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          localFilters.push([column, value]);
          testState.filters.push([column, value]);
          return builder;
        },
        order: () => builder,
        range: async () => {
          if (testState.historyError) return { data: null, count: null, error: new Error("history failed") };
          const data = testState.rows.filter((row) => localFilters.every(([column, value]) => row[column as keyof Row] === value));
          return { data, count: data.length, error: null };
        },
        maybeSingle: async () => {
          const id = String(localFilters.find(([column]) => column === "id")?.[1] ?? "");
          if (testState.receiptErrorIds.has(id)) return { data: null, error: new Error("receipt failed") };
          const data = testState.rows.find((row) => localFilters.every(([column, value]) => row[column as keyof Row] === value)) ?? null;
          return { data, error: null };
        },
      };
      return builder;
    },
  },
}));

import PortalContributionHistoryPage from "@/pages/portal/PortalContributionHistoryPage";
import PortalContributionReceiptPage from "@/pages/portal/PortalContributionReceiptPage";

const ownRow: Row = {
  id: OWN_ID,
  amount: 41001,
  date: "2026-08-14",
  created_at: "2026-08-14T09:00:00Z",
  notes: "Authorized note",
  payment_reference: "OWN-REF-41001",
  category_id: "category-a",
  church_id: CHURCH_A,
  member_id: MEMBER_A,
  donor_name: "Member A",
  contribution_categories: { name: "Sadaka" },
};

const foreignMemberRow: Row = {
  ...ownRow,
  id: FOREIGN_MEMBER_ID,
  amount: 92002,
  member_id: MEMBER_B,
  donor_name: "Foreign Member Secret",
  payment_reference: "FOREIGN-MEMBER-SECRET",
};

const foreignChurchRow: Row = {
  ...ownRow,
  id: FOREIGN_CHURCH_ID,
  amount: 93003,
  church_id: CHURCH_B,
  member_id: MEMBER_X,
  donor_name: "Foreign Church Secret",
  payment_reference: "FOREIGN-CHURCH-SECRET",
};

function Providers({ children, entries }: { children: ReactNode; entries: string[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}><MemoryRouter initialEntries={entries}>{children}</MemoryRouter></QueryClientProvider>;
}

const mounts: Array<{ host: HTMLDivElement; root: Root }> = [];

function renderNode(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  mounts.push({ host, root });
  return host;
}

async function waitForText(host: HTMLElement, text: string | RegExp) {
  let found = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    found = typeof text === "string" ? host.textContent?.includes(text) === true : text.test(host.textContent ?? "");
    if (found) break;
  }
  expect(found, `Expected rendered text ${String(text)} in ${host.textContent}`).toBe(true);
}

function buttonWithText(host: HTMLElement, text: string) {
  return Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

function renderHistory() {
  return renderNode(<Providers entries={["/portal/contribution-history"]}><PortalContributionHistoryPage /></Providers>);
}

let navigate: ReturnType<typeof useNavigate>;
function CaptureNavigation() {
  navigate = useNavigate();
  return null;
}

function renderReceipt(id: string) {
  return renderNode(
    <Providers entries={[`/portal/contribution-receipt/${id}`]}>
      <CaptureNavigation />
      <Routes><Route path="/portal/contribution-receipt/:contributionId" element={<PortalContributionReceiptPage />} /></Routes>
    </Providers>,
  );
}

function expectReceiptFilters(id: string) {
  expect(testState.filters).toEqual(expect.arrayContaining([
    ["id", id],
    ["church_id", CHURCH_A],
    ["member_id", MEMBER_A],
  ]));
}

beforeEach(() => {
  testState.filters.length = 0;
  testState.historyError = false;
  testState.receiptErrorIds.clear();
  testState.rows = [ownRow, foreignMemberRow, foreignChurchRow];
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const { host, root } of mounts.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

describe("Wave 4B behavioral ownership boundaries", () => {
  it("renders only the authenticated member's contribution history and exact fields", async () => {
    const host = renderHistory();
    expect(host.querySelector('[aria-label="Inapakia historia"]')).not.toBeNull();
    await waitForText(host, /41,001/);
    expect(host.textContent).toContain("Sadaka");
    expect(host.textContent).toContain("Ref: OWN-REF-41001");
    expect(host.textContent).not.toMatch(/92,002/);
    expect(host.textContent).not.toMatch(/93,003/);
    expect(testState.filters).toEqual(expect.arrayContaining([["church_id", CHURCH_A], ["member_id", MEMBER_A]]));
  });

  it("renders an authorized receipt on a direct mount and invokes print", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const host = renderReceipt(OWN_ID);
    expect(host.textContent).not.toContain("Chapisha / Hifadhi PDF");
    await waitForText(host, /41,001/);
    expect(host.textContent).toContain("Member A");
    expect(host.textContent).toContain("Sadaka");
    expect(host.textContent).toContain("OWN-REF-41001");
    act(() => buttonWithText(host, "Chapisha / Hifadhi PDF")?.click());
    expect(print).toHaveBeenCalledOnce();
    expectReceiptFilters(OWN_ID);
  });

  it.each([
    ["same-church foreign member", FOREIGN_MEMBER_ID, "92,002", "Foreign Member Secret"],
    ["foreign church", FOREIGN_CHURCH_ID, "93,003", "Foreign Church Secret"],
    ["invalid contribution", INVALID_ID, "41,001", "Member A"],
  ])("denies %s without details or print", async (_label, id, amount, secret) => {
    const host = renderReceipt(id);
    await waitForText(host, "Risiti haipatikani");
    expect(host.textContent).not.toMatch(new RegExp(amount));
    expect(host.textContent).not.toContain(secret);
    expect(host.textContent).not.toContain("Chapisha / Hifadhi PDF");
    expectReceiptFilters(id);
  });

  it("uses the same safe unavailable state for a receipt query failure", async () => {
    testState.receiptErrorIds.add(INVALID_ID);
    const host = renderReceipt(INVALID_ID);
    await waitForText(host, "Risiti haipatikani");
    expect(host.textContent).not.toContain("Chapisha / Hifadhi PDF");
  });

  it("clears an authorized receipt after navigating to a denied contribution", async () => {
    const host = renderReceipt(OWN_ID);
    await waitForText(host, /41,001/);
    expect(host.textContent).toContain("Chapisha / Hifadhi PDF");
    await act(async () => navigate(`/portal/contribution-receipt/${FOREIGN_MEMBER_ID}`));
    await waitForText(host, "Risiti haipatikani");
    expect(host.textContent).not.toMatch(/41,001/);
    expect(host.textContent).not.toContain("Member A");
    expect(host.textContent).not.toContain("OWN-REF-41001");
    expect(host.textContent).not.toContain("Chapisha / Hifadhi PDF");
  });

  it("renders the authorized empty history state", async () => {
    testState.rows = [foreignMemberRow, foreignChurchRow];
    const host = renderHistory();
    await waitForText(host, "Hakuna michango iliyorekodiwa bado.");
    expect(host.textContent).not.toMatch(/92,002|93,003/);
  });

  it("renders a safe history error without cached contribution rows", async () => {
    testState.historyError = true;
    const host = renderHistory();
    await waitForText(host, "Historia haikuweza kupakiwa. Jaribu tena.");
    expect(host.textContent).not.toMatch(/41,001|92,002|93,003/);
  });
});
