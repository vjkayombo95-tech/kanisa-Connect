import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const matches = (source: string, pattern: RegExp) => pattern.test(source);

describe("PortalMassIntentions member behavior contract", () => {
  const memberRoutes = read("src/routes/MemberRoutes.tsx");
  const portalMassIntentions = read("src/pages/portal/PortalMassIntentions.tsx");
  const memberLinkedRequests = read("src/lib/member-linked-requests.ts");
  const offlineSync = read("src/lib/offline-sync.ts");

  it("keeps the member route wired to the PortalMassIntentions page", () => {
    expect(memberRoutes).toContain('const PortalMassIntentions = lazy(() => import("@/pages/portal/PortalMassIntentions"))');
    expect(memberRoutes).toContain('<Route path="mass-intentions" element={<PortalMassIntentions />} />');
    expect(portalMassIntentions).toContain("export default function PortalMassIntentions()");
  });

  it("requires authenticated church and member context scoped by user and church", () => {
    expect(portalMassIntentions).toContain("const { churchId } = useAuth()");
    expect(portalMassIntentions).toContain("const { user, churchId } = useAuth()");
    expect(portalMassIntentions).toContain('queryKey: ["my-member-record", user?.id, churchId]');
    expect(portalMassIntentions).toContain('.from("members")');
    expect(portalMassIntentions).toContain('.select("id, full_name")');
    expect(portalMassIntentions).toContain('.eq("user_id", user.id)');
    expect(portalMassIntentions).toContain('.eq("church_id", churchId)');
    expect(portalMassIntentions).toContain("if (!churchId) throw new Error");
    expect(portalMassIntentions).toContain("if (!member?.id) throw new Error");
  });

  it("keeps required input validation for message, Mass occurrence, offering and online state", () => {
    expect(portalMassIntentions).toContain("const netAmount = parseFloat(offeringAmount) || DEFAULT_OFFERING");
    expect(portalMassIntentions).toContain("if (!message.trim()) throw new Error");
    expect(portalMassIntentions).toContain('if (!massOccurrenceId) throw new Error("Please select an available Mass.")');
    expect(portalMassIntentions).toContain("if (netAmount < 1000) throw new Error");
    expect(portalMassIntentions).toContain('if (!isOnline) throw new Error("Unganisha intaneti ili kuthibitisha nafasi ya Misa.")');
    expect(portalMassIntentions).toContain("assertClientRateLimit(`mass-intention:${churchId}:${member.id}`, 5, 60 * 60 * 1000");
    expect(portalMassIntentions).toContain("disabled={submit.isPending || !message.trim() || !massOccurrenceId || !member?.id || !isOnline}");
  });

  it("keeps the active submission path on the Mass occurrence RPC helper", () => {
    expect(portalMassIntentions).toContain("submitPortalMassIntentionForOccurrence({");
    expect(memberLinkedRequests).toContain("export async function submitPortalMassIntentionForOccurrence");
    expect(memberLinkedRequests).toContain('supabase.rpc("submit_portal_mass_intention_for_occurrence"');
    expect(memberLinkedRequests).not.toContain('supabase.rpc("submit_portal_mass_intention" as never, {\n    p_church_id: payload.church_id,\n    p_member_id: payload.member_id,\n    p_mass_occurrence_id');
  });

  it("protects the active RPC payload field names", () => {
    for (const field of [
      "p_church_id",
      "p_member_id",
      "p_mass_occurrence_id",
      "p_intention_type",
      "p_message",
      "p_offering_amount",
      "p_idempotency_key",
    ]) {
      expect(memberLinkedRequests).toContain(field);
    }

    expect(memberLinkedRequests).toContain("p_church_id: payload.church_id");
    expect(memberLinkedRequests).toContain("p_member_id: payload.member_id");
    expect(memberLinkedRequests).toContain("p_mass_occurrence_id: payload.mass_occurrence_id");
    expect(memberLinkedRequests).toContain("p_intention_type: payload.intention_type");
    expect(memberLinkedRequests).toContain("p_message: payload.message.trim()");
    expect(memberLinkedRequests).toContain("p_offering_amount: payload.offering_amount");
    expect(memberLinkedRequests).toContain("p_idempotency_key: payload.idempotency_key");
  });

  it("keeps church and member attribution derived from authenticated context, not user-entered fields", () => {
    expect(portalMassIntentions).toContain("member_id: member.id");
    expect(portalMassIntentions).toContain("church_id: churchId");
    expect(portalMassIntentions).toContain("mass_occurrence_id: massOccurrenceId");
    expect(portalMassIntentions).not.toMatch(/setChurchId|setMemberId|name=["']church_id|name=["']member_id/i);
    expect(memberLinkedRequests).toContain("if (!payload.church_id || !payload.member_id || !payload.mass_occurrence_id)");
    expect(memberLinkedRequests).toContain("if (!payload.message.trim() || !payload.idempotency_key.trim())");
  });

  it("keeps idempotency generated and passed through the active submit path", () => {
    expect(portalMassIntentions).toContain("idempotency_key: crypto.randomUUID()");
    expect(memberLinkedRequests).toContain("idempotency_key: string");
    expect(memberLinkedRequests).toContain("p_idempotency_key: payload.idempotency_key");
    expect(offlineSync).toContain("idempotency_key: action.id");
  });

  it("keeps successful submission cleanup, reset, toast, and invalidations", () => {
    expect(portalMassIntentions).toContain("clearOfflineDraft(massDraftKey)");
    expect(portalMassIntentions).toContain("setDialogOpen(false)");
    expect(portalMassIntentions).toContain('setIntentionType("shukrani")');
    expect(portalMassIntentions).toContain('setMessage("")');
    expect(portalMassIntentions).toContain("setOfferingAmount(String(DEFAULT_OFFERING))");
    expect(portalMassIntentions).toContain('setMassDate("")');
    expect(portalMassIntentions).toContain('setMassOccurrenceId("")');
    expect(portalMassIntentions).toContain("toast({");
    expect(portalMassIntentions).toContain("mass_intentions_form.submitted_title");

    for (const queryKey of [
      '["portal-mass-intentions"]',
      '["my-mass-intentions"]',
      '["my-mass-intentions-dashboard"]',
      '["my-contributions-all"]',
      '["contributions"]',
      '["simple-member-home"]',
    ]) {
      expect(portalMassIntentions).toContain(`queryClient.invalidateQueries({ queryKey: ${queryKey} })`);
    }
  });

  it("keeps errors logged and reported as destructive failures", () => {
    expect(portalMassIntentions).toContain("onError: (err: Error) =>");
    expect(portalMassIntentions).toContain("logSupabaseError(err");
    expect(portalMassIntentions).toContain('component: "PortalMassIntentions"');
    expect(portalMassIntentions).toContain('table: "mass_intentions"');
    expect(portalMassIntentions).toContain('toast({ title: "Error", description: err.message, variant: "destructive" })');
    expect(memberLinkedRequests).toContain("if (error) throw error");
  });

  it("does not introduce frontend payment gateway, checkout, provider or tokenization flow", () => {
    const frontendSources = `${portalMassIntentions}\n${memberLinkedRequests}`;
    expect(frontendSources).not.toMatch(/stripe|paypal|checkout|payment_intent|paymentIntent|gateway|tokenization|provider_reference|payment_reference/i);
    expect(portalMassIntentions).toContain("submitPortalMassIntentionForOccurrence({");
    expect(memberLinkedRequests).toContain('supabase.rpc("submit_portal_mass_intention_for_occurrence"');
  });

  it("keeps member Mass intention reads on available Masses, mass_intentions, and members", () => {
    expect(portalMassIntentions).toContain('supabase.rpc("get_available_mass_occurrences"');
    expect(portalMassIntentions).toContain("{ p_church_id: churchId, p_date: null }");
    expect(portalMassIntentions).toContain('.from("mass_intentions")');
    expect(portalMassIntentions).toContain(".select(MASS_INTENTION_SELECT)");
    expect(portalMassIntentions).toContain('.eq("church_id", churchId)');
    expect(portalMassIntentions).toContain('.eq("member_id", member.id)');
    expect(memberLinkedRequests).toContain("export const MASS_INTENTION_SELECT");
    expect(memberLinkedRequests).toContain("members(full_name, email)");
  });

  it("keeps existing offline draft, cache and sync hooks statically present", () => {
    expect(portalMassIntentions).toContain("readOfflineDraft");
    expect(portalMassIntentions).toContain("writeOfflineDraft");
    expect(portalMassIntentions).toContain("clearOfflineDraft");
    expect(portalMassIntentions).toContain("readOfflineCache");
    expect(portalMassIntentions).toContain("withOfflineCache");
    expect(portalMassIntentions).toContain("useOfflineSyncQueue");
    expect(portalMassIntentions).toContain('isOfflineSyncActionType(item, "mass_intention_create")');
    expect(portalMassIntentions).toContain("processOfflineSyncQueue(queryClient)");
    expect(portalMassIntentions).toContain("removeOfflineSyncAction(item.id)");
    expect(offlineSync).toContain('type: "mass_intention_create"');
    expect(offlineSync).toContain("submitPortalMassIntention({");
  });
});
