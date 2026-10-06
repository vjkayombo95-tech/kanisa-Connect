import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changeAppLanguage } from "@/i18n";
import { formatAppDate } from "@/lib/localization";

type RpcCall = {
  name: string;
  payload: Record<string, unknown>;
};

const state = vi.hoisted(() => ({
  rpcCalls: [] as RpcCall[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (name: string, payload: Record<string, unknown>) => {
      state.rpcCalls.push({ name, payload });
      return { data: { success: true, id: "mass-intention-a", created: true }, error: null };
    }),
  },
}));

import { submitPortalMassIntentionForOccurrence } from "@/lib/member-linked-requests";

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), "utf8");
const page = read("src/pages/portal/PortalMassIntentions.tsx");
const offlineSync = read("src/lib/offline-sync.ts");
const en = JSON.parse(read("src/locales/en.json"));
const sw = JSON.parse(read("src/locales/sw.json"));

const canonicalIntentions = [
  "shukrani",
  "marehemu",
  "maombi_maalum",
  "wagonjwa",
  "safari",
  "mtakatifu_wa_familia",
  "other",
];

describe("member Mass Intentions localization D1", () => {
  beforeEach(() => {
    state.rpcCalls = [];
  });

  it("uses localized EN/SW copy while preserving canonical intention and status values", () => {
    expect(en.mass_intentions_form.page_title).toBe("Mass Intentions");
    expect(sw.mass_intentions_form.page_title).toBe("Nia za Misa");
    expect(en.mass_intentions_form.mass_select_placeholder).toBe("Select an available Mass");
    expect(sw.mass_intentions_form.mass_select_placeholder).toBe("Chagua Misa inayopatikana");
    expect(en.mass_intentions_labels.shukrani).toBe("Thanksgiving");
    expect(sw.mass_intentions_labels.shukrani).toBe("Shukrani");

    for (const value of canonicalIntentions) {
      expect(page).toContain(`value: "${value}"`);
      expect(page).toContain(`mass_intentions_labels.${value}`);
      expect(page).toContain(`mass_intentions_form.intention_descriptions.${value}`);
    }

    expect(page).toContain('if (status === "approved")');
    expect(page).toContain('if (status === "pending")');
    expect(page).toContain("translateStatus(t, intention.status)");
    expect(["pending", "approved", "rejected"]).toEqual(["pending", "approved", "rejected"]);
  });

  it("keeps dynamic Mass/member/intention content as data instead of translation keys", () => {
    expect(page).toContain("{member.full_name}");
    expect(page).toContain("{intention.member_name}");
    expect(page).toContain("{intention.message}");
    expect(page).toContain("{item.payload.message}");
    expect(page).toContain("item.name");
    expect(page).toContain("value={item.id}");
    expect(page).toContain("setMassOccurrenceId(event.target.value)");
    expect(page).toContain("mass_occurrence_id: massOccurrenceId");
  });

  it("submits identical RPC payloads in English and Kiswahili for the same canonical input", async () => {
    const payload = {
      church_id: "church-a",
      member_id: "member-a",
      mass_occurrence_id: "occurrence-a",
      intention_type: "shukrani",
      message: "Amina family intention",
      offering_amount: 5000,
      idempotency_key: "fixed-key",
    };

    await changeAppLanguage("en");
    await submitPortalMassIntentionForOccurrence(payload);
    await changeAppLanguage("sw");
    await submitPortalMassIntentionForOccurrence(payload);

    expect(state.rpcCalls).toHaveLength(2);
    expect(state.rpcCalls[0].name).toBe("submit_portal_mass_intention_for_occurrence");
    expect(state.rpcCalls[0].payload).toEqual(state.rpcCalls[1].payload);
    expect(state.rpcCalls[0].payload).toEqual({
      p_church_id: "church-a",
      p_member_id: "member-a",
      p_mass_occurrence_id: "occurrence-a",
      p_intention_type: "shukrani",
      p_message: "Amina family intention",
      p_offering_amount: 5000,
      p_idempotency_key: "fixed-key",
    });
  });

  it("preserves offline Mass intention schema and idempotency semantics", () => {
    expect(page).toContain('isOfflineSyncActionType(item, "mass_intention_create")');
    expect(page).toContain("item.payload.churchId === churchId");
    expect(page).toContain("item.payload.memberId === member?.id");
    expect(offlineSync).toContain('type: "mass_intention_create"');
    for (const field of ["churchId", "memberId", "memberName", "intentionType", "message", "offeringAmount", "requestedMassDate"]) {
      expect(offlineSync).toContain(field);
    }
    expect(offlineSync).toContain("idempotency_key: action.id");
    expect(offlineSync).toContain("intention_type: action.payload.intentionType");
  });

  it("formats visible dates by selected language without changing the Mass occurrence id", () => {
    const english = formatAppDate("2026-10-05", "en", { day: "numeric", month: "short", year: "numeric" });
    const kiswahili = formatAppDate("2026-10-05", "sw", { day: "numeric", month: "short", year: "numeric" });

    expect(english).not.toBe(kiswahili);
    expect(page).toContain("formatMassOptionDate(item.occurrence_date, i18n.language)");
    expect(page).toContain("value={item.id}");
    expect(page).toContain("mass_occurrence_id: massOccurrenceId");
  });

  it("keeps the route and tenant-scoped member lookup unchanged", () => {
    const memberRoutes = read("src/routes/MemberRoutes.tsx");
    expect(memberRoutes).toContain('<Route path="mass-intentions" element={<PortalMassIntentions />} />');
    expect(page).toContain('queryKey: ["my-member-record", user?.id, churchId]');
    expect(page).toContain('.eq("user_id", user.id)');
    expect(page).toContain('.eq("church_id", churchId)');
    expect(page).toContain('queryKey: ["available-mass-occurrences", churchId]');
    expect(page).toContain("{ p_church_id: churchId, p_date: null }");
  });
});
