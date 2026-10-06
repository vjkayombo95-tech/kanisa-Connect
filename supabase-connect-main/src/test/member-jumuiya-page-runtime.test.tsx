import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";

const BACKEND_ERROR = "permission denied for table member_communities INTERNAL_TEST_ERROR";

const state = vi.hoisted(() => ({
  mode: "single" as "loading" | "single" | "multiple" | "unassigned" | "error" | "error-then-single",
  rpcCalls: [] as Array<{ name: string; args: unknown[] }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (name: string, ...args: unknown[]) => {
      state.rpcCalls.push({ name, args });
      if (state.mode === "loading") return new Promise(() => undefined);
      if (state.mode === "error" || (state.mode === "error-then-single" && state.rpcCalls.length === 1)) {
        return { data: null, error: new Error(BACKEND_ERROR) };
      }
      if (state.mode === "unassigned") return { data: [], error: null };
      if (state.mode === "multiple") {
        return {
          data: [
            { community_name: "Jumuiya ya Mtakatifu Monica", description: "Hukutana kila Alhamisi." },
            { community_name: "Jumuiya ya Mtakatifu Yosefu", description: null },
          ],
          error: null,
        };
      }
      return {
        data: [{ community_name: "Jumuiya ya Mtakatifu Monica", description: "Hukutana kila Alhamisi." }],
        error: null,
      };
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    churchId: "church-a",
    user: { id: "user-a", email: "member-a@example.test" },
  }),
}));

import MemberJumuiyaPage from "@/pages/portal/MemberJumuiyaPage";

const mounts: Array<{ host: HTMLDivElement; root: Root; client: QueryClient }> = [];

function renderPage(ui: ReactNode = <MemberJumuiyaPage />) {
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
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/portal/jumuiya"]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );
  });
  mounts.push({ host, root, client });
  return host;
}

async function waitForText(host: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (host.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error(`Expected "${text}" in rendered output: ${host.textContent}`);
}

function expectNoMutationControls(host: HTMLElement) {
  const interactiveText = Array.from(host.querySelectorAll("button,a"))
    .map((element) => element.textContent ?? "")
    .join(" ");
  expect(interactiveText).not.toMatch(/jiunge|ondoka|badili|hariri|join|leave|change|edit|manage members|roster/i);
}

beforeEach(async () => {
  await i18n.changeLanguage("sw");
  state.mode = "single";
  state.rpcCalls = [];
});

afterEach(() => {
  for (const { host, root, client } of mounts.splice(0)) {
    act(() => root.unmount());
    client.clear();
    host.remove();
  }
});

describe("Wave 12 Slice 4B member Jumuiya page runtime", () => {
  it("renders a loading state without false unassigned copy", async () => {
    state.mode = "loading";
    const host = renderPage();

    await waitForText(host, "Tunaangalia taarifa ya Jumuiya yako...");

    expect(host.textContent).not.toContain("Hujapangiwa Jumuiya");
    expectNoMutationControls(host);
  });

  it("loads one assigned Jumuiya through the canonical RPC", async () => {
    const host = renderPage();

    await waitForText(host, "Jumuiya ya Mtakatifu Monica");

    expect(host.textContent).toContain("Hukutana kila Alhamisi.");
    expect(host.textContent).toContain("Jumuiya uliyopewa");
    expect(state.rpcCalls).toEqual([{ name: "get_my_jumuiya_assignments", args: [{ _church_id: "church-a" }] }]);
    expectNoMutationControls(host);
  });
  it("switches Jumuiya app copy between Swahili and English while preserving dynamic community content", async () => {
  const host = renderPage();

  await waitForText(host, "Jumuiya ya Mtakatifu Monica");

  // Swahili app-owned copy.
  expect(host.textContent).toContain("Jumuiya uliyopewa");
  expect(host.textContent).toContain("Jumuiya Yangu");

  // Dynamic church-provided content.
  expect(host.textContent).toContain("Jumuiya ya Mtakatifu Monica");
  expect(host.textContent).toContain("Hukutana kila Alhamisi.");

  await act(async () => {
    await i18n.changeLanguage("en");
  });

  // App-owned copy changes to English.
  expect(host.textContent).toContain("Your assigned community");
  expect(host.textContent).toContain("My Small Christian Community");

  // Dynamic church-provided content must not be translated.
  expect(host.textContent).toContain("Jumuiya ya Mtakatifu Monica");
  expect(host.textContent).toContain("Hukutana kila Alhamisi.");

  // Language switching must not cause another backend request.
  expect(state.rpcCalls).toEqual([
    {
      name: "get_my_jumuiya_assignments",
      args: [{ _church_id: "church-a" }],
    },
  ]);

  expectNoMutationControls(host);
});

  it("preserves multiple assigned Jumuiya rows and uses only member-safe fields", async () => {
    state.mode = "multiple";
    const host = renderPage();

    await waitForText(host, "Jumuiya ya Mtakatifu Yosefu");

    expect(host.querySelectorAll('[data-testid="member-jumuiya-assignment"]')).toHaveLength(2);
    expect(host.textContent).toContain("Jumuiya 1 kati ya 2");
    expect(host.textContent).toContain("Jumuiya 2 kati ya 2");
    expect(host.textContent).not.toMatch(/community-a|member-a|church-a|0700000000|member-a@example/i);
    expectNoMutationControls(host);
  });

  it("renders truthful unassigned copy only after an empty successful RPC result", async () => {
    state.mode = "unassigned";
    const host = renderPage();

    await waitForText(host, "Hujapangiwa Jumuiya kwa sasa.");

    expect(host.textContent).toContain("Wasiliana na ofisi ya parokia");
    expectNoMutationControls(host);
  });

  it("renders a safe error without backend details or false unassigned state", async () => {
    state.mode = "error";
    const host = renderPage();

    await waitForText(host, "Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.");

    expect(host.textContent).not.toContain(BACKEND_ERROR);
    expect(host.textContent).not.toContain("Hujapangiwa Jumuiya");
    expectNoMutationControls(host);
  });

  it("retries after a failed load without exposing raw errors", async () => {
    state.mode = "error-then-single";
    const host = renderPage();

    await waitForText(host, "Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.");
    const retry = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Jaribu tena"));
    expect(retry).toBeDefined();

    await act(async () => {
      retry?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await waitForText(host, "Jumuiya ya Mtakatifu Monica");

    expect(state.rpcCalls.map((call) => call.name)).toEqual([
      "get_my_jumuiya_assignments",
      "get_my_jumuiya_assignments",
    ]);
    expect(host.textContent).not.toContain(BACKEND_ERROR);
    expect(host.textContent).not.toContain("Hujapangiwa Jumuiya");
    expectNoMutationControls(host);
  });
});

describe("Wave 12 Slice 4B route and navigation contract", () => {
  const root = process.cwd();
  const page = readFileSync(join(root, "src/pages/portal/MemberJumuiyaPage.tsx"), "utf8");
  const helper = readFileSync(join(root, "src/lib/member-jumuiya.ts"), "utf8");
  const routes = readFileSync(join(root, "src/routes/MemberRoutes.tsx"), "utf8");
  const registry = readFileSync(join(root, "src/lib/member-service-registry.ts"), "utf8");
  const layout = readFileSync(join(root, "src/components/portal/PortalLayout.tsx"), "utf8");
  const backHeader = readFileSync(join(root, "src/components/portal/MemberMobileBackHeader.tsx"), "utf8");
  const channels = readFileSync(join(root, "src/pages/portal/PortalChannels.tsx"), "utf8");

  it("exposes the member route and service navigation entry for Jumuiya Yangu", () => {
    expect(routes).toContain('const MemberJumuiyaPage = lazy(() => import("@/pages/portal/MemberJumuiyaPage"));');
    expect(routes).toContain('path="jumuiya" element={<MemberJumuiyaPage />}');
    expect(registry).toContain('id: "jumuiya"');
    expect(registry).toContain('path: "/portal/jumuiya"');
    expect(registry).toContain('label: "Jumuiya Yangu"');
    expect(registry).toContain('labelKey: "member_services.jumuiya.label"');
    expect(registry).toContain('backTitleKey: "member_services.jumuiya.back_title"');
    expect(registry).toContain("ordinaryMemberAllowed: true");
    expect(layout).toContain('serviceNavItem("jumuiya", "/portal/jumuiya", CommunitiesIcon)');
    expect(backHeader).toContain("getMemberBackTitleKey(pathname)");
    expect(backHeader).not.toContain('"/portal/jumuiya": "Jumuiya Yangu"');
  });

  it("uses only the canonical no-argument RPC and does not recreate membership resolution client-side", () => {
    expect(helper).toContain('supabase.rpc("get_my_jumuiya_assignments" as never, { _church_id: churchId } as never)');
    expect(helper).not.toContain(".from(");
    expect(helper).not.toContain("member_id");
    expect(page).toContain("memberJumuiyaAssignmentsQueryKey(user?.id, churchId)");
    expect(page).toContain("queryFn: () => fetchMyJumuiyaAssignments(churchId!)");
    expect(page).not.toContain("useLinkedMember");
  });

  it("keeps Jumuiya distinct from Channels and avoids member mutation controls", () => {
    expect(registry).toContain('backTitleKey: "member_services.channels.back_title"');
    expect(backHeader).not.toContain('"/portal/channels": "Njia za Mawasiliano"');
    expect(registry).not.toContain('path: "/portal/channels", label: "Jumuiya');
    expect(channels).toContain('title="Channels"');
    expect(channels).toContain("ChannelWorkspace");
    expect(page).not.toMatch(/join|leave|change|edit|roster|phone|email|contribution|pledge|member_id|community_id|church_id/i);
  });

 it("uses localized Jumuiya copy while preserving safe error/retry/empty semantics", () => {
  for (const key of [
    "member_services.jumuiya.label",
    "member_services.jumuiya.back_title",
    "member_jumuiya.description",
    "member_jumuiya.assignment.position",
    "member_jumuiya.assignment.single_label",
    "member_jumuiya.assignment.multiple_label",
    "member_jumuiya.assignment.no_description",
    "member_jumuiya.loading.aria_label",
    "member_jumuiya.loading.message",
    "member_jumuiya.error.title",
    "member_jumuiya.error.description",
    "member_jumuiya.unassigned.title",
    "member_jumuiya.unassigned.description",
    "shared.actions.retry",
  ]) {
    expect(page).toContain(key);
  }

  expect(page).not.toContain("Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.");
  expect(page).not.toContain("Hujapangiwa Jumuiya kwa sasa.");
  expect(page).not.toContain("Maelezo ya Jumuiya hii bado hayajawekwa.");
  expect(page).not.toContain("assignments.error");
  expect(page).not.toContain("error.message");
});

});
