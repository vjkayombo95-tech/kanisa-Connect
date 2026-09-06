import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const normalizeSql = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("PortalPrayerRequests member behavior contract", () => {
  const memberRoutes = read("src/routes/MemberRoutes.tsx");
  const portalLayout = read("src/components/portal/PortalLayout.tsx");
  const memberServiceRegistry = read("src/lib/member-service-registry.ts");
  const portalFeatures = read("src/lib/portal-features.ts");
  const portalPrayerRequests = read("src/pages/portal/PortalPrayerRequests.tsx");
  const prayerHelpers = read("src/lib/prayer-requests.ts");
  const offlineSync = read("src/lib/offline-sync.ts");
  const commentThread = read("src/components/portal/CommentThread.tsx");
  const submissionRpc = read("supabase/migrations/20260624134000_create_transactional_portal_submission_rpcs.sql");
  const productionBaseline = read("supabase/migrations/20260622000000_production_baseline.sql");
  const commentPolicies = read("supabase/migrations/20260831110000_harden_prayer_request_comment_policies.sql");
  const reactionMigration = read("supabase/migrations/20260829163000_add_prayer_request_comment_reactions.sql");
  const reactionHardening = read("supabase/migrations/20260829170000_harden_prayer_request_comment_reaction_policies.sql");
  const relatedFeatureHelper = read("supabase/migrations/20260830183500_add_prayer_related_feature_permission_helper.sql");

  it("keeps the member prayer requests route wired to PortalPrayerRequests and the prayer_requests feature key", () => {
    expect(memberRoutes).toContain('const PortalPrayerRequests = lazy(() => import("@/pages/portal/PortalPrayerRequests"))');
    expect(memberRoutes).toContain('<Route path="prayer-requests" element={<PortalPrayerRequests />} />');
    expect(portalPrayerRequests).toContain("export default function PortalPrayerRequests()");
    expect(portalFeatures).toContain('{ prefix: "/portal/prayer-requests", featureKey: "prayer_requests" }');
    expect(memberServiceRegistry).toContain('id: "prayer-requests"');
    expect(memberServiceRegistry).toContain('path: "/portal/prayer-requests"');
    expect(memberServiceRegistry).toContain('featureKey: "prayer_requests"');
    expect(memberServiceRegistry).toContain("ordinaryMemberAllowed: true");
    expect(portalLayout).toContain("getPortalFeatureForPath(location.pathname)");
    expect(portalLayout).toContain("activeFeatureState?.visible");
    expect(portalLayout).toContain("isOrdinaryMemberPathAllowed(location.pathname)");
  });

  it("keeps member lookup scoped by authenticated user and church", () => {
    expect(portalPrayerRequests).toContain("function useMemberRecord()");
    expect(portalPrayerRequests).toContain("const { user, churchId } = useAuth()");
    expect(portalPrayerRequests).toContain('queryKey: ["my-member-record", user?.id, churchId]');
    expect(portalPrayerRequests).toContain('.from("members")');
    expect(portalPrayerRequests).toContain('.select("id, full_name")');
    expect(portalPrayerRequests).toContain('.eq("user_id", user.id)');
    expect(portalPrayerRequests).toContain('.eq("church_id", churchId)');
    expect(portalPrayerRequests).not.toMatch(/setMemberId|setChurchId|name=["']member_id|name=["']church_id/i);
  });

  it("protects portal prayer request RPC name and exact payload shape", () => {
    expect(prayerHelpers).toContain('supabase.rpc("submit_portal_prayer_request" as never');
    expect(prayerHelpers).toContain("p_church_id: church_id");
    expect(prayerHelpers).toContain("p_member_id: member_id");
    expect(prayerHelpers).toContain("p_request_text: request_text");
    expect(prayerHelpers).toContain("p_offering_amount: payload.offering_amount ?? null");
    expect(prayerHelpers).toContain('p_privacy: payload.privacy ?? "public_to_church"');
    expect(prayerHelpers).toContain("p_idempotency_key: idempotency_key");
    expect(portalPrayerRequests).toContain("await submitPortalPrayerRequest({");
    expect(portalPrayerRequests).toContain("request_text: requestText");
    expect(portalPrayerRequests).toContain("member_id: member.id");
    expect(portalPrayerRequests).toContain("church_id: churchId");
    expect(portalPrayerRequests).toContain("offering_amount: requestedOffering || null");
    expect(portalPrayerRequests).toContain("privacy,");
    expect(portalPrayerRequests).toContain("idempotency_key: crypto.randomUUID()");
  });

  it("keeps request validation, required context, and client rate limiting", () => {
    expect(prayerHelpers).toContain("const request_text = payload.request_text.trim()");
    expect(prayerHelpers).toContain('throw new Error("Prayer request text is required.")');
    expect(prayerHelpers).toContain('throw new Error("Member context is required.")');
    expect(prayerHelpers).toContain('throw new Error("Church context is required.")');
    expect(prayerHelpers).toContain('throw new Error("Submission key is required.")');
    expect(portalPrayerRequests).toContain('if (!churchId) throw new Error("No church context")');
    expect(portalPrayerRequests).toContain('if (!member?.id) throw new Error("No member profile found")');
    expect(portalPrayerRequests).toContain("assertClientRateLimit(`prayer-request:${churchId}:${member.id}`, 5, 60 * 60 * 1000, \"prayer request submissions\")");
    expect(portalPrayerRequests).toContain('throw new Error("Offering amount cannot be negative.")');
    expect(portalPrayerRequests).toContain('disabled={submit.isPending || !requestText.trim() || !member?.id}');
    expect(submissionRpc).toContain("if v_request_text = '' then");
    expect(submissionRpc).toContain("if v_net_amount < 0 then");
    expect(submissionRpc).toContain("if v_key is null then");
  });

  it("protects privacy values and anonymous presentation semantics without claiming database anonymity", () => {
    for (const value of ["public_to_church", "private_to_pastor_admin", "anonymous_public"]) {
      expect(prayerHelpers).toContain(value);
      expect(portalPrayerRequests).toContain(value);
      expect(submissionRpc).toContain(value);
    }

    expect(portalPrayerRequests).toContain('request.privacy === "anonymous_public" ? "Muumini" : request.member_name');
    expect(portalPrayerRequests).toContain('.in("privacy", ["public_to_church", "anonymous_public"])');
    expect(productionBaseline).toContain("member_id uuid");
    expect(submissionRpc).toContain("p_member_id");
    expect(submissionRpc).toContain("p_member_id,");
    expect(submissionRpc).toContain("p_member_id");
    expect(portalPrayerRequests).not.toMatch(/member_id:\s*null|member_id\s*=\s*null/i);
  });

  it("keeps moderation lifecycle and community visibility boundaries", () => {
    for (const status of ["pending", "approved", "rejected"]) {
      expect(prayerHelpers).toContain(status);
      expect(productionBaseline).toContain(status);
    }

    expect(submissionRpc).toContain("'pending'");
    expect(portalPrayerRequests).toContain('.eq("status", "approved")');
    expect(portalPrayerRequests).toContain('.in("privacy", ["public_to_church", "anonymous_public"])');
    expect(portalPrayerRequests).toContain('queryKey: ["my-prayer-requests", member?.id]');
    expect(portalPrayerRequests).toContain('.eq("member_id", member.id)');
    expect(productionBaseline).toContain('CREATE POLICY "Members read approved shared prayers or their own"');
    expect(productionBaseline).toContain('CREATE POLICY "Pastoral reviewers manage church prayers"');
  });

  it("keeps comments tied to prayer_request_comments and parent request visibility", () => {
    expect(portalPrayerRequests).toContain('.from("prayer_request_comments")');
    expect(portalPrayerRequests).toContain("prayer_request_id: request.id");
    expect(portalPrayerRequests).toContain("church_id: churchId");
    expect(portalPrayerRequests).toContain("member_id: member?.id ?? null");
    expect(portalPrayerRequests).toContain('author_name: member?.full_name || "Member"');
    expect(portalPrayerRequests).toContain("comment: commentText.trim()");
    expect(portalPrayerRequests).toContain('queryClient.invalidateQueries({ queryKey: ["prayer-request-comments", request.id] })');

    const normalizedPolicies = normalizeSql(commentPolicies);
    expect(normalizedPolicies).toContain("pr.id = prayer_request_comments.prayer_request_id");
    expect(normalizedPolicies).toContain("pr.church_id = prayer_request_comments.church_id");
    expect(normalizedPolicies).toContain("owner_member.user_id = auth.uid()");
    expect(normalizedPolicies).toContain("pr.status = 'approved'");
    expect(normalizedPolicies).toContain("pr.privacy IN ('public_to_church', 'anonymous_public')");
    expect(normalizedPolicies).toContain("public.can_review_pastoral_requests(pr.church_id)");
    expect(commentThread).not.toMatch(/Edit|Delete|onEdit|onDelete/i);
  });

  it("keeps Mark as Prayed backed by prayer_request_prayers insert and delete toggle semantics", () => {
    expect(portalPrayerRequests).toContain('.from("prayer_request_prayers")');
    expect(portalPrayerRequests).toContain('attemptedPrayerOperation.current = prayerStats.prayedByMe ? "delete" : "insert"');
    expect(portalPrayerRequests).toContain(".delete()");
    expect(portalPrayerRequests).toContain('.eq("prayer_request_id", request.id)');
    expect(portalPrayerRequests).toContain('.eq("member_id", member.id)');
    expect(portalPrayerRequests).toContain("prayer_request_id: request.id");
    expect(portalPrayerRequests).toContain("church_id: churchId");
    expect(portalPrayerRequests).toContain("member_id: member.id");
    expect(portalPrayerRequests).toContain('queryClient.invalidateQueries({ queryKey: ["prayer-request-prayers", churchId] })');
    expect(productionBaseline).toContain('CREATE POLICY "Church members can create own prayer marks"');
    expect(productionBaseline).toContain('CREATE POLICY "Church members can delete own prayer marks"');
  });

  it("keeps comment reactions in prayer_request_comment_reactions with comment_id and user_id ownership", () => {
    expect(portalPrayerRequests).toContain('.from("prayer_request_comment_reactions")');
    expect(portalPrayerRequests).toContain("comment_id: commentId");
    expect(portalPrayerRequests).toContain("user_id: user.id");
    expect(portalPrayerRequests).toContain("emoji");
    expect(portalPrayerRequests).toContain('onConflict: "comment_id,user_id"');
    expect(portalPrayerRequests).toContain('.eq("comment_id", commentId)');
    expect(portalPrayerRequests).toContain('.eq("user_id", user.id)');
    expect(reactionMigration).toContain("PRIMARY KEY (comment_id, user_id)");
    expect(reactionHardening).toContain("user_id = auth.uid()");
  });

  it("keeps offline request creation, draft persistence, and removable queued submissions", () => {
    expect(portalPrayerRequests).toContain("readOfflineDraft(prayerDraftKey");
    expect(portalPrayerRequests).toContain("writeOfflineDraft(prayerDraftKey, { requestText, offeringAmount, privacy })");
    expect(portalPrayerRequests).toContain("clearOfflineDraft(prayerDraftKey)");
    expect(portalPrayerRequests).toContain('type: "prayer_request_create"');
    expect(portalPrayerRequests).toContain("enqueueOfflineSyncAction({");
    expect(portalPrayerRequests).toContain("requestText,");
    expect(portalPrayerRequests).toContain("offeringAmount: requestedOffering");
    expect(portalPrayerRequests).toContain("privacy,");
    expect(portalPrayerRequests).toContain("removeOfflineSyncAction(item.id)");
    expect(offlineSync).toContain('type: "prayer_request_create"');
    expect(offlineSync).toContain("await submitPortalPrayerRequest({");
    expect(offlineSync).toContain("idempotency_key: action.id");
  });

  it("keeps submission success feedback, reset behavior, and query invalidation families", () => {
    for (const key of [
      "portal-prayer-requests",
      "my-prayer-requests",
      "my-prayers",
      "my-contributions-all",
      "contributions",
      "simple-member-home",
    ]) {
      expect(portalPrayerRequests).toContain(`queryKey: ["${key}"]`);
      expect(offlineSync).toContain(key);
    }

    expect(portalPrayerRequests).toContain('title: result?.queuedOffline ? "Ombi la maombi limesubiri kutumwa" : "Ombi la maombi limetumwa"');
    expect(portalPrayerRequests).toContain("setDialogOpen(false)");
    expect(portalPrayerRequests).toContain('setRequestText("")');
    expect(portalPrayerRequests).toContain('setOfferingAmount("")');
    expect(portalPrayerRequests).toContain('setPrivacy("public_to_church")');
    expect(portalPrayerRequests).toContain('queryClient.invalidateQueries({ queryKey: ["prayer-request-comments", request.id] })');
    expect(portalPrayerRequests).toContain('queryClient.invalidateQueries({ queryKey: ["prayer-request-prayers", churchId] })');
  });

  it("keeps optional offering semantics and existing contribution/platform fee side effects without gateway claims", () => {
    expect(portalPrayerRequests).toContain('placeholder="Hiari - kiasi kitakachopokelewa na kanisa"');
    expect(portalPrayerRequests).toContain("const PLATFORM_FEE_PERCENT = 1");
    expect(portalPrayerRequests).toContain("const requestedChurchAmount = offeringAmount ? parseFloat(offeringAmount) : 0");
    expect(portalPrayerRequests).toContain("Tuma Ombi na Sadaka");
    expect(submissionRpc).toContain("insert into public.platform_fees");
    expect(submissionRpc).toContain("insert into public.contributions");
    expect(submissionRpc).toContain("'Prayer Request Offering - '");
    expect(`${portalPrayerRequests}\n${prayerHelpers}\n${offlineSync}`).not.toMatch(/M-Pesa|Mpesa|Airtel Money|Mixx by Yas|Selcom|Stripe|PayPal|card processing|checkout session/i);
  });

  it("keeps tenant and security boundaries structural rather than duplicating RLS in the UI", () => {
    expect(submissionRpc).toContain("m.id = p_member_id");
    expect(submissionRpc).toContain("m.church_id = p_church_id");
    expect(submissionRpc).toContain("m.user_id = v_actor_id");
    expect(productionBaseline).toContain("public.can_review_pastoral_requests(church_id)");
    expect(productionBaseline).toContain("public.is_church_member(auth.uid(), church_id)");
    expect(relatedFeatureHelper).toContain("WHEN 'prayer_request_comments' THEN 'prayer_requests'");
    expect(relatedFeatureHelper).toContain("WHEN 'prayer_request_prayers' THEN 'prayer_requests'");
    expect(relatedFeatureHelper).toContain("public.has_church_feature_permission");
  });
});
