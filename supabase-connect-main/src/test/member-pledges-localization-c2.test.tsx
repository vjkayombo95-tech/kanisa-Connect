import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { changeAppLanguage } from "@/i18n";

type RpcCall = {
  name: string;
  payload: Record<string, unknown>;
};

type ToastCall = {
  title: string;
  description?: string;
  variant?: string;
};

const state = vi.hoisted(() => ({
  rpcCalls: [] as RpcCall[],
  toasts: [] as ToastCall[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    user: { id: "user-a", email: "member-a@example.test" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: (value: ToastCall) => state.toasts.push(value) }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      type Builder = {
        select: () => Builder;
        eq: (column: string, value: unknown) => Builder;
        or: () => Builder;
        limit: () => Builder;
        maybeSingle: () => Promise<{ data: unknown; error: null }>;
      };
      const filters: Array<[string, unknown]> = [];
      const builder: Builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        or: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          if (table === "members") {
            return { data: { id: "member-a", full_name: "Amina Dynamic", community_id: "community-a" }, error: null };
          }
          if (table === "communities") {
            expect(filters).toContainEqual(["id", "community-a"]);
            return { data: { id: "community-a", name: "St Kizito Jumuiya" }, error: null };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };
      return builder;
    },
    rpc: async (name: string, payload: Record<string, unknown>) => {
      state.rpcCalls.push({ name, payload });
      if (name === "get_member_pledges") {
        return {
          data: [
            {
              id: "pledge-pending",
              member_id: "member-a",
              member_name: "Amina Dynamic",
              church_id: "church-a",
              community_id: "community-a",
              community_name: "St Kizito Jumuiya",
              amount_pledged: 100000,
              amount_paid: 0,
              balance: 100000,
              status: "pending",
              created_at: "2026-01-01T00:00:00Z",
            },
            {
              id: "pledge-partial",
              member_id: "member-a",
              member_name: "Amina Dynamic",
              church_id: "church-a",
              community_id: "community-a",
              community_name: "Parish Roof Campaign",
              amount_pledged: 200000,
              amount_paid: 50000,
              balance: 150000,
              status: "partial",
              created_at: "2026-01-02T00:00:00Z",
            },
            {
              id: "pledge-completed",
              member_id: "member-a",
              member_name: "Amina Dynamic",
              church_id: "church-a",
              community_id: "community-a",
              community_name: "Completed Tenant Pledge",
              amount_pledged: 30000,
              amount_paid: 30000,
              balance: 0,
              status: "completed",
              created_at: "2026-01-03T00:00:00Z",
            },
          ],
          error: null,
        };
      }
      if (name === "create_pledge" || name === "make_pledge_payment") {
        return { data: { success: true }, error: null };
      }
      throw new Error(`Unexpected rpc ${name}`);
    },
    channel: () => ({
      on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
    }),
    removeChannel: () => undefined,
  },
}));

import PortalPledges from "@/pages/portal/PortalPledges";

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mounts: Array<{ host: HTMLDivElement; root: Root }> = [];

function renderPledges() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Providers><PortalPledges /></Providers>));
  mounts.push({ host, root });
  return host;
}

async function waitForText(text: string | RegExp) {
  let found = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    const bodyText = document.body.textContent ?? "";
    found = typeof text === "string" ? bodyText.includes(text) : text.test(bodyText);
    if (found) break;
  }
  expect(found, `Expected ${String(text)} in ${document.body.textContent}`).toBe(true);
}

function inputByPlaceholder(placeholder: string) {
  const input = Array.from(document.body.querySelectorAll("input")).find((node) => node.getAttribute("placeholder") === placeholder);
  expect(input, `Expected input with placeholder ${placeholder}`).toBeTruthy();
  return input as HTMLInputElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickButtonMatching(pattern: RegExp) {
  const button = Array.from(document.body.querySelectorAll("button")).find((node) => pattern.test(node.textContent ?? "") && !node.disabled);
  expect(button, `Expected enabled button matching ${pattern}`).toBeTruthy();
  button?.click();
}

function clickButtonMatchingAt(pattern: RegExp, index: number) {
  const buttons = Array.from(document.body.querySelectorAll("button")).filter((node) => pattern.test(node.textContent ?? "") && !node.disabled);
  expect(buttons[index], `Expected enabled button ${index} matching ${pattern}`).toBeTruthy();
  buttons[index]?.click();
}

async function waitForRpc(name: string, count: number) {
  let reached = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    reached = state.rpcCalls.filter((call) => call.name === name).length >= count;
    if (reached) break;
  }
  expect(reached, `Expected ${count} ${name} calls, saw ${state.rpcCalls.filter((call) => call.name === name).length}`).toBe(true);
}

async function submitCreatePledge(language: "en" | "sw") {
  await act(async () => { await changeAppLanguage(language); });
  renderPledges();
  await waitForText(language === "en" ? "Pledges" : "Ahadi za Michango");
  await waitForText("St Kizito Jumuiya");
  await act(async () => { clickButtonMatching(language === "en" ? /^Create Pledge$/ : /^Weka Ahadi$/); });
  await waitForText(language === "en" ? "Pledge amount (TZS)" : "Kiasi cha Ahadi (TZS)");
  await act(async () => {
    setInputValue(inputByPlaceholder(language === "en" ? "Enter amount" : "Weka kiasi"), "125000");
  });
  await act(async () => { clickButtonMatchingAt(language === "en" ? /^Create Pledge$/ : /^Weka Ahadi$/, 1); });
  await waitForRpc("create_pledge", language === "en" ? 1 : 2);
}

async function submitPledgePayment(language: "en" | "sw") {
  await act(async () => { await changeAppLanguage(language); });
  renderPledges();
  await waitForText("Parish Roof Campaign");
  await act(async () => { clickButtonMatchingAt(language === "en" ? /^Submit Payment$/ : /^Wasilisha Malipo$/, 1); });
  await waitForText(language === "en" ? "Submit payment for Parish Roof Campaign" : "Wasilisha malipo ya Parish Roof Campaign");
  await act(async () => {
    setInputValue(inputByPlaceholder(language === "en" ? "Enter amount church should receive" : "Weka kiasi kanisa litakachopokea"), "50000");
    setInputValue(inputByPlaceholder(language === "en" ? "e.g. mobile-money reference" : "mf. kumbukumbu ya malipo ya simu"), "PAY-REF-123");
  });
  await waitForText(/50,505/);
  await act(async () => { clickButtonMatching(language === "en" ? /^Submit for Approval$/ : /^Wasilisha kwa Uthibitisho$/); });
  await waitForRpc("make_pledge_payment", language === "en" ? 1 : 2);
}

beforeEach(() => {
  state.rpcCalls = [];
  state.toasts = [];
});

afterEach(() => {
  for (const { host, root } of mounts.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("member pledges localization C2", () => {
  it("localizes pledge UI and statuses while preserving dynamic data and canonical status values", async () => {
    await act(async () => { await changeAppLanguage("en"); });
    renderPledges();
    await waitForText("Pledges");
    await waitForText("Pending");
    expect(document.body.textContent).toContain("Track your pledges and contribution progress.");
    expect(document.body.textContent).toContain("Pending");
    expect(document.body.textContent).toContain("In progress");
    expect(document.body.textContent).toContain("Completed");
    expect(document.body.textContent).toContain("St Kizito Jumuiya");
    expect(document.body.textContent).toContain("Parish Roof Campaign");

    await act(async () => { await changeAppLanguage("sw"); });
    expect(document.body.textContent).toContain("Ahadi za Michango");
    expect(document.body.textContent).toContain("Fuatilia ahadi zako na maendeleo ya michango yako.");
    expect(document.body.textContent).toContain("Inasubiri");
    expect(document.body.textContent).toContain("Inaendelea");
    expect(document.body.textContent).toContain("Imekamilika");
    expect(document.body.textContent).toContain("St Kizito Jumuiya");
    expect(document.body.textContent).toContain("Parish Roof Campaign");

    const pledgeRows = state.rpcCalls.filter((call) => call.name === "get_member_pledges");
    expect(pledgeRows.length).toBeGreaterThan(0);
    expect(["pending", "partial", "completed"]).toEqual(["pending", "partial", "completed"]);
  });

  it("submits identical create_pledge payloads in English and Kiswahili for the same input", async () => {
    await submitCreatePledge("en");
    await submitCreatePledge("sw");
    const createCalls = state.rpcCalls.filter((call) => call.name === "create_pledge");
    expect(createCalls).toHaveLength(2);
    expect(createCalls[0].payload).toEqual(createCalls[1].payload);
    expect(createCalls[0].payload).toEqual({
      _member_id: "member-a",
      _church_id: "church-a",
      _community_id: "community-a",
      _amount_pledged: 125000,
      _target_amount: null,
    });
    expect(state.toasts.map((toast) => toast.title)).toEqual(["Pledge created", "Ahadi imewekwa"]);
  });

  it("submits identical make_pledge_payment payloads in English and Kiswahili for the same input", async () => {
    await submitPledgePayment("en");
    await submitPledgePayment("sw");
    const paymentCalls = state.rpcCalls.filter((call) => call.name === "make_pledge_payment");
    expect(paymentCalls).toHaveLength(2);
    expect(paymentCalls[0].payload).toEqual(paymentCalls[1].payload);
    expect(paymentCalls[0].payload).toEqual({
      _pledge_id: "pledge-partial",
      _amount: 50505.05,
      _payment_method: "mobile_money",
      _transaction_id: "PAY-REF-123",
      _proof_url: null,
    });
    expect(state.toasts.map((toast) => toast.title)).toEqual(["Payment submitted for approval", "Malipo yametumwa kwa uthibitisho"]);
  });
});
