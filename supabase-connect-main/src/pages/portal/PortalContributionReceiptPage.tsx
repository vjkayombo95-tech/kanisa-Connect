import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, HandCoins, Home, Printer, Receipt } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatTZSForLanguage } from "@/lib/currency";
import { formatLocalizedDate, normalizeAppLanguage } from "@/lib/localization";

type ContributionReceipt = {
  id: string;
  amount: number;
  date: string | null;
  created_at: string | null;
  notes: string | null;
  payment_reference: string | null;
  member_id: string | null;
  church_id: string;
  contribution_categories?: { name: string | null } | null;
  churches?: { name: string | null } | null;
  members?: { full_name: string | null } | null;
};

function formatDate(value: string | null | undefined, language: "en" | "sw") {
  if (!value) return "-";

  return formatLocalizedDate(value, language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPurpose(contribution: ContributionReceipt) {
  const categoryName = contribution.contribution_categories?.name;
  if (categoryName) return categoryName;

  const match = contribution.notes?.match(/^Quick Give:\s*([^|]+)/i);
  return match?.[1]?.trim() || contribution.notes || "General";
}

function getPaymentMethod(contribution: ContributionReceipt) {
  const match = contribution.notes?.match(/Payment Method:\s*([^|]+)/i);
  if (match?.[1]) return match[1].trim();

  return contribution.payment_reference?.split(" - ")[0] || "Recorded";
}

function paymentMethodLabelKey(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "mobile_money" || normalized === "m_pesa" || normalized === "mpesa") return "mobile_money";
  if (normalized === "cash") return "cash";
  if (normalized === "bank_transfer") return "bank_transfer";
  if (normalized === "card") return "card";
  return "other";
}

export default function PortalContributionReceiptPage() {
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const { contributionId } = useParams();
  const { churchId } = useAuth();

  const { data: contribution, isLoading, isError } = useQuery({
    queryKey: ["portal-contribution-receipt", contributionId, churchId],
    queryFn: async (): Promise<ContributionReceipt | null> => {
      if (!contributionId || !churchId) return null;

      const { data, error } = await supabase
        .from("contributions")
        .select("id, amount, date, created_at, notes, payment_reference, member_id, church_id, contribution_categories!contributions_category_id_fkey(name), churches(name), members!contributions_member_id_fkey(full_name)")
        .eq("id", contributionId)
        .eq("church_id", churchId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!contributionId && !!churchId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
    <div className="mx-auto max-w-2xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/portal">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("member_portal.giving_account.back_to_dashboard")}
        </Link>
      </Button>

      <Card className="rounded-2xl border-primary/20 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            {t("member_portal.giving_account.thank_you")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : isError || !contribution ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">{t("member_portal.giving_account.receipt_load_failed")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.giving_account.receipt_load_failed_description")}</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("member_portal.giving_account.contribution_recorded")}</p>
                    <p className="mt-1 text-3xl font-bold text-primary">{formatTZSForLanguage(Number(contribution.amount ?? 0), language)}</p>
                  </div>
                  <Badge variant="outline">{t("member_portal.giving_account.recorded")}</Badge>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <ReceiptDetail label={t("member_portal.giving_account.receipt_number")} value={contribution.id.slice(0, 8).toUpperCase()} />
                  <ReceiptDetail label={t("member_portal.giving_account.contribution_amount")} value={formatTZSForLanguage(Number(contribution.amount ?? 0), language)} />
                  <ReceiptDetail label={t("member_portal.giving_account.purpose")} value={getPurpose(contribution)} />
                  <ReceiptDetail label={t("member_portal.giving_account.church")} value={contribution.churches?.name || t("member_portal.giving_account.your_church")} />
                  <ReceiptDetail label={t("member_portal.giving_account.member")} value={contribution.members?.full_name || t("member_portal.common.member")} />
                  <ReceiptDetail label={t("member_portal.giving_account.date")} value={formatDate(contribution.date || contribution.created_at, language)} />
                  <ReceiptDetail
                    label={t("member_portal.giving_account.payment_method")}
                    value={t(`member_portal.giving_account.payment_methods.${paymentMethodLabelKey(getPaymentMethod(contribution))}`, getPaymentMethod(contribution))}
                  />
                  <ReceiptDetail label={t("member_portal.giving_account.reference")} value={contribution.payment_reference || "-"} />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={() => window.print()} aria-label={t("member_portal.giving_account.print_receipt")}>
                  <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("member_portal.giving_account.print_receipt")}
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/portal/give">
                    <HandCoins className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("member_portal.giving_account.give_again")}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/portal">
                    <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("member_portal.giving_account.return_to_dashboard")}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </main>
  );
}

function ReceiptDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
