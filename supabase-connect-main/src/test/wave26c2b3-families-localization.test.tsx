import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  language: "sw" as "sw" | "en",
  toasts: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<{ table: string; payload: unknown }>,
  updates: [] as Array<{ table: string; payload: Record<string, unknown>; eq?: { column: string; value: unknown } }>,
  remoteSelection: null as { id: string; full_name: string; phone?: string | null } | null,
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
const remoteMembers = [
  { id: "member-b", full_name: "John Mwangi", phone: "+255700000002", community_id: null },
];

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey[0];
    if (key === "families") return { data: families, isLoading: false };
    if (key === "family-members-all") return { data: familyMembers, isLoading: false };
    if (key === "members-for-families") return { data: allMembers, isLoading: false };
    if (key === "contributions-for-families") return { data: contributions, isLoading: false };
    if (key === "remote-member-select") {
      const search = String(queryKey[3] ?? "");
      return { data: search.length >= 2 ? remoteMembers : [], isFetching: false };
    }
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
      select: vi.fn(() => ({
        order: vi.fn(async () => ({ data: [], error: null })),
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
          not: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(async (payload: unknown) => {
        state.inserts.push({ table, payload });
        return { error: null };
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        const call = { table, payload };
        state.updates.push(call);
        return {
          eq: vi.fn(async (column: string, value: unknown) => {
            Object.assign(call, { eq: { column, value } });
            return { error: null };
          }),
        };
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
let RemoteMemberSelect: typeof import("@/components/members/RemoteMemberSelect").RemoteMemberSelect | null;

async function renderFamilies() {
  FamiliesPage ??= (await import("@/pages/church-admin/FamiliesPage")).default;
  root ??= createRoot(host);
  await act(async () => {
    root.render(<FamiliesPage />);
    await Promise.resolve();
  });
}

function RemoteMemberHarness() {
  const Component = RemoteMemberSelect!;
  return (
    <Component
      churchId="church-a"
      value={state.remoteSelection?.id ?? ""}
      selectedMember={state.remoteSelection}
      onValueChange={(member) => {
        state.remoteSelection = member;
      }}
    />
  );
}

async function renderRemoteMemberSelect() {
  RemoteMemberSelect ??= (await import("@/components/members/RemoteMemberSelect")).RemoteMemberSelect;
  root ??= createRoot(host);
  await act(async () => {
    root.render(<RemoteMemberHarness />);
    await Promise.resolve();
  });
}

function text() {
  return host.textContent ?? "";
}

function setInputValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function clickByText(label: string) {
  const buttons = Array.from(host.querySelectorAll<HTMLElement>("button, [role='button']"));
  const target = buttons.find((element) => element.textContent?.trim() === label)
    ?? buttons.find((element) => element.textContent?.includes(label))
    ?? Array.from(host.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span, div"))
      .find((element) => element.textContent?.trim() === label)
    ?? Array.from(host.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span, div"))
      .find((element) => element.children.length === 0 && element.textContent?.includes(label))
    ?? Array.from(host.querySelectorAll<HTMLElement>("h1, h2, h3, h4, p, span, div"))
      .find((element) => element.textContent?.includes(label));
  if (!target) throw new Error(`Text not found: ${label}`);
  await act(async () => {
    target.click();
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

async function submitFirstForm() {
  const form = host.querySelector("form");
  if (!form) throw new Error("Form not found");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  state.language = "sw";
  state.toasts = [];
  state.inserts = [];
  state.updates = [];
  state.remoteSelection = null;
  invalidateQueries.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = null;
  FamiliesPage = null;
  RemoteMemberSelect = null;
});

afterEach(() => {
  if (root && host.childNodes.length > 0) {
    act(() => root!.unmount());
  }
  host.remove();
});

describe("Wave 26C-2B-3 families localization", () => {
  it("keeps new locale namespaces in parity without duplicate keys", () => {
    expect(flattenKeys(sw.families_admin).sort()).toEqual(flattenKeys(en.families_admin).sort());
    expect(flattenKeys(sw.remote_member_select).sort()).toEqual(flattenKeys(en.remote_member_select).sort());
    expect(duplicateKeysInFormattedJson("src/locales/en.json")).toEqual([]);
    expect(duplicateKeysInFormattedJson("src/locales/sw.json")).toEqual([]);
  });

  it("localizes RemoteMemberSelect helper text while preserving selected member data", async () => {
    await renderRemoteMemberSelect();

    expect(host.querySelector<HTMLInputElement>('input[aria-label="Tafuta mwanachama kwa jina au simu"]')?.placeholder)
      .toBe("Tafuta mwanachama kwa jina au simu");
    expect(text()).toContain("Andika angalau herufi 2.");

    setInputValue(host.querySelector("input")!, "Jo");
    await renderRemoteMemberSelect();
    expect(text()).toContain("John Mwangi");
    expect(text()).toContain("+255700000002");

    await clickByText("John Mwangi");
    await renderRemoteMemberSelect();
    expect(host.querySelector("input")?.getAttribute("value") ?? host.querySelector<HTMLInputElement>("input")?.value).toBe("John Mwangi");
    expect(text()).toContain("+255700000002");

    state.language = "en";
    await renderRemoteMemberSelect();
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Search member by name or phone"]')?.value).toBe("John Mwangi");
    expect(text()).toContain("+255700000002");
  });

  it("renders FamiliesPage in Kiswahili with translated role labels and unchanged user-entered names", async () => {
    await renderFamilies();

    expect(text()).toContain("Familia");
    expect(text()).toContain("Simamia familia za kanisa na wanachama wake");
    expect(text()).toContain("Ongeza Familia");
    expect(text()).toContain("Familia ya Nyerere");
    expect(text()).toContain("Wanachama 1");

    await clickByText("Familia ya Nyerere");
    expect(text()).toContain("Michango Jumla");
    expect(text()).toContain("Wanafamilia");
    expect(text()).toContain("Amina Nyerere");
    expect(text()).toContain("Mama");
    expect(text()).not.toContain("mother");
    expect(host.querySelector('button[aria-label="Ondoa Amina Nyerere kwenye familia"]')).not.toBeNull();
  });

  it("preserves unsaved family and assignment state across mounted SW to EN to SW switching", async () => {
    await renderFamilies();
    await clickByText("Ongeza Familia");
    const familyName = host.querySelector<HTMLInputElement>('input[aria-label="Jina la Familia"]')!;
    setInputValue(familyName, "Familia ya Test");

    await clickByText("Familia ya Nyerere");
    await clickByText("Ongeza");
    await selectByIndex(0, "member-b");
    await selectByIndex(1, "father");

    state.language = "en";
    await renderFamilies();
    expect(text()).toContain("New Family");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Family Name"]')?.value).toBe("Familia ya Test");
    expect(text()).toContain("Family Members");
    expect(host.querySelectorAll<HTMLSelectElement>("select")[0].value).toBe("member-b");
    expect(host.querySelectorAll<HTMLSelectElement>("select")[1].value).toBe("father");
    expect(text()).toContain("Father");

    state.language = "sw";
    await renderFamilies();
    expect(text()).toContain("Familia Mpya");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Jina la Familia"]')?.value).toBe("Familia ya Test");
    expect(host.querySelectorAll<HTMLSelectElement>("select")[0].value).toBe("member-b");
    expect(host.querySelectorAll<HTMLSelectElement>("select")[1].value).toBe("father");
    expect(text()).toContain("Baba");
  });

  it("keeps create, add-member and remove-member payloads unchanged while localizing toasts", async () => {
    await renderFamilies();
    await clickByText("Ongeza Familia");
    setInputValue(host.querySelector<HTMLInputElement>('input[aria-label="Jina la Familia"]')!, "Familia Mpya");
    await submitFirstForm();
    expect(state.inserts).toEqual([{ table: "families", payload: { name: "Familia Mpya" } }]);
    expect(state.toasts.some((toast) => toast.title === "Familia imeongezwa")).toBe(true);

    await renderFamilies();
    await clickByText("Familia ya Nyerere");
    await clickByText("Ongeza");
    await selectByIndex(0, "member-b");
    await selectByIndex(1, "father");
    await clickByText("Pangia");
    expect(state.updates[0]).toMatchObject({
      table: "members",
      payload: { family_id: "family-a", family_role: "father" },
      eq: { column: "id", value: "member-b" },
    });

    await clickByText("Familia ya Nyerere");
    const remove = host.querySelector<HTMLButtonElement>('button[aria-label="Ondoa Amina Nyerere kwenye familia"]')!;
    await act(async () => {
      remove.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(state.updates[1]).toMatchObject({
      table: "members",
      payload: { family_id: null, family_role: null },
      eq: { column: "id", value: "member-a" },
    });
  });

  it("documents that localization preserves existing query and mutation scoping for separate security follow-up", () => {
    const source = readFileSync("src/pages/church-admin/FamiliesPage.tsx", "utf8");
    expect(source).toContain('supabase.from("families").select("*").order("name")');
    expect(source).toContain('supabase.from("families").insert({');
    expect(source).toContain("name: name.trim()");
    expect(source).toContain('.from("members")');
    expect(source).toContain('family_role: selectedRole');
    expect(source).toContain('family_role: null');
    expect(source).toContain('.eq("church_id", churchId)');
  });
});
