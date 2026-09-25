import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Filter = {
  method: "eq" | "is";
  column: string;
  value: unknown;
};

type UpdateCall = {
  table: string;
  payload: Record<string, unknown>;
  filters: Filter[];
};

type DeleteCall = {
  table: string;
  filters: Filter[];
};

const state = vi.hoisted(() => ({
  language: "sw" as "sw" | "en",
  toasts: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<{ table: string; payload: unknown }>,
  updates: [] as UpdateCall[],
  updateResults: [] as Array<{ data: Array<{ id: string }>; error: { message: string } | null }>,
  deletes: [] as DeleteCall[],
  deleteResults: [] as Array<{ data: Array<{ id: string }>; error: { message: string } | null }>,
}));

function translate(key: string, options?: Record<string, unknown>) {
  const resource = state.language === "sw" ? sw : en;
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, resource);

  const text = typeof value === "string" ? value : String(options?.defaultValue ?? key);
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ""));
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate, i18n: { language: state.language } }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ churchId: "church-a" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (payload: Record<string, unknown>) => state.toasts.push(payload),
  }),
}));

const invalidateQueries = vi.fn();

const families = [
  { id: "family-a", name: "Familia ya Nyerere", church_id: "church-a" },
  { id: "family-empty", name: "Familia Tupu", church_id: "church-a" },
];

const familyMembers = [
  { id: "member-a", full_name: "Amina Nyerere", family_id: "family-a", family_role: "mother", church_id: "church-a" },
];

const allMembers = [
  { id: "member-a", full_name: "Amina Nyerere" },
  { id: "member-b", full_name: "John Mwangi" },
];

const contributions = [
  { member_id: "member-a", amount: 12500 },
];

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey[0];
    if (key === "families") return { data: families, isLoading: false };
    if (key === "family-members-all") return { data: familyMembers, isLoading: false };
    if (key === "members-for-families") return { data: allMembers, isLoading: false };
    if (key === "contributions-for-families") return { data: contributions, isLoading: false };
    return { data: [], isLoading: false, isFetching: false };
  },
  useMutation: (config: {
    mutationFn: (value?: unknown) => Promise<unknown>;
    onSuccess?: (data: unknown) => void;
    onError?: (error: Error) => void;
  }) => ({
    isPending: false,
    mutate: (value?: unknown) => {
      Promise.resolve()
        .then(() => config.mutationFn(value))
        .then((data) => config.onSuccess?.(data))
        .catch((error) => config.onError?.(error));
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      insert: vi.fn(async (payload: unknown) => {
        state.inserts.push({ table, payload });
        return { error: null };
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        const call: UpdateCall = { table, payload, filters: [] };
        state.updates.push(call);
        const chain: Record<string, any> = {};
        chain.eq = vi.fn((column: string, value: unknown) => {
          call.filters.push({ method: "eq", column, value });
          return chain;
        });
        chain.is = vi.fn((column: string, value: unknown) => {
          call.filters.push({ method: "is", column, value });
          return chain;
        });
        chain.select = vi.fn(async () => (
          state.updateResults.shift() ?? { data: [{ id: String(call.filters[0]?.value ?? "updated") }], error: null }
        ));
        return chain;
      }),
      delete: vi.fn(() => {
        const call: DeleteCall = { table, filters: [] };
        state.deletes.push(call);
        const chain: Record<string, any> = {};
        chain.eq = vi.fn((column: string, value: unknown) => {
          call.filters.push({ method: "eq", column, value });
          return chain;
        });
        chain.select = vi.fn(async () => (
          state.deleteResults.shift() ?? { data: [{ id: String(call.filters[0]?.value ?? "deleted") }], error: null }
        ));
        return chain;
      }),
    })),
  },
}));

vi.mock("@/components/ui/dialog", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
    open: false,
    onOpenChange: () => {},
  });

  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
    ),
    DialogTrigger: ({ children }: { children: ReactElement }) => {
      const context = React.useContext(DialogContext);
      return React.cloneElement(children, { onClick: () => context.onOpenChange(true) } as Record<string, unknown>);
    },
    DialogContent: ({ children }: { children: ReactNode }) => {
      const context = React.useContext(DialogContext);
      return context.open ? <div role="dialog">{children}</div> : null;
    },
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children, className }: { children: ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  };
});

vi.mock("@/components/ui/alert-dialog", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const AlertContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
    open: false,
    onOpenChange: () => {},
  });

  return {
    AlertDialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => (
      <AlertContext.Provider value={{ open, onOpenChange }}>{children}</AlertContext.Provider>
    ),
    AlertDialogContent: ({ children }: { children: ReactNode }) => {
      const context = React.useContext(AlertContext);
      return context.open ? <div role="alertdialog">{children}</div> : null;
    },
    AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    AlertDialogCancel: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) => {
      const context = React.useContext(AlertContext);
      return <button disabled={disabled} onClick={() => context.onOpenChange(false)}>{children}</button>;
    },
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: ReactNode }) => (
    <select aria-label="mock-select" value={value ?? ""} onChange={(event) => onValueChange?.(event.currentTarget.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => placeholder ? <option value="">{placeholder}</option> : null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

type LocaleTree = Record<string, unknown>;

function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as LocaleTree, path)
      : [path];
  });
}

function duplicateKeysInFormattedJson(path: string) {
  const scopes = new Map<number, Set<string>>();
  const duplicates: string[] = [];
  readFileSync(path, "utf8").split(/\r?\n/).forEach((line, index) => {
    const match = /^(\s*)"([^"]+)"\s*:/.exec(line);
    if (!match) return;
    const indent = match[1].length;
    for (const scopeIndent of Array.from(scopes.keys())) {
      if (scopeIndent > indent) scopes.delete(scopeIndent);
    }
    if (!scopes.has(indent)) scopes.set(indent, new Set());
    const keys = scopes.get(indent)!;
    if (keys.has(match[2])) duplicates.push(`${path}:${index + 1}:${match[2]}`);
    keys.add(match[2]);
  });
  return duplicates;
}

let host: HTMLDivElement;
let root: Root | null;
let FamiliesPage: typeof import("@/pages/church-admin/FamiliesPage").default | null;

async function renderFamilies() {
  FamiliesPage ??= (await import("@/pages/church-admin/FamiliesPage")).default;
  root ??= createRoot(host);
  await act(async () => {
    root.render(<FamiliesPage />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function text() {
  return host.textContent ?? "";
}

async function clickByText(label: string) {
  const targets = Array.from(host.querySelectorAll<HTMLElement>("button, [role='button'], h1, h2, h3, h4, p, span, div"));
  const target = targets.find((element) => element.textContent?.trim() === label)
    ?? targets.find((element) => element.children.length === 0 && element.textContent?.includes(label))
    ?? targets.find((element) => element.textContent?.includes(label));
  if (!target) throw new Error(`Text not found: ${label}`);
  await act(async () => {
    target.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickByAriaLabel(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Button not found: ${label}`);
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function selectByIndex(index: number, value: string) {
  const select = host.querySelectorAll<HTMLSelectElement>("select")[index];
  if (!select) throw new Error(`Select ${index} not found`);
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  state.language = "sw";
  state.toasts = [];
  state.inserts = [];
  state.updates = [];
  state.updateResults = [];
  state.deletes = [];
  state.deleteResults = [];
  invalidateQueries.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = null;
  FamiliesPage = null;
});

afterEach(() => {
  if (root && host.childNodes.length > 0) {
    act(() => root!.unmount());
  }
  host.remove();
});

describe("Family Management staging backport", () => {
  it("keeps family locale namespaces in parity without duplicate keys", () => {
    expect(flattenKeys(sw.families_admin).sort()).toEqual(flattenKeys(en.families_admin).sort());
    expect(duplicateKeysInFormattedJson("src/locales/en.json")).toEqual([]);
    expect(duplicateKeysInFormattedJson("src/locales/sw.json")).toEqual([]);
  });

  it("assigns a member with church and unassigned-family filters while preserving stored role values", async () => {
    await renderFamilies();
    await clickByText("Familia ya Nyerere");
    await clickByText("Ongeza");
    await selectByIndex(0, "member-b");
    await selectByIndex(1, "father");
    await clickByText("Pangia");

    expect(state.updates[0]).toMatchObject({
      table: "members",
      payload: { family_id: "family-a", family_role: "father" },
    });
    expect(state.updates[0].filters).toEqual([
      { method: "eq", column: "id", value: "member-b" },
      { method: "eq", column: "church_id", value: "church-a" },
      { method: "is", column: "family_id", value: null },
    ]);
  });

  it("confirms member removal and keeps member records and contributions intact", async () => {
    await renderFamilies();
    await clickByText("Familia ya Nyerere");
    await clickByAriaLabel("Ondoa Amina Nyerere kwenye familia");

    expect(text()).toContain("Rekodi yake ya uanachama na michango yake vitabaki salama.");
    expect(text()).toContain("Michango Jumla");

    await clickByText("Ondoa mwanachama");

    expect(state.updates[0]).toMatchObject({
      table: "members",
      payload: { family_id: null, family_role: null },
    });
    expect(state.updates[0].filters).toEqual([
      { method: "eq", column: "id", value: "member-a" },
      { method: "eq", column: "church_id", value: "church-a" },
      { method: "eq", column: "family_id", value: "family-a" },
    ]);
  });

  it("deletes an empty family only after confirmation with church-scoped filters", async () => {
    await renderFamilies();
    await clickByAriaLabel("Futa familia Familia Tupu");

    expect(text()).toContain("Futa Familia Tupu?");

    await clickByText("Futa familia");

    expect(state.deletes[0]).toMatchObject({ table: "families" });
    expect(state.deletes[0].filters).toEqual([
      { method: "eq", column: "id", value: "family-empty" },
      { method: "eq", column: "church_id", value: "church-a" },
    ]);
    expect(state.toasts.some((toast) => toast.title === "Familia imefutwa")).toBe(true);
  });

  it("blocks nonempty family deletion from the UI", async () => {
    await renderFamilies();

    const deleteNonempty = host.querySelector<HTMLButtonElement>('button[aria-label="Futa familia Familia ya Nyerere"]');

    expect(deleteNonempty).not.toBeNull();
    expect(deleteNonempty?.disabled).toBe(true);
    expect(state.deletes).toEqual([]);
  });

  it("shows an error instead of success when a delete affects zero rows", async () => {
    state.deleteResults = [{ data: [], error: null }];

    await renderFamilies();
    await clickByAriaLabel("Futa familia Familia Tupu");
    await clickByText("Futa familia");

    expect(state.toasts.some((toast) => toast.title === "Hitilafu")).toBe(true);
    expect(state.toasts.some((toast) => toast.title === "Familia imefutwa")).toBe(false);
  });

  it("shows Supabase update errors without reporting removal success", async () => {
    state.updateResults = [{ data: [], error: { message: "Simulated update failure" } }];

    await renderFamilies();
    await clickByText("Familia ya Nyerere");
    await clickByAriaLabel("Ondoa Amina Nyerere kwenye familia");
    await clickByText("Ondoa mwanachama");

    expect(state.toasts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Hitilafu",
          description: "Simulated update failure",
          variant: "destructive",
        }),
      ]),
    );
    expect(state.toasts.some((toast) => toast.title === "Mwanachama ameondolewa kwenye familia")).toBe(false);
  });

  it("keeps Wave23D out of the staging backport source diff", () => {
    expect(() => readFileSync("supabase/migrations/20260922120000_fix_event_request_staff_rls.sql", "utf8")).toThrow();
  });
});
