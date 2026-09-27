import { readFileSync } from "node:fs";
import path from "node:path";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changeAppLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import OnboardingPage from "@/pages/auth/OnboardingPage";

type LocaleTree = Record<string, unknown>;

const readFile = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

const state = vi.hoisted(() => ({
  auth: {
    user: {
      id: "user-1",
      email: "admin@example.test",
      user_metadata: { full_name: "Amina Admin" },
    },
    refreshUserData: vi.fn(),
  },
  toast: vi.fn(),
  churchUpdate: vi.fn(() => ({ eq: vi.fn(async () => ({ data: null, error: null })) })),
  storageUpload: vi.fn(async () => ({ data: { path: "church-1/logo.png" }, error: null })),
  storageGetPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://cdn.example/church-1/logo.png" } })),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const motion = new Proxy({}, {
    get: (_target, tag: string) =>
      React.forwardRef<HTMLElement, Record<string, any>>(
        ({ children, layout, initial, animate, exit, transition, ...props }, ref) =>
          React.createElement(tag, { ...props, ref }, children)
      ),
  });

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: state.toast }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn((table: string) => {
      if (table !== "churches") throw new Error(`Unexpected table ${table}`);
      return { update: state.churchUpdate };
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        if (bucket !== "church-assets") throw new Error(`Unexpected bucket ${bucket}`);
        return {
          upload: state.storageUpload,
          getPublicUrl: state.storageGetPublicUrl,
        };
      }),
    },
  },
}));

let host: HTMLDivElement;
let root: Root;

function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as LocaleTree, keyPath)
      : [keyPath];
  });
}

function render(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function text() {
  return host.textContent ?? "";
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function changeFileInput(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function clickButton(name: string) {
  const button = Array.from(host.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(name) || candidate.getAttribute("aria-label") === name,
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

function renderOnboarding() {
  render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/church-admin" element={<div>Church admin reached</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("auth onboarding Kiswahili translation", () => {
  beforeEach(async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    state.toast.mockClear();
    state.auth.refreshUserData.mockClear();
    state.churchUpdate.mockClear();
    state.storageUpload.mockClear();
    state.storageGetPublicUrl.mockClear();
    vi.mocked(supabase.rpc).mockReset();
    vi.mocked(supabase.from).mockClear();
    vi.mocked(supabase.storage.from).mockClear();
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, {
        createObjectURL: vi.fn(() => "blob:onboarding-test"),
        revokeObjectURL: vi.fn(),
      }),
    );
    await changeAppLanguage("en");
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps onboarding locale keys in parity and /join/:slug routed to RegisterPage", () => {
    expect(flattenKeys(sw.auth.onboarding).sort()).toEqual(flattenKeys(en.auth.onboarding).sort());

    const appSource = readFile("src/App.tsx");
    expect(appSource).toContain('<Route path="/join/:slug" element={<RegisterPage />} />');
    expect(appSource).toMatch(/<Route\s+path="\/onboarding"/);
  });

  it("renders onboarding in English and Kiswahili with a visible language switcher", async () => {
    renderOnboarding();

    expect(text()).toContain("Launch your church workspace");
    expect(text()).toContain("Church Information");
    expect(text()).toContain("Church Name *");
    expect(host.querySelector("[aria-label='Switch language to Kiswahili']")).toBeTruthy();

    await clickButton("SW");
    await flush();

    expect(text()).toContain("Fungua workspace ya kanisa lako");
    expect(text()).toContain("Taarifa za Kanisa");
    expect(text()).toContain("Jina la Kanisa *");
    expect(host.querySelector("[aria-label='Badili lugha kwenda Kiingereza']")).toBeTruthy();
  });

  it.each([
    ["en", "Finish church details", "Church name and email are required before continuing."],
    ["sw", "Kamilisha taarifa za kanisa", "Jina la kanisa na barua pepe vinahitajika kabla ya kuendelea."],
  ] as const)("localizes required-detail validation in %s", async (language, expectedTitle, expectedDescription) => {
    await changeAppLanguage(language);
    renderOnboarding();

    await clickButton(language === "sw" ? "Endelea" : "Next");
    await flush();

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: expectedTitle,
      description: expectedDescription,
      variant: "destructive",
    }));
  });

  it.each([
    ["en", "Invalid file type", "Please use JPG, PNG, or WebP."],
    ["sw", "Aina ya faili si sahihi", "Tafadhali tumia JPG, PNG, au WebP."],
  ] as const)("localizes onboarding upload validation in %s", async (language, expectedTitle, expectedDescription) => {
    await changeAppLanguage(language);
    renderOnboarding();

    const inputs = host.querySelectorAll("input");
    changeInput(inputs[0], "St. Joseph Parish");
    changeInput(host.querySelector('input[type="email"]') as HTMLInputElement, "info@example.test");
    await clickButton(language === "sw" ? "Endelea" : "Next");
    await flush();

    expect(host.querySelectorAll("input[type=file]").length, JSON.stringify({ inputs: Array.from(host.querySelectorAll("input")).map(i => ({ type: i.type, value: i.value })), toast: state.toast.mock.calls, page: text() })).toBe(2);
    const fileInput = host.querySelector("input[type='file']") as HTMLInputElement;
    await act(async () => {
      changeFileInput(fileInput, [new File(["bad"], "bad.txt", { type: "text/plain" })]);
    });

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: expectedTitle,
      description: expectedDescription,
      variant: "destructive",
    }));
  });

  it("preserves onboarding RPC, storage, refresh and redirect contracts", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: "church-1", code: "STJ", name: "St. Joseph Parish" },
      error: null,
    } as never);
    renderOnboarding();

    const inputs = host.querySelectorAll("input");
    changeInput(inputs[0], "St. Joseph Parish");
    changeInput(host.querySelector('input[type="email"]') as HTMLInputElement, "info@example.test");
    changeInput(host.querySelectorAll("input")[2] as HTMLInputElement, "+255712345678");
    changeInput(host.querySelectorAll("input")[3] as HTMLInputElement, "Dar es Salaam");
    await clickButton("Next");

    expect(host.querySelectorAll("input[type=file]").length, JSON.stringify({ inputs: Array.from(host.querySelectorAll("input")).map(i => ({ type: i.type, value: i.value })), toast: state.toast.mock.calls, page: text() })).toBe(2);
    await act(async () => {
      changeFileInput(host.querySelectorAll("input[type='file']")[0] as HTMLInputElement, [new File(["logo"], "logo.png", { type: "image/png" })]);
    });
    await act(async () => {
      changeFileInput(host.querySelectorAll("input[type='file']")[1] as HTMLInputElement, [new File(["banner"], "banner.webp", { type: "image/webp" })]);
    });
    await clickButton("Next");
    await clickButton("Next");
    await clickButton("Create Church");
    await flush();

    expect(supabase.rpc).toHaveBeenCalledWith("create_church_workspace", {
      _name: "St. Joseph Parish",
      _email: "info@example.test",
      _phone: "+255712345678",
      _address: "Dar es Salaam",
      _owner_name: "Amina Admin",
    });
    expect(supabase.storage.from).toHaveBeenCalledWith("church-assets");
    expect(state.storageUpload).toHaveBeenCalledWith("church-1/logo.png", expect.any(File), { upsert: true });
    expect(state.storageUpload).toHaveBeenCalledWith("church-1/banner.webp", expect.any(File), { upsert: true });
    expect(supabase.from).toHaveBeenCalledWith("churches");
    expect(state.churchUpdate).toHaveBeenCalledWith({
      logo_url: "https://cdn.example/church-1/logo.png",
      banner_url: "https://cdn.example/church-1/logo.png",
    });
    expect(state.auth.refreshUserData).toHaveBeenCalled();
    expect(text()).toContain("Church admin reached");
  });

  it("uses a safe localized fallback for unknown creation errors and preserves setup guidance", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: new Error("permission denied for table internal_acl"),
    } as never);
    renderOnboarding();

    const inputs = host.querySelectorAll("input");
    changeInput(inputs[0], "St. Joseph Parish");
    changeInput(host.querySelector('input[type="email"]') as HTMLInputElement, "info@example.test");
    await clickButton("Next");
    await clickButton("Next");
    await clickButton("Next");
    await clickButton("Create Church");
    await flush();

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: "Church workspace could not be created. Please try again or contact support.",
      variant: "destructive",
    }));
    expect(JSON.stringify(state.toast.mock.calls)).not.toContain("internal_acl");

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "create_church_workspace missing" },
    } as never);
    await clickButton("Create Church");
    await flush();

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: "The latest database setup has not been applied. Apply the Supabase workspace-creation migration, then try again.",
      variant: "destructive",
    }));
  });
});
