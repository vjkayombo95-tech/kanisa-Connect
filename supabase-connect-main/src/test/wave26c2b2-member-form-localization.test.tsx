import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as typeof ResizeObserver;
URL.createObjectURL ??= vi.fn(() => "blob:member-photo");
URL.revokeObjectURL ??= vi.fn();

const state = vi.hoisted(() => ({
  language: "sw" as "sw" | "en",
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; payload: Record<string, unknown>; eq?: { column: string; value: unknown } }>,
  deletes: [] as Array<{ table: string; column: string; value: unknown }>,
  inserts: [] as Array<{ table: string; payload: unknown }>,
  toasts: [] as Array<Record<string, unknown>>,
  invalidPhoto: false,
  uploaded: [] as Array<{ bucket: string; churchId: string; memberId: string }>,
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

const invalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (config: {
    mutationFn: () => Promise<unknown>;
    onSuccess?: (data: unknown) => void;
    onError?: (error: Error) => void;
    onSettled?: () => void;
  }) => ({
    isPending: false,
    mutate: () => {
      Promise.resolve()
        .then(config.mutationFn)
        .then((data) => config.onSuccess?.(data))
        .catch((error) => config.onError?.(error))
        .finally(() => config.onSettled?.());
    },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: (payload: Record<string, unknown>) => state.toasts.push(payload),
  }),
}));

vi.mock("@/lib/file-upload", () => ({
  validateFile: vi.fn(() => state.invalidPhoto
    ? { valid: false, error: "Invalid test file" }
    : { valid: true, error: null }),
  optimizeImage: vi.fn(async (file: File) => ({ blob: file })),
  uploadFile: vi.fn(async (_blob: Blob, bucket: string, churchId: string, memberId: string) => {
    state.uploaded.push({ bucket, churchId, memberId });
    return { publicUrl: `https://cdn.example.test/${memberId}.webp` };
  }),
}));

function selectChain() {
  const chain = {
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: { church_id: "church-a" }, error: null })),
  };
  return chain;
}

function updateChain(table: string, payload: Record<string, unknown>) {
  const call = { table, payload };
  state.updates.push(call);
  return {
    eq: vi.fn(async (column: string, value: unknown) => {
      Object.assign(call, { eq: { column, value } });
      return { error: null };
    }),
  };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "admin-user" } }, error: null })),
    },
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      return { data: { member_id: "created-member" }, error: null };
    }),
    from: vi.fn((table: string) => ({
      select: vi.fn(() => selectChain()),
      update: vi.fn((payload: Record<string, unknown>) => updateChain(table, payload)),
      delete: vi.fn(() => ({
        eq: vi.fn(async (column: string, value: unknown) => {
          state.deletes.push({ table, column, value });
          return { error: null };
        }),
      })),
      insert: vi.fn(async (payload: unknown) => {
        state.inserts.push({ table, payload });
        return { error: null };
      }),
    })),
  },
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

let host: HTMLDivElement;
let root: Root | null;
let MemberForm: typeof import("@/components/MemberForm").MemberForm | null;
type MemberFormComponent = typeof import("@/components/MemberForm").MemberForm;

const baseProps = {
  isEdit: false,
  churchId: "church-a",
  communities: [{ id: "community-a", name: "Mtakatifu Yosefu" }],
  ministries: [{ id: "ministry-a", name: "Kwaya Kuu" }],
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

async function renderForm(props: Partial<ComponentProps<MemberFormComponent>> = {}) {
  MemberForm ??= (await import("@/components/MemberForm")).MemberForm;
  root ??= createRoot(host);
  await act(async () => {
    root.render(<MemberForm {...baseProps} {...props} />);
    await Promise.resolve();
  });
}

function text() {
  return host.textContent ?? "";
}

function input(label: string) {
  return host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
}

function setInputValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function clickCheckboxFor(labelText: string) {
  const row = Array.from(host.querySelectorAll("label"))
    .find((element) => element.textContent?.includes(labelText));
  const checkbox = row?.querySelector<HTMLButtonElement>('[role="checkbox"]');
  if (!checkbox) throw new Error(`Checkbox not found for ${labelText}`);

  await act(async () => {
    checkbox.click();
    await Promise.resolve();
  });
}

function checkedFor(labelText: string) {
  const row = Array.from(host.querySelectorAll("label"))
    .find((element) => element.textContent?.includes(labelText));
  return row?.querySelector('[role="checkbox"]')?.getAttribute("aria-checked");
}

async function selectPhoto() {
  const fileInput = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["photo"], "amina.webp", { type: "image/webp" });
  Object.defineProperty(fileInput, "files", {
    configurable: true,
    value: [file],
  });

  await act(async () => {
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function submit() {
  const form = host.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  state.language = "sw";
  state.rpcCalls = [];
  state.updates = [];
  state.deletes = [];
  state.inserts = [];
  state.toasts = [];
  state.invalidPhoto = false;
  state.uploaded = [];
  invalidateQueries.mockClear();
  baseProps.onSuccess.mockClear();
  baseProps.onCancel.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = null;
  MemberForm = null;
});

afterEach(() => {
  if (root && host.childNodes.length > 0) {
    act(() => root.unmount());
  }
  host.remove();
});

describe("Wave 26C-2B-2 MemberForm localization", () => {
  it("keeps MemberForm locale keys in parity and enum display labels separate from stored values", () => {
    expect(flattenKeys(sw.member_form).sort()).toEqual(flattenKeys(en.member_form).sort());
    expect(sw.members_admin.gender.male).toBe("Mwanaume");
    expect(en.members_admin.gender.male).toBe("Male");
    expect(sw.members_admin.family_roles.child).toBe("Mtoto");
    expect(en.members_admin.family_roles.child).toBe("Child");
  });

  it("renders the create form in Kiswahili without translating community or ministry names", async () => {
    await renderForm();

    expect(text()).toContain("Pakia Picha");
    expect(text()).toContain("Jina Kamili");
    expect(text()).toContain("Je, umeoa au umeolewa?");
    expect(text()).toContain("Jumuiya");
    expect(text()).toContain("Huduma");
    expect(text()).toContain("Ongeza Mwanachama");
    expect(text()).toContain("Mtakatifu Yosefu");
    expect(text()).toContain("Kwaya Kuu");
    expect(input("Jina Kamili").placeholder).toBe("John Doe");
    expect(input("Barua pepe").placeholder).toBe("john@example.com");
  });

  it("updates labels during mounted language switching without resetting entered values, selections, or photo preview", async () => {
    const seededMember = { full_name: "Amina Nyerere", email: "amina@example.test" };
    await renderForm({
      member: seededMember,
      selectedCommunityIds: [],
      selectedMinistryIds: [],
    });

    expect(text()).toContain("Pakia Picha");
    expect(input("Jina Kamili").value).toBe("Amina Nyerere");

    setInputValue(input("Jina Kamili"), "Amina Updated");
    await clickCheckboxFor("Mtakatifu Yosefu");
    await clickCheckboxFor("Kwaya Kuu");
    await selectPhoto();
    expect(checkedFor("Mtakatifu Yosefu")).toBe("true");
    expect(checkedFor("Kwaya Kuu")).toBe("true");
    expect(host.querySelector<HTMLImageElement>('img[src="blob:member-photo"]')).not.toBeNull();

    state.language = "en";
    await renderForm({
      member: seededMember,
      selectedCommunityIds: [],
      selectedMinistryIds: [],
    });

    expect(text()).toContain("Upload Photo");
    expect(text()).toContain("Are you married?");
    expect(input("Full Name").value).toBe("Amina Updated");
    expect(input("Email").value).toBe("amina@example.test");
    expect(checkedFor("Mtakatifu Yosefu")).toBe("true");
    expect(checkedFor("Kwaya Kuu")).toBe("true");
    expect(host.querySelector<HTMLImageElement>('img[src="blob:member-photo"]')).not.toBeNull();

    state.language = "sw";
    await renderForm({
      member: seededMember,
      selectedCommunityIds: [],
      selectedMinistryIds: [],
    });

    expect(text()).toContain("Pakia Picha");
    expect(input("Jina Kamili").value).toBe("Amina Updated");
    expect(checkedFor("Mtakatifu Yosefu")).toBe("true");
    expect(checkedFor("Kwaya Kuu")).toBe("true");
    expect(host.querySelector<HTMLImageElement>('img[src="blob:member-photo"]')).not.toBeNull();
  });

  it("preserves dirty selections through equivalent prop arrays but initializes a different member record", async () => {
    const memberA = { id: "member-a", full_name: "Amina Nyerere" };
    const memberB = { id: "member-b", full_name: "John Mwangi" };

    await renderForm({
      isEdit: true,
      member: memberA,
      selectedCommunityIds: ["community-a"],
      selectedMinistryIds: [],
    });
    expect(checkedFor("Mtakatifu Yosefu")).toBe("true");

    await clickCheckboxFor("Mtakatifu Yosefu");
    await clickCheckboxFor("Kwaya Kuu");
    expect(checkedFor("Mtakatifu Yosefu")).toBe("false");
    expect(checkedFor("Kwaya Kuu")).toBe("true");

    await renderForm({
      isEdit: true,
      member: memberA,
      selectedCommunityIds: ["community-a"],
      selectedMinistryIds: [],
    });
    expect(checkedFor("Mtakatifu Yosefu")).toBe("false");
    expect(checkedFor("Kwaya Kuu")).toBe("true");

    await renderForm({
      isEdit: true,
      member: memberB,
      selectedCommunityIds: [],
      selectedMinistryIds: ["ministry-a"],
    });
    expect(checkedFor("Mtakatifu Yosefu")).toBe("false");
    expect(checkedFor("Kwaya Kuu")).toBe("true");
  });

  it("submits create_member_with_relations with unchanged stored values and relation ids", async () => {
    await renderForm({
      member: { full_name: "Amina Nyerere", phone: "+255700000001" },
      selectedCommunityIds: ["community-a"],
      selectedMinistryIds: ["ministry-a"],
    });

    await submit();

    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].fn).toBe("create_member_with_relations");
    expect(state.rpcCalls[0].args).toMatchObject({
      p_church_id: "church-a",
      p_full_name: "Amina Nyerere",
      p_phone: "+255700000001",
      p_gender: null,
      p_is_married: false,
      p_primary_family_role: "guardian",
      p_spouse_family_role: "guardian",
      p_family_members: [],
      p_community_ids: ["community-a"],
      p_ministry_ids: ["ministry-a"],
    });
    expect(state.toasts.some((toast) => toast.title === "Mwanachama ameongezwa kikamilifu")).toBe(true);
  });

  it("renders edit form labels in English and preserves update payload and relation writes", async () => {
    state.language = "en";
    await renderForm({
      isEdit: true,
      member: {
        id: "member-a",
        full_name: "John Mwangi",
        email: "john@example.test",
        phone: "+255700000002",
        gender: "male",
        date_of_birth: "1990-01-01",
      },
      selectedCommunityIds: ["community-a"],
      selectedMinistryIds: ["ministry-a"],
    });

    expect(text()).toContain("Save Changes");
    expect(input("Full Name").value).toBe("John Mwangi");

    await submit();

    expect(state.updates[0]).toMatchObject({
      table: "members",
      payload: {
        full_name: "John Mwangi",
        email: "john@example.test",
        phone: "+255700000002",
        gender: "male",
        date_of_birth: "1990-01-01",
      },
      eq: { column: "id", value: "member-a" },
    });
    expect(state.deletes).toEqual([
      { table: "member_communities", column: "member_id", value: "member-a" },
      { table: "member_ministries", column: "member_id", value: "member-a" },
    ]);
    expect(state.inserts).toEqual([
      { table: "member_communities", payload: [{ community_id: "community-a", member_id: "member-a" }] },
      { table: "member_ministries", payload: [{ ministry_id: "ministry-a", member_id: "member-a" }] },
    ]);
    expect(state.toasts.some((toast) => toast.title === "Member updated successfully")).toBe(true);
  });

  it("localizes validation and photo controls while preserving upload code paths", async () => {
    await renderForm();

    expect(text()).toContain("Pakia Picha");
    expect(text()).toContain("Upeo 500KB - JPG, PNG, WebP - Inaboreshwa kiotomatiki");

    const source = readFileSync("src/components/MemberForm.tsx", "utf8");
    expect(source).toContain('label("toasts.invalid_photo", "Invalid photo")');
    expect(source).toContain('label("errors.full_name_required", "Full name is required.")');
    expect(source).toContain('validateFile(file, "member-photo")');
    expect(source).toContain('optimizeImage(photoFile, "member-photo")');
    expect(source).toContain('uploadFile(blob, "member-photo", trustedChurchId, memberId)');
    expect(source).toContain("update({ photo_url: photoUrl })");
  });

  it("keeps layout scope and protected table operations unchanged", () => {
    const source = readFileSync("src/components/MemberForm.tsx", "utf8");
    expect(source).toContain('supabase.rpc("create_member_with_relations" as never');
    expect(source).toContain('p_gender: normalizeOptional(gender)');
    expect(source).toContain('p_is_married: isMarried === "yes"');
    expect(source).toContain('.from("member_communities").delete().eq("member_id", member.id)');
    expect(source).toContain('.from("member_ministries").delete().eq("member_id", member.id)');
    expect(source).not.toContain("FamiliesPage");
    expect(source).not.toContain("RemoteMemberSelect");
  });
});
