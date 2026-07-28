import { readFileSync } from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    isSuperAdmin: false,
    churchId: null,
    userRole: null,
    userRoles: [],
    isLoading: false,
    authorizationReady: true,
    authorizationError: null,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword,
      signUp: vi.fn(),
      resend: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import LoginPage from "@/pages/auth/LoginPage";

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

afterEach(async () => {
  signInWithPassword.mockClear();
  while (mounted.length) {
    const item = mounted.pop();
    if (!item) continue;
    await act(async () => item.root.unmount());
    item.container.remove();
  }
});

describe("login runtime initialization", () => {
  it("keeps the shared CommonJS runtime outside React and charts vendor chunks", () => {
    const viteConfig = readFileSync(path.resolve(process.cwd(), "vite.config.ts"), "utf8");
    const runtimeRule = viteConfig.indexOf('id.includes("commonjsHelpers")');
    const nodeModulesRule = viteConfig.indexOf('!id.includes("node_modules")');

    expect(runtimeRule).toBeGreaterThan(-1);
    expect(runtimeRule).toBeLessThan(nodeModulesRule);
    expect(viteConfig).toContain('return "runtime-vendor"');
  });

  it("mounts the anonymous login page without making an authentication request", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ container, root });

    expect(() => {
      act(() => root.render(
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>,
      ));
    }).not.toThrow();

    expect(container.querySelector('[data-testid="login-identity"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="login-password"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="login-submit"]')).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
