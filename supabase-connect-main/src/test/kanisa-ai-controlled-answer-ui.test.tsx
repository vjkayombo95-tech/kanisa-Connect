import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import KanisaAIHome, { ConversationResponseCard } from "@/pages/ai/KanisaAIHome";
import type { KanisaAIConversationResponse } from "@/lib/ai";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "member@example.com" }, churchId: "church-1", isSuperAdmin: false, userRole: "member" }),
}));

vi.mock("@/components/workspace", () => ({
  getWorkspaceIdForRole: () => "member",
  useWorkspaceContext: () => ({ workspace: { id: "member" } }),
}));

function response(overrides: Partial<KanisaAIConversationResponse> = {}): KanisaAIConversationResponse {
  return {
    id: "answer-1",
    intent: "UPCOMING_EVENTS",
    status: "success",
    title: "Upcoming Events",
    summary: "There are 2 upcoming events in the next 7 days.",
    message: "There are 2 upcoming events in the next 7 days.",
    sections: [],
    actions: [{ id: "events", label: "View events", route: "/portal/events" }],
    suggestions: [],
    sourceType: "local-router",
    providerRequired: false,
    ...overrides,
  };
}

async function renderNode(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, root };
}

async function renderCard(value: KanisaAIConversationResponse) {
  return renderNode(<MemoryRouter><ConversationResponseCard response={value} onPreview={vi.fn()} onRetry={vi.fn()} /></MemoryRouter>);
}

async function cleanup(container: HTMLElement, root: Root) {
  await act(async () => root.unmount());
  container.remove();
}

describe("Kanisa AI controlled answer UI", () => {
  it("renders a natural-language summary", async () => {
    const rendered = await renderCard(response());
    expect(rendered.container.textContent).toContain("There are 2 upcoming events in the next 7 days.");
    await cleanup(rendered.container, rendered.root);
  });

  it("renders the controlled action as the correct deep link", async () => {
    const rendered = await renderCard(response());
    expect(rendered.container.querySelector("a")?.getAttribute("href")).toBe("/portal/events");
    await cleanup(rendered.container, rendered.root);
  });

  it("renders a controlled error and retry action", async () => {
    const rendered = await renderCard(response({ status: "error", summary: "Kanisa AI could not load this information right now.", actions: [{ id: "retry", label: "Retry", retryInput: "events" }] }));
    expect(rendered.container.textContent).toContain("Kanisa AI could not load this information right now.");
    expect(rendered.container.querySelector("button")?.textContent).toContain("Retry");
    await cleanup(rendered.container, rendered.root);
  });

  it("escapes arbitrary HTML instead of injecting it", async () => {
    const rendered = await renderCard(response({ summary: '<img src=x onerror="alert(1)">', message: '<img src=x onerror="alert(1)">' }));
    expect(rendered.container.querySelector("img")).toBeNull();
    expect(rendered.container.textContent).toContain('<img src=x onerror="alert(1)">');
    await cleanup(rendered.container, rendered.root);
  });

  it("shows the existing loading state while a question is being checked", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rendered = await renderNode(<QueryClientProvider client={queryClient}><MemoryRouter><KanisaAIHome /></MemoryRouter></QueryClientProvider>);
    const composer = rendered.container.querySelector("textarea")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(composer, "What events are coming up?");
      composer.dispatchEvent(new Event("input", { bubbles: true }));
      composer.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(rendered.container.querySelector('[aria-busy="true"]')).toBeTruthy();
    await cleanup(rendered.container, rendered.root);
  });
});
