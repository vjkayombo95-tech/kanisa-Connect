import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AcceptInvitePage from "@/pages/auth/AcceptInvitePage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import { changeAppLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

type LocaleTree = Record<string, unknown>;

const state = vi.hoisted(() => ({
  auth: {
    user: null as { id: string; email?: string } | null,
    profile: null,
    isSuperAdmin: false,
    churchId: null as string | null,
    userRole: null as string | null,
    isLoading: false,
    authorizationError: null as Error | null,
    authorizationFailure: null as string | null,
    refreshUserData: vi.fn(),
  },
  invitation: {
    id: "invite-1",
    token: "token-1",
    email: "member@example.test",
    role: "church_admin",
    status: "pending",
    expires_at: "2026-12-31T00:00:00.000Z",
    churches: { name: "St. Joseph Parish" },
  },
  toast: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: state.toast }),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock("@/lib/public-registration", () => ({
  clearPublicRegistrationCache: vi.fn(),
  fetchPublicJoinChurch: vi.fn(async () => ({
    id: "church-1",
    name: "St. Joseph Parish",
    code: "STJOSEPH",
    slug: "st-joseph",
    metadata: { public_registration_enabled: true },
  })),
  fetchPublicRegistrationChurch: vi.fn(async () => ({
    id: "church-1",
    name: "St. Joseph Parish",
    code: "STJOSEPH",
    slug: "st-joseph",
    metadata: { public_registration_enabled: true },
  })),
  fetchPublicRegistrationCommunities: vi.fn(async () => []),
  fetchPublicRegistrationMinistries: vi.fn(async () => []),
  isPublicRegistrationEnabled: vi.fn(() => true),
  removeRegistrationPhoto: vi.fn(),
  uploadRegistrationPhoto: vi.fn(),
  validateRegistrationPhoto: vi.fn((file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return { valid: false, error: "Please upload a JPG, PNG, or WebP image." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { valid: false, error: "Photo must be 2MB or smaller." };
    }
    return { valid: true };
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  PASSWORD_RECOVERY_PENDING_KEY: "password-recovery-pending",
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(() => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => ({ data: state.invitation, error: null })),
      };
      return chain;
    }),
    rpc: vi.fn(),
  },
}));

let host: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as LocaleTree, path)
      : [path];
  });
}

function text() {
  return host.textContent ?? "";
}

function render(node: ReactNode) {
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        {node}
      </QueryClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function changeInput(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeFileInput(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function waitForElement<T extends Element>(query: () => T | null) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const element = query();
    if (element) return element;
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return null;
}

describe("auth Kiswahili translation", () => {
  beforeEach(async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    state.auth = {
      user: null,
      profile: null,
      isSuperAdmin: false,
      churchId: null,
      userRole: null,
      isLoading: false,
      authorizationError: null,
      authorizationFailure: null,
      refreshUserData: vi.fn(),
    };
    await changeAppLanguage("en");
    vi.mocked(supabase.rpc).mockReset();
    state.toast.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
  });

  it("keeps auth locale keys in parity", () => {
    expect(flattenKeys(sw.auth).sort()).toEqual(flattenKeys(en.auth).sort());
  });

  it("keeps corrected Kiswahili terminology for church code and invite expiry", () => {
    expect(sw.auth.register.church_code).toBe("Msimbo wa Kanisa");
    expect(sw.auth.register.requested_church_code).toContain("Msimbo wa kanisa");
    expect(sw.auth.invite.fields.expires).toBe("Mwisho wa muda");
  });

  it("renders LoginPage in English and Kiswahili with the visible language switcher", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(text()).toContain("Welcome back");
    expect(text()).toContain("Continue with Google");
    expect(host.querySelector("[aria-label='Switch language to Kiswahili']")).toBeTruthy();

    await changeAppLanguage("sw");
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(text()).toContain("Karibu tena");
    expect(text()).toContain("Endelea kwa Google");
    expect(host.querySelector("[aria-label='Badili lugha kwenda Kiingereza']")).toBeTruthy();
  });

  it("renders ForgotPasswordPage in both languages", async () => {
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    await flush();
    expect(text()).toContain("Forgot your password?");
    expect(text()).toContain("Send Reset Link");

    await changeAppLanguage("sw");
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    await flush();
    expect(text()).toContain("Umesahau nenosiri lako?");
    expect(text()).toContain("Tuma Kiungo cha Kuweka Upya");
  });

  it("renders AcceptInvitePage in both languages", async () => {
    render(
      <MemoryRouter initialEntries={["/invite/token-1"]}>
        <Routes>
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await flush();
    expect(text()).toContain("You're Invited!");
    expect(text()).toContain("Sign In to Accept");

    await changeAppLanguage("sw");
    render(
      <MemoryRouter initialEntries={["/invite/token-1"]}>
        <Routes>
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await flush();
    expect(text()).toContain("Umealikwa!");
    expect(text()).toContain("Ingia ili Kubali");
  });

  it("renders RegisterPage fallback in both languages", async () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(text()).toContain("Church Link Required");
    expect(text()).toContain("Return Home");

    await changeAppLanguage("sw");
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(text()).toContain("Kiungo cha Kanisa Kinahitajika");
    expect(text()).toContain("Rudi nyumbani");
  });

  it.each([
    ["en", "Please enter a valid Tanzanian phone number"],
    ["sw", "Tafadhali weka namba halali ya simu ya Tanzania"],
  ] as const)("translates signup phone normalization errors on LoginPage in %s", async (language, expectedDescription) => {
    await changeAppLanguage(language);
    render(
      <MemoryRouter initialEntries={["/login?mode=signup"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    await flush();

    const inputs = Array.from(host.querySelectorAll("input"));
    expect(inputs.length).toBeGreaterThanOrEqual(4);

    await act(async () => {
      changeInput(inputs[0], "Amina Test");
      changeInput(inputs[1], "amina@example.test");
      changeInput(inputs[2], "abc");
      changeInput(inputs[3], "password123");
      host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining(expectedDescription),
      variant: "destructive",
    }));
  });

  it.each([
    ["en", "Please upload a JPG, PNG, or WebP image"],
    ["sw", "Tafadhali pakia picha ya JPG, PNG, au WebP"],
  ] as const)("translates RegisterPage photo validation errors in %s", async (language, expectedDescription) => {
    await changeAppLanguage(language);
    render(
      <MemoryRouter initialEntries={["/register?churchSlug=st-joseph"]}>
        <RegisterPage />
      </MemoryRouter>,
    );
    await flush();
    await flush();

    const fileInput = await waitForElement(() => host.querySelector("input[type='file']") as HTMLInputElement | null);
    expect(fileInput).toBeTruthy();

    await act(async () => {
      changeFileInput(fileInput!, [new File(["bad"], "bad.txt", { type: "text/plain" })]);
    });

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining(expectedDescription),
      variant: "destructive",
    }));
  });

  it.each([
    ["en", "We could not send the reset link. Please try again."],
    ["sw", "Hatukuweza kutuma kiungo cha kuweka upya. Tafadhali jaribu tena."],
  ] as const)("uses localized ForgotPasswordPage fallback for raw reset errors in %s", async (language, expectedDescription) => {
    await changeAppLanguage(language);
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
      data: null,
      error: new Error("SMTP provider leaked implementation detail"),
    } as never);

    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    await flush();

    const emailInput = await waitForElement(() => host.querySelector("input[type='email']") as HTMLInputElement | null);
    expect(emailInput).toBeTruthy();

    await act(async () => {
      changeInput(emailInput!, "amina@example.test");
      host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expectedDescription,
      variant: "destructive",
    }));
    expect(JSON.stringify(state.toast.mock.calls)).not.toContain("SMTP provider");
  });

  it.each([
    ["en", "Unknown error"],
    ["sw", "Hitilafu isiyojulikana"],
  ] as const)("uses localized AcceptInvitePage fallback for raw RPC errors in %s", async (language, expectedDescription) => {
    await changeAppLanguage(language);
    state.auth.user = { id: "user-1", email: "member@example.test" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: new Error("permission denied for table internal_acl"),
    } as never);

    render(
      <MemoryRouter initialEntries={["/invite/token-1"]}>
        <Routes>
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
        </Routes>
      </MemoryRouter>,
    );
    await flush();
    await flush();

    const acceptButton = await waitForElement(() => Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(language === "sw" ? "Kubali Mwaliko" : "Accept Invitation"),
    ) ?? null);
    expect(acceptButton).toBeTruthy();

    await act(async () => {
      acceptButton!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expectedDescription,
      variant: "destructive",
    }));
    expect(JSON.stringify(state.toast.mock.calls)).not.toContain("internal_acl");
  });
});
