import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import KanisaAIHome from "@/pages/ai/KanisaAIHome";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "member@example.com" },
    churchId: "church-1",
    isSuperAdmin: false,
    userRole: "member",
  }),
}));

vi.mock("@/components/workspace", () => ({
  getWorkspaceIdForRole: () => "member",
  useWorkspaceContext: () => ({ workspace: { id: "member" } }),
}));

async function renderKanisaAIHome() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/portal/kanisa-ai"]}>
          <KanisaAIHome />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });

  return { container, root };
}

describe("KanisaAIHome", () => {
  it("renders with authenticated member context without undefined user crashes", async () => {
    const { container, root } = await renderKanisaAIHome();

    expect(container.textContent).toContain("Kanisa AI");
    expect(container.querySelector("#kanisa-ai-composer")).toBeTruthy();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
