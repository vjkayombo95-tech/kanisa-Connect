import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnnouncementsPage from "@/pages/church-admin/AnnouncementsPage";

type TemplateResponse = {
  data: Array<Record<string, unknown>> | null;
  error: { message?: string; details?: string; hint?: string; code?: string } | null;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const state = vi.hoisted(() => ({
  templateResponses: [] as Array<Promise<TemplateResponse> | TemplateResponse>,
  templateRequests: [] as Array<{ language: string; types: string[] }>,
  toast: vi.fn(),
}));

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function liveTemplate(title: string, content: string, language = "sw", type = "service") {
  return {
    id: `${type}-${language}-${title.toLowerCase().replace(/\W+/g, "-")}`,
    type,
    language,
    title,
    content,
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
  };
}

function nextTemplateResponse() {
  const next = state.templateResponses.shift();
  return next ? Promise.resolve(next) : Promise.resolve({ data: [], error: null });
}

function createSupabaseBuilder(table: string) {
  const builder = {} as {
    select: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };
  const localState: { types: string[] } = { types: [] };

  builder.select = vi.fn(() => builder);
  builder.in = vi.fn((_column: string, values: string[]) => {
    localState.types = values;
    return builder;
  });
  builder.eq = vi.fn((column: string, value: string) => {
    if (table === "message_templates" && column === "language") {
      state.templateRequests.push({ language: value, types: localState.types });
      return nextTemplateResponse();
    }
    return builder;
  });
  builder.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { name: "St Joseph" }, error: null }));
  builder.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));

  return builder;
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a", user: { id: "user-a" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: state.toast }),
}));

vi.mock("@/lib/birthday-announcements", () => ({
  ensureBirthdayAnnouncements: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/whatsapp-share", () => ({
  buildAnnouncementShareMessage: vi.fn(() => "announcement share"),
  openWhatsAppShare: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => createSupabaseBuilder(table)),
    rpc: vi.fn(() => Promise.resolve({ data: { success: true, id: "announcement-a" }, error: null })),
  },
}));

const mounts: Array<{ host: HTMLDivElement; root: Root; client: QueryClient }> = [];

function renderPage(ui: ReactNode = <AnnouncementsPage />) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  act(() => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });
  mounts.push({ host, root, client });
  return host;
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function flushTemplateTimers(ms = 1600) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flushMicrotasks();
}

async function waitForText(host: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (host.textContent?.includes(text)) return;
    await flushMicrotasks();
  }
  throw new Error(`Expected "${text}" in rendered output: ${host.textContent}`);
}

function buttons(host: HTMLElement, text: string) {
  return Array.from(host.querySelectorAll("button")).filter((button) => button.textContent?.trim() === text);
}

function clickButton(host: HTMLElement, text: string, index = 0) {
  const button = buttons(host, text)[index];
  if (!button) throw new Error(`Button "${text}" not found in: ${host.textContent}`);

  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function draftMessage(host: HTMLElement) {
  const textarea = Array.from(host.querySelectorAll("textarea")).find(
    (element) => element.placeholder === "Generated message will appear here...",
  );
  if (!textarea) throw new Error("Draft message textarea was not rendered.");
  return textarea as HTMLTextAreaElement;
}

function queueTemplates(data: Array<Record<string, unknown>>) {
  state.templateResponses.push({ data, error: null });
}

function queueTemplateError(message: string) {
  state.templateResponses.push({ data: null, error: { message } });
}

beforeEach(() => {
  vi.useFakeTimers();
  state.templateResponses.length = 0;
  state.templateRequests.length = 0;
  state.toast.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const { host, root, client } of mounts.splice(0)) {
    act(() => root.unmount());
    client.clear();
    host.remove();
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Wave 18 announcement template runtime behavior", () => {
  it("renders live templates and applies the selected content to the draft", async () => {
    queueTemplates([liveTemplate("Live Sunday Template", "Live Sunday content for the church.")]);
    const host = renderPage();

    clickButton(host, "Announce Sunday Service");
    await flushTemplateTimers();

    await waitForText(host, "Live Sunday Template");
    clickButton(host, "Use this");

    expect(draftMessage(host).value).toBe("Live Sunday content for the church.");
    expect(host.textContent).not.toContain("Using local mock templates");
  });

  it("shows an explicit empty state without injecting mock template content", async () => {
    queueTemplates([]);
    const host = renderPage();

    clickButton(host, "Announce Sunday Service");
    await flushTemplateTimers();

    await waitForText(host, "No saved templates are configured for this message type and language yet.");
    expect(host.textContent).not.toContain("Sunday Service Announcement");
    expect(host.textContent).not.toContain("Using local mock templates");
    expect(draftMessage(host).value).toBe("");
  });

  it("clears template cards and shows sanitized retryable copy on retrieval failure", async () => {
    queueTemplates([liveTemplate("Template Before Failure", "Existing live content.")]);
    queueTemplateError("Could not find the table 'public.message_templates' in the schema cache");
    const host = renderPage();

    clickButton(host, "Announce Sunday Service");
    await flushTemplateTimers();
    await waitForText(host, "Template Before Failure");

    clickButton(host, "Regenerate");
    await flushTemplateTimers();

    expect(host.textContent).not.toContain("Template Before Failure");
    await waitForText(host, "Templates could not be loaded right now. Try again in a moment.");
    expect(buttons(host, "Retry loading templates").length).toBeGreaterThan(0);
    expect(host.textContent).not.toMatch(/Supabase|schema cache|Settings -> API/i);
  });

  it("can retry after a failure and display the subsequent live result", async () => {
    queueTemplateError("failed to fetch");
    queueTemplates([liveTemplate("Retry Live Template", "Retry live content.")]);
    const host = renderPage();

    clickButton(host, "Announce Sunday Service");
    await flushTemplateTimers();
    await waitForText(host, "Templates could not be loaded. Check your connection and try again.");

    clickButton(host, "Retry loading templates");
    await flushTemplateTimers();

    await waitForText(host, "Retry Live Template");
    expect(host.textContent).not.toContain("Using local mock templates");
  });

  it("ignores an older template response when a newer language request wins", async () => {
    queueTemplates([liveTemplate("Initial Template", "Initial live content.")]);
    const host = renderPage();

    clickButton(host, "Announce Sunday Service");
    await flushTemplateTimers();
    await waitForText(host, "Initial Template");

    const olderEnglish = deferred<TemplateResponse>();
    const newerSwahili = deferred<TemplateResponse>();
    state.templateResponses.push(olderEnglish.promise, newerSwahili.promise);

    clickButton(host, "EN");
    clickButton(host, "SW");
    await flushTemplateTimers(400);

    newerSwahili.resolve({ data: [liveTemplate("Newest Swahili Template", "Newest live content.", "sw")], error: null });
    await flushTemplateTimers(1200);
    await waitForText(host, "Newest Swahili Template");

    olderEnglish.resolve({ data: [liveTemplate("Stale English Template", "Stale live content.", "en")], error: null });
    await flushTemplateTimers(1200);

    expect(host.textContent).not.toContain("Stale English Template");
    expect(host.textContent).toContain("Newest Swahili Template");
    expect(state.templateRequests.map((request) => request.language)).toEqual(["sw", "en", "sw"]);
  });

  it("keeps normal template UI free of technical or mock recovery copy", async () => {
    queueTemplates([liveTemplate("Plain Template", "Plain live content.")]);
    const host = renderPage();

    clickButton(host, "Announce Sunday Service");
    await flushTemplateTimers();

    await waitForText(host, "Plain Template");
    expect(host.textContent).not.toMatch(/Supabase|schema cache|Settings -> API|Using local mock templates/i);
  });
});
