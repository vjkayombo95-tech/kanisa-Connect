import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { changeAppLanguage } from "@/i18n";

type RpcPayload = {
  p_church_id: string;
  p_amount: number;
  p_idempotency_key: string;
  p_member_id: string | null;
  p_donor_name: string;
  p_phone: string | null;
  p_payment_reference: string | null;
  p_category_id: string | null;
  p_notes: string | null;
};

type RpcCall = {
  name: string;
  payload: RpcPayload;
};

type ToastCall = {
  title: string;
  description?: string;
  variant?: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

const state = vi.hoisted(() => ({
  rpcPayloads: [] as RpcCall[],
  toasts: [] as ToastCall[],
  uuidCounter: 0,
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

vi.mock("@/components/ui/ContributionCategorySelector", () => ({
  ContributionCategorySelector: ({
    categories,
    value,
    onValueChange,
    placeholderKey,
    translateLabels,
  }: {
    categories: CategoryOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholderKey: string;
    translateLabels: boolean;
  }) => (
    <select
      aria-label="Contribution category"
      data-placeholder-key={placeholderKey}
      data-translate-labels={String(translateLabels)}
      value={value}
      onChange={(event) => onValueChange((event.target as HTMLSelectElement).value)}
    >
      <option value="">Choose</option>
      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      type CategoryBuilder = {
        select: () => CategoryBuilder;
        eq: () => CategoryBuilder;
        ilike: () => CategoryBuilder;
        order: () => Promise<{ data: Array<{ id: string; name: string }>; error: null }>;
      };
      const builder: CategoryBuilder = {
        select: () => builder,
        eq: () => builder,
        ilike: () => builder,
        order: async () => ({
          data: [
            { id: "category-offering", name: "Offering" },
            { id: "category-special", name: "Special Parish Campaign" },
          ],
          error: null,
        }),
        maybeSingle: async () => {
          if (table !== "members") throw new Error(`Unexpected maybeSingle table ${table}`);
          return {
            data: { id: "member-a", full_name: "Amina Dynamic", phone: "+255700000001", email: "member-a@example.test" },
            error: null,
          };
        },
      };
      return builder;
    },
    rpc: async (name: string, payload: RpcPayload) => {
      state.rpcPayloads.push({ name, payload });
      return { data: { success: true }, error: null };
    },
  },
}));

import PortalGive from "@/pages/portal/PortalGive";

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

const mounts: Array<{ host: HTMLDivElement; root: Root }> = [];

function renderGive() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Providers><PortalGive /></Providers>));
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
  expect(found, `Expected ${String(text)} in ${host.textContent}`).toBe(true);
}

function inputByPlaceholder(host: HTMLElement, placeholder: string) {
  const input = Array.from(host.querySelectorAll("input")).find((node) => node.getAttribute("placeholder") === placeholder);
  expect(input, `Expected input with placeholder ${placeholder}`).toBeTruthy();
  return input as HTMLInputElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function fillAndSubmit(host: HTMLElement, labels: { amountPlaceholder: string; paymentPlaceholder: string; submitText: string }) {
  await waitForText(host, labels.submitText);
  await act(async () => {
    setInputValue(inputByPlaceholder(host, labels.amountPlaceholder), "25000");
    setInputValue(inputByPlaceholder(host, "+255..."), "+255712345678");
    setInputValue(inputByPlaceholder(host, labels.paymentPlaceholder), "MPESA-REF-123");
    const category = host.querySelector('select[aria-label="Contribution category"]') as HTMLSelectElement;
    category.value = "category-special";
    category.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await waitForText(host, /25,000/);
  await act(async () => {
    Array.from(host.querySelectorAll("button")).find((button) => /Record|Rekodi/.test(button.textContent ?? "") && !button.disabled)?.click();
  });
}

beforeEach(() => {
  state.rpcPayloads = [];
  state.toasts = [];
  state.uuidCounter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-${String(++state.uuidCounter).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`);
});

afterEach(() => {
  for (const { host, root } of mounts.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  vi.restoreAllMocks();
});

describe("member Give localization C1", () => {
  it("localizes EN and SW static UI while preserving tenant category names", async () => {
    await act(async () => { await changeAppLanguage("en"); });
    const host = renderGive();
    await waitForText(host, "Give");
    expect(host.textContent).toContain("Record your contribution to the parish.");
    expect(host.textContent).toContain("Contribution amount");
    expect(host.textContent).toContain("Payment reference");
    expect(host.textContent).toContain("Offering");
    expect(host.textContent).toContain("Special Parish Campaign");
    expect(host.querySelector('select[aria-label="Contribution category"]')?.getAttribute("data-translate-labels")).toBe("false");
    expect(host.querySelector('a[href="/portal/contribution-history"]')).not.toBeNull();

    await act(async () => { await changeAppLanguage("sw"); });
    expect(host.textContent).toContain("Michango");
    expect(host.textContent).toContain("Rekodi mchango wako kwa parokia.");
    expect(host.textContent).toContain("Kiasi cha mchango");
    expect(host.textContent).toContain("Kumbukumbu ya malipo");
    expect(host.textContent).toContain("Offering");
    expect(host.textContent).toContain("Special Parish Campaign");
  });

  it("submits identical financial payloads in English and Kiswahili for the same input", async () => {
    await act(async () => { await changeAppLanguage("en"); });
    const enHost = renderGive();
    await fillAndSubmit(enHost, {
      amountPlaceholder: "Enter amount",
      paymentPlaceholder: "Example: M-Pesa or bank",
      submitText: "Record Contribution",
    });
    await waitForText(enHost, "Contribution recorded");

    await act(async () => { await changeAppLanguage("sw"); });
    const swHost = renderGive();
    await fillAndSubmit(swHost, {
      amountPlaceholder: "Weka kiasi",
      paymentPlaceholder: "Mfano: M-Pesa au benki",
      submitText: "Rekodi Mchango",
    });
    await waitForText(swHost, "Mchango umerekodiwa");

    expect(state.rpcPayloads).toHaveLength(2);
    expect(state.rpcPayloads[0].name).toBe("record_contribution_with_key");
    expect(state.rpcPayloads[1].name).toBe("record_contribution_with_key");
    expect({ ...state.rpcPayloads[0].payload, p_idempotency_key: "stable-key" }).toEqual({
      ...state.rpcPayloads[1].payload,
      p_idempotency_key: "stable-key",
    });
    expect(state.rpcPayloads[0].payload).toMatchObject({
      p_church_id: "church-a",
      p_amount: 25000,
      p_member_id: "member-a",
      p_donor_name: "Amina Dynamic",
      p_phone: "+255712345678",
      p_payment_reference: "MPESA-REF-123",
      p_category_id: "category-special",
      p_notes: null,
    });
    expect(state.rpcPayloads[0].payload.p_idempotency_key).not.toBe(state.rpcPayloads[1].payload.p_idempotency_key);
    expect(state.toasts.map((toast) => toast.title)).toEqual(["Contribution recorded", "Mchango umerekodiwa"]);
  });
});
