import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("PortalPledges member behavior contract", () => {
  const memberRoutes = read("src/routes/MemberRoutes.tsx");
  const portalLayout = read("src/components/portal/PortalLayout.tsx");
  const memberServiceRegistry = read("src/lib/member-service-registry.ts");
  const portalFeatures = read("src/lib/portal-features.ts");
  const portalPledges = read("src/pages/portal/PortalPledges.tsx");
  const pledgeHelpers = read("src/lib/pledges.ts");
  const pledgePaymentDialog = read("src/components/pledges/PledgePaymentDialog.tsx");
  const productionBaseline = read("supabase/migrations/20260622000000_production_baseline.sql");

  it("keeps the member pledges route wired to PortalPledges and the pledges feature key", () => {
    expect(memberRoutes).toContain('const PortalPledges = lazy(() => import("@/pages/portal/PortalPledges"))');
    expect(memberRoutes).toContain('<Route path="pledges" element={<PortalPledges />} />');
    expect(portalPledges).toContain("export default function PortalPledges()");
    expect(portalFeatures).toContain('{ prefix: "/portal/pledges", featureKey: "pledges" }');
    expect(memberServiceRegistry).toContain('id: "pledges"');
    expect(memberServiceRegistry).toContain('path: "/portal/pledges"');
    expect(memberServiceRegistry).toContain('featureKey: "pledges"');
    expect(memberServiceRegistry).toContain("ordinaryMemberAllowed: true");
    expect(portalLayout).toContain("getPortalFeatureForPath(location.pathname)");
    expect(portalLayout).toContain("activeFeatureState?.visible");
  });

  it("keeps member lookup scoped by authenticated user and church", () => {
    expect(portalPledges).toContain("const { user, churchId } = useAuth()");
    expect(portalPledges).toContain('queryKey: ["my-member-record", user?.id, churchId]');
    expect(portalPledges).toContain('.from("members")');
    expect(portalPledges).toContain('.select("id, full_name, community_id")');
    expect(portalPledges).toContain('.eq("user_id", user.id)');
    expect(portalPledges).toContain('.eq("church_id", churchId)');
    expect(portalPledges).not.toMatch(/setMemberId|setChurchId|name=["']member_id|name=["']church_id/i);
  });

  it("keeps the current community resolution chain and frontend community requirement", () => {
    expect(portalPledges).toContain('queryKey: ["member-pledge-community", member?.id, member?.community_id, churchId]');
    expect(portalPledges).toContain("if (member.community_id)");
    expect(portalPledges).toContain('.from("communities")');
    expect(portalPledges).toContain('.eq("id", member.community_id)');
    expect(portalPledges).toContain('.from("member_communities")');
    expect(portalPledges).toContain('.eq("member_id", member.id)');
    expect(portalPledges).toContain("mwenyekiti_id.eq.${member.id}");
    expect(portalPledges).toContain("makamu_mwenyekiti_id.eq.${member.id}");
    expect(portalPledges).toContain("mweka_hazina_id.eq.${member.id}");
    expect(portalPledges).toContain("katibu_id.eq.${member.id}");
    expect(portalPledges).toContain("const cannotCreatePledge = !member?.id || !churchId || !memberCommunity?.id");
    expect(portalPledges).toContain("const canOpenCreateDialog = !cannotCreatePledge");
    expect(portalPledges).toContain("Unahitaji kuunganishwa na Jumuiya kabla ya kuweka ahadi ya mchango.");
  });

  it("protects create pledge RPC name and exact payload shape", () => {
    const createSubmitSection = portalPledges.slice(
      portalPledges.indexOf("await createPledge.mutateAsync({"),
      portalPledges.indexOf("queryClient.invalidateQueries({ queryKey: [\"member-pledges\", member.id] })"),
    );

    expect(portalPledges).toContain("await createPledge.mutateAsync({");
    expect(portalPledges).toContain("memberId: member.id");
    expect(portalPledges).toContain("churchId");
    expect(portalPledges).toContain("communityId: memberCommunity.id");
    expect(portalPledges).toContain("amountPledged: numericPledgeAmount");
    expect(createSubmitSection).not.toMatch(/targetAmount\s*:/);
    expect(pledgeHelpers).toContain('supabase.rpc("create_pledge"');
    expect(pledgeHelpers).toContain("_member_id: memberId");
    expect(pledgeHelpers).toContain("_church_id: churchId");
    expect(pledgeHelpers).toContain("_community_id: communityId ?? null");
    expect(pledgeHelpers).toContain("_amount_pledged: amountPledged");
    expect(pledgeHelpers).toContain("_target_amount: targetAmount ?? null");
  });

  it("keeps pledge amount validation and missing context submit guards", () => {
    expect(portalPledges).toContain('const [amountPledged, setAmountPledged] = useState("")');
    expect(portalPledges).toContain("const numericPledgeAmount = Number(amountPledged || 0)");
    expect(portalPledges).toContain("if (!member?.id || !churchId || !memberCommunity?.id || numericPledgeAmount <= 0) return");
    expect(portalPledges).toContain('type="number"');
    expect(portalPledges).toContain('min="1"');
    expect(portalPledges).toContain("required");
    expect(portalPledges).toContain("disabled={createPledge.isPending || numericPledgeAmount <= 0 || !memberCommunity?.id || !member?.id || !churchId}");
    expect(pledgeHelpers).toContain('if (!result?.success) throw new Error(result?.error || "Unable to create pledge")');
  });

  it("blocks create-pledge CTAs from opening the amount form when community is unavailable", () => {
    expect(portalPledges).toContain('<Button className="min-h-12 w-full sm:w-auto" disabled={!canOpenCreateDialog}>');
    expect(portalPledges).toContain('<Button className="mt-5 min-h-11" disabled={!canOpenCreateDialog} onClick={() => {');
    expect(portalPledges).toContain("if (canOpenCreateDialog) setCreateOpen(true);");
    expect(portalPledges).toContain("const cannotCreatePledge = !member?.id || !churchId || !memberCommunity?.id");
    expect(portalPledges).toContain("const canOpenCreateDialog = !cannotCreatePledge");
  });

  it("keeps pledge summary semantics and bounded progress", () => {
    expect(portalPledges).toContain("pledged: acc.pledged + pledge.amount_pledged");
    expect(portalPledges).toContain("paid: acc.paid + pledge.amount_paid");
    expect(portalPledges).toContain("balance: acc.balance + pledge.balance");
    expect(portalPledges).toContain("const overallProgress = totals.pledged ? Math.min(100, (totals.paid / totals.pledged) * 100) : 0");
    expect(portalPledges).toContain('label="Jumla ya Ahadi"');
    expect(portalPledges).toContain('label="Niliyolipa"');
    expect(portalPledges).toContain('label="Salio"');
    expect(productionBaseline).toContain("greatest(p.amount_pledged - p.amount_paid, 0) as balance");
    expect(pledgeHelpers).toContain("Math.max(0, Math.min(100");
  });

  it("keeps pledge creation separate from contributions and external payment gateways", () => {
    const createPledgeSection = pledgeHelpers.slice(
      pledgeHelpers.indexOf("export function useCreatePledge"),
      pledgeHelpers.indexOf("export function useMakePledgePayment"),
    );

    expect(createPledgeSection).toContain('supabase.rpc("create_pledge"');
    expect(createPledgeSection).not.toMatch(/record_contribution|record_portal_contribution|contributions|payment_reference|provider|checkout|stripe|paypal|gateway|tokenization/i);
    expect(portalPledges).not.toMatch(/record_contribution|record_portal_contribution|payment_intent|checkout|stripe|paypal|gateway|tokenization/i);
  });

  it("keeps pledge payment flow separate from Weka Ahadi and pending approval semantics", () => {
    expect(portalPledges).toContain("const [activePledge, setActivePledge] = useState<any | null>(null)");
    expect(portalPledges).toContain("const paymentMutation = useMakePledgePayment()");
    expect(portalPledges).toContain("<PledgePaymentDialog");
    expect(portalPledges).toContain("onClick={() => setActivePledge(pledge)}");
    expect(portalPledges).toContain("await paymentMutation.mutateAsync({");
    expect(portalPledges).toContain("pledgeId: activePledge.id");
    expect(pledgeHelpers).toContain('supabase.rpc("make_pledge_payment"');
    expect(pledgeHelpers).toContain("_pledge_id: pledgeId");
    expect(pledgeHelpers).toContain("_amount: amount");
    expect(pledgeHelpers).toContain("_payment_method: paymentMethod");
    expect(pledgeHelpers).toContain("_transaction_id: transactionId || null");
    expect(pledgeHelpers).toContain("_proof_url: proofUrl || null");
    expect(portalPledges).toContain('title: "Malipo yametumwa kwa uthibitisho"');
    expect(portalPledges).toContain("Salio la ahadi litasasishwa baada ya msimamizi wa kanisa au padre kuthibitisha malipo.");
    expect(pledgePaymentDialog).toContain("missingEvidence");
    expect(pledgePaymentDialog).toContain("Submit for Approval");
  });

  it("keeps create pledge success feedback, reset, dialog close, and invalidations", () => {
    expect(portalPledges).toContain('queryClient.invalidateQueries({ queryKey: ["member-pledges", member.id] })');
    expect(portalPledges).toContain('queryClient.invalidateQueries({ queryKey: ["church-pledges-summary", churchId] })');
    expect(portalPledges).toContain('queryClient.invalidateQueries({ queryKey: ["community-pledges", memberCommunity.id] })');
    expect(portalPledges).toContain('title: "Ahadi imewekwa"');
    expect(portalPledges).toContain("handleCreateDialogChange(false)");
    expect(portalPledges).toContain('setAmountPledged("")');
  });

  it("keeps pledge realtime optional and scoped to existing pledge query families", () => {
    expect(portalPledges).toContain("usePledgeRealtime(realtimeKeys as unknown as (readonly unknown[])[])");
    expect(pledgeHelpers).toContain('import.meta.env.VITE_ENABLE_PLEDGE_REALTIME !== "true"');
    expect(pledgeHelpers).toContain('.channel("pledges-realtime")');
    expect(pledgeHelpers).toContain('{ event: "*", schema: "public", table: "pledge_payments" }');
    expect(pledgeHelpers).toContain('{ event: "*", schema: "public", table: "pledges" }');
    expect(pledgeHelpers).toContain('{ event: "*", schema: "public", table: "community_targets" }');
  });

  it("does not add offline pledge drafts or queued offline pledge submission", () => {
    const pledgeSources = `${portalPledges}\n${pledgeHelpers}`;
    expect(pledgeSources).not.toMatch(/readOfflineDraft|writeOfflineDraft|clearOfflineDraft|enqueueOfflineSyncAction|offline-cache:.*pledge/i);
  });
});
