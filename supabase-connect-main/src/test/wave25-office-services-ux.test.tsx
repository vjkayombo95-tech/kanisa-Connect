import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EventRequestsPage from "@/pages/church-admin/EventRequestsPage";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const toast = vi.fn();

type RequestRow = {
  id: string;
  church_id: string;
  requester_name: string | null;
  requester_phone: string | null;
  request_type: string | null;
  type: string | null;
  description: string | null;
  preferred_date: string | null;
  status: string | null;
};

const state: {
  requests: RequestRow[];
  updates: Array<{ id: string; churchId: string; status: string }>;
  updatePromise?: Promise<{ data: Array<{ id: string; status: string }>; error: null }>;
  language: "sw" | "en";
} = {
  requests: [],
  updates: [],
  language: "sw",
};

function translate(key: string, options?: Record<string, string>) {
  const resource = state.language === "sw" ? sw : en;
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, resource);

  const text = typeof value === "string" ? value : key;
  return Object.entries(options ?? {}).reduce((result, [name, replacement]) => result.replace(`{{${name}}}`, replacement), text);
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { language: state.language } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "event_requests") throw new Error(`Unexpected table ${table}`);

      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: state.requests, error: null }),
          }),
        }),
        update: (payload: { status: string }) => {
          const updateState = { id: "", churchId: "", status: payload.status };
          return {
            eq: (column: string, value: string) => {
              if (column === "id") updateState.id = value;
              if (column === "church_id") updateState.churchId = value;
              return {
                eq: (nextColumn: string, nextValue: string) => {
                  if (nextColumn === "church_id") updateState.churchId = nextValue;
                  return {
                    select: async () => {
                      state.updates.push(updateState);
                      return state.updatePromise ?? { data: [{ id: updateState.id, status: updateState.status }], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  },
}));

let host: HTMLDivElement;
let root: Root;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <EventRequestsPage />
      </QueryClientProvider>,
    );
  });
}

function buttons() {
  return Array.from(host.querySelectorAll<HTMLButtonElement>("button"));
}

function buttonByText(text: string) {
  const button = buttons().find((item) => item.textContent?.includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
    (element as HTMLElement).click();
  });
}

function expectedDate(date: string, language: "sw" | "en" = state.language) {
  return new Intl.DateTimeFormat(language === "sw" ? "sw-TZ" : "en-TZ", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }
  throw lastError;
}

describe("Wave 25 office services UX", () => {
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    toast.mockReset();
    state.updates = [];
    state.updatePromise = undefined;
    state.language = "sw";
    state.requests = [
      {
        id: "request-confirmation",
        church_id: "church-a",
        requester_name: "Maria Joseph",
        requester_phone: "255712345678",
        request_type: "parish_event",
        type: "confirmation",
        description: "Mtoto amejiandaa kwa Kipaimara na familia imeleta nyaraka zote muhimu.",
        preferred_date: "2026-10-04",
        status: "submitted",
      },
      {
        id: "request-first-communion",
        church_id: "church-a",
        requester_name: "Petro Paulo",
        requester_phone: "255765432100",
        request_type: "parish_event",
        type: "first_communion",
        description: "Familia inaomba Komunyo ya Kwanza kwenye misa ya Jumapili.",
        preferred_date: "2026-10-11",
        status: "under_review",
      },
      {
        id: "request-baptism",
        church_id: "church-a",
        requester_name: "Anna Mushi",
        requester_phone: null,
        request_type: "parish_event",
        type: "baptism",
        description: "Ombi limekamilika.",
        preferred_date: null,
        status: "converted",
      },
    ];
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it("renders working status tabs and responsive request cards with sacramental labels", async () => {
    renderPage();

    await waitFor(() => expect(host.textContent).toContain("Kipaimara"));
    expect(host.textContent).toContain("Mapya");
    expect(host.textContent).toContain("Yanayoshughulikiwa");
    expect(host.textContent).toContain("Yaliyokamilika");
    expect(host.textContent).toContain("Maria Joseph");
    expect(host.textContent).toContain("255712345678");
    expect(host.textContent).toContain(expectedDate("2026-10-04"));
    expect(host.textContent).toContain("Anza kushughulikia");
    expect(host.textContent).toContain("Kataa ombi");

    click(buttonByText("Yanayoshughulikiwa"));
    await waitFor(() => expect(host.textContent).toContain("Komunyo ya Kwanza"));
    expect(host.textContent).toContain("Petro Paulo");
    expect(host.textContent).toContain("Kamilisha");
    expect(host.textContent).toContain(expectedDate("2026-10-11"));

    click(buttonByText("Yaliyokamilika"));
    await waitFor(() => expect(host.textContent).toContain("Ubatizo"));
    expect(host.textContent).not.toContain("Kamilisha");
  });

  it("renders office request labels and dates in English when English is selected", async () => {
    state.language = "en";
    renderPage();

    await waitFor(() => expect(host.textContent).toContain("Confirmation"));
    expect(host.textContent).toContain("New");
    expect(host.textContent).toContain("In progress");
    expect(host.textContent).toContain("Done");
    expect(host.textContent).toContain("Start review");
    expect(host.textContent).toContain("Reject request");
    expect(host.textContent).toContain(expectedDate("2026-10-04", "en"));

    click(buttonByText("In progress"));
    await waitFor(() => expect(host.textContent).toContain("First Communion"));
    expect(host.textContent).toContain("Complete");
    expect(host.textContent).toContain(expectedDate("2026-10-11", "en"));
  });

  it("expands read-only request details without adding edit controls", async () => {
    renderPage();

    await waitFor(() => expect(host.textContent).toContain("Angalia maelezo"));
    const detailsToggle = Array.from(host.querySelectorAll("summary")).find((item) => item.textContent?.includes("Angalia maelezo"));
    expect(detailsToggle).toBeTruthy();
    click(detailsToggle!);

    expect(host.textContent).toContain("Maelezo yote");
    expect(host.textContent).toContain("Mtoto amejiandaa kwa Kipaimara na familia imeleta nyaraka zote muhimu.");
    expect(host.querySelector("textarea, input, [contenteditable='true']")).toBeNull();
  });

  it("keeps existing scoped status transitions and confirmation before rejection", async () => {
    renderPage();

    await waitFor(() => expect(host.textContent).toContain("Anza kushughulikia"));
    click(buttonByText("Anza kushughulikia"));
    await waitFor(() => expect(state.updates).toContainEqual({ id: "request-confirmation", churchId: "church-a", status: "under_review" }));

    click(buttonByText("Kataa ombi"));
    expect(host.textContent).toContain("Kataa ombi hili?");
    click(buttons().filter((button) => button.textContent?.includes("Kataa ombi")).at(-1)!);
    await waitFor(() => expect(state.updates).toContainEqual({ id: "request-confirmation", churchId: "church-a", status: "rejected" }));

    click(buttonByText("Yanayoshughulikiwa"));
    await waitFor(() => expect(host.textContent).toContain("Kamilisha"));
    click(buttonByText("Kamilisha"));
    await waitFor(() => expect(state.updates).toContainEqual({ id: "request-first-communion", churchId: "church-a", status: "converted" }));
  });

  it("disables only the affected request actions while an update is running", async () => {
    state.requests = [
      { ...state.requests[0], id: "request-one", requester_name: "Request One" },
      { ...state.requests[0], id: "request-two", requester_name: "Request Two" },
    ];
    state.updatePromise = new Promise(() => {});

    renderPage();

    await waitFor(() => expect(host.textContent).toContain("Request One"));
    const cardElements = Array.from(host.querySelectorAll<HTMLElement>(".glass-card")).filter((card) => card.textContent?.includes("Kipaimara"));
    const firstCard = cardElements[0];
    const secondCard = cardElements[1];
    const scopedButton = (card: HTMLElement, text: string) => {
      const button = Array.from(card.querySelectorAll<HTMLButtonElement>("button")).find((item) => item.textContent?.includes(text));
      if (!button) throw new Error(`Scoped button not found: ${text}`);
      return button;
    };

    click(scopedButton(firstCard, "Anza kushughulikia"));

    await waitFor(() => expect(scopedButton(firstCard, "Anza kushughulikia")).toBeDisabled());
    expect(scopedButton(firstCard, "Kataa ombi")).toBeDisabled();
    expect(scopedButton(secondCard, "Anza kushughulikia")).not.toBeDisabled();
    expect(scopedButton(secondCard, "Kataa ombi")).not.toBeDisabled();
  });
});
