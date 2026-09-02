import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const matches = (source: string, pattern: RegExp) => pattern.test(source);

describe("PortalGive Michango behavior contract", () => {
  const portalGive = read("src/pages/portal/PortalGive.tsx");

  it("keeps amount validation finite and greater than zero", () => {
    expect(portalGive).toContain("const parsedAmount = Number(amount)");
    expect(portalGive).toContain("!Number.isFinite(parsedAmount) || parsedAmount <= 0");
    expect(portalGive).toContain('throw new Error("Enter a valid amount")');
  });

  it("keeps contribution category optional in current submission behavior", () => {
    expect(portalGive).toContain("const [categoryId, setCategoryId] = useState(\"\")");
    expect(portalGive).toContain("p_category_id: categoryId || null");
    expect(matches(portalGive, /throw new Error\([^)]*(category|purpose|type)/i), "category currently must not fail before RPC submission").toBe(false);
  });

  it("has no payment method field and keeps payment reference as optional metadata", () => {
    expect(matches(portalGive, /paymentMethod|payment_method/), "PortalGive must not introduce a payment method field").toBe(false);
    expect(portalGive).toContain("const [paymentRef, setPaymentRef] = useState(\"\")");
    expect(portalGive).toContain("p_payment_reference: paymentRef || null");
    expect(portalGive).toContain("<Label>Kumbukumbu ya malipo</Label>");
  });

  it("keeps phone and payment reference optional", () => {
    expect(portalGive).toContain("p_phone: phone || null");
    expect(portalGive).toContain("p_payment_reference: paymentRef || null");
  });

  it("submits through the contribution RPC and protects payload field names", () => {
    expect(portalGive).toContain('supabase.rpc("record_contribution_with_key"');
    for (const field of [
      "p_church_id",
      "p_amount",
      "p_idempotency_key",
      "p_member_id",
      "p_donor_name",
      "p_phone",
      "p_payment_reference",
      "p_category_id",
      "p_notes",
    ]) {
      expect(portalGive).toContain(field);
    }
  });

  it("attributes submissions to authenticated church and member context", () => {
    expect(portalGive).toContain("const { churchId, user } = useAuth()");
    expect(portalGive).toContain("p_church_id: churchId");
    expect(portalGive).toContain("p_member_id: member?.id || null");
    expect(portalGive).toContain('p_donor_name: member?.full_name || user?.email || "Member"');
  });

  it("keeps an idempotency key per draft and passes it to the RPC", () => {
    expect(portalGive).toContain("function createSubmissionKey()");
    expect(portalGive).toContain("crypto.randomUUID()");
    expect(portalGive).toContain("const [idempotencyKey, setIdempotencyKey] = useState(createSubmissionKey)");
    expect(portalGive).toContain("setIdempotencyKey(createSubmissionKey())");
    expect(portalGive).toContain("p_idempotency_key: idempotencyKey");
  });

  it("keeps submit disabled while pending and prevents empty amount submission", () => {
    expect(portalGive).toContain("disabled={give.isPending || !amount}");
    expect(portalGive).toContain("give.isPending ?");
  });

  it("keeps successful submission query invalidations", () => {
    for (const queryKey of [
      '["contributions"]',
      '["my-contributions-all"]',
      '["simple-member-home"]',
      '["my-member-record"]',
      '["portal-dashboard-church"]',
    ]) {
      expect(portalGive).toContain(`queryClient.invalidateQueries({ queryKey: ${queryKey} })`);
    }
  });

  it("keeps successful submissions in the inline thank-you state without receipt navigation", () => {
    expect(matches(portalGive, /useNavigate\(\)/), "PortalGive must not depend on route navigation for success").toBe(false);
    expect(portalGive).not.toContain("/portal/contribution-receipt/");
    expect(portalGive).toContain("setSubmitted(true)");
    expect(portalGive).toContain('toast({ title: "Mchango umerekodiwa"');
    expect(portalGive).toContain("if (submitted)");
    expect(portalGive).toContain("Mchango umerekodiwa");
    expect(portalGive).toContain('Tumerekodi mchango wako wa {formatTZS(parseFloat(amount || "0"))}.');
    expect(portalGive).toContain("Rekodi Mchango Mwingine");
  });

  it("keeps Give Again resetting the current draft fields and idempotency key", () => {
    expect(portalGive).toContain("setSubmitted(false)");
    expect(portalGive).toContain('setAmount("")');
    expect(portalGive).toContain('setPhone(member?.phone || "")');
    expect(portalGive).toContain('setPaymentRef("")');
    expect(portalGive).toContain('setCategoryId("")');
    expect(portalGive).toContain("setIdempotencyKey(createSubmissionKey())");
  });

  it("does not navigate to a receipt on RPC errors", () => {
    expect(portalGive).toContain("if (error) throw error");
    expect(portalGive).toMatch(/onError:\s*\([^)]*\)\s*=>/);
    expect(portalGive).not.toMatch(/onError:[\s\S]*\/portal\/contribution-receipt/);
  });

  it("keeps unsuccessful RPC results as failures", () => {
    expect(portalGive).toContain("if (!result?.success)");
    expect(portalGive).toContain('throw new Error(result?.error || "Contribution was not recorded.")');
  });

  it("uses result.success as the success contract without requiring a receipt id", () => {
    expect(portalGive).toContain("const result = data as { success?: boolean; error?: string } | null");
    expect(portalGive).toContain("if (!result?.success)");
    expect(portalGive).toContain('throw new Error(result?.error || "Contribution was not recorded.")');
    expect(matches(portalGive, /result\?\.(?:id|contribution_id|contributionId)/), "PortalGive must not require a receipt/contribution id").toBe(false);
  });

  it("does not introduce or assume a real payment gateway", () => {
    expect(portalGive).not.toMatch(/stripe|paypal|checkout|payment_intent|paymentIntent|gateway/i);
  });

  it("keeps member lookup tied to authenticated user and church with email fallback", () => {
    expect(portalGive).toContain('queryKey: ["my-member-record", user?.id, user?.email, churchId]');
    expect(portalGive).toContain('.from("members")');
    expect(portalGive).toContain('.eq("user_id", user.id)');
    expect(portalGive).toContain('.eq("church_id", churchId)');
    expect(portalGive).toContain("const normalizedEmail = user.email?.trim().toLowerCase()");
    expect(portalGive).toContain('.ilike("email", normalizedEmail)');
  });

  it("keeps contribution categories scoped to the authenticated church", () => {
    expect(portalGive).toContain('queryKey: ["portal-categories", churchId]');
    expect(portalGive).toContain('.from("contribution_categories")');
    expect(portalGive).toContain('.eq("church_id", churchId)');
    expect(portalGive).toContain("enabled: !!churchId");
  });
});
