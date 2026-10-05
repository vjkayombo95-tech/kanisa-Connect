import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Printer, ReceiptText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLinkedMember } from "@/hooks/use-linked-member";
import { formatTZS } from "@/lib/currency";
import { formatAppDate } from "@/lib/localization";
import { contributionDisplayReference, fetchMemberContributionReceipt } from "@/lib/member-contributions";

export default function PortalContributionReceiptPage() {
  const { t, i18n } = useTranslation();
  const { contributionId } = useParams();
  const { churchId } = useAuth();
  const { data: member, isLoading: memberLoading, isError: memberError } = useLinkedMember();
  const receipt = useQuery({
    queryKey: ["member-contribution-receipt", contributionId, churchId, member?.id],
    queryFn: () => fetchMemberContributionReceipt(contributionId!, churchId!, member!.id),
    enabled: !!contributionId && !!churchId && !!member?.id,
  });
  const loading = memberLoading || receipt.isLoading;
  const contribution = receipt.data;

  if (!contributionId) return <Unavailable />;

  return <main className="mx-auto max-w-2xl px-4 py-5 pb-28 lg:px-8 lg:py-8" data-testid="contribution-receipt-page">
    {loading ? <Card className="rounded-3xl"><CardContent className="space-y-4 p-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></CardContent></Card>
      : memberError || receipt.isError || !member || !contribution ? <Unavailable />
      : <>
        <Card className="receipt-print-area overflow-hidden rounded-3xl border-primary/20">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b pb-5"><div><p className="text-sm font-semibold text-primary">Kanisa Connect</p><h1 className="mt-1 text-2xl font-bold">{t("member_contribution_receipt.title")}</h1></div><ReceiptText className="h-9 w-9 text-primary" /></div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <Detail label={t("member_contribution_receipt.labels.member")} value={member.full_name || contribution.donor_name || t("member_contribution_receipt.fallback_member")} />
              <Detail label={t("member_contribution_receipt.labels.amount")} value={formatTZS(contribution.amount)} />
              <Detail label={t("member_contribution_receipt.labels.category")} value={contribution.contribution_categories?.name || t("member_contribution_receipt.fallback_category")} />
              <Detail label={t("member_contribution_receipt.labels.date")} value={formatAppDate(contribution.date, i18n.language, { dateStyle: "long" })} />
              <Detail label={t("member_contribution_receipt.labels.receipt_reference")} value={contributionDisplayReference(contribution)} />
              <Detail label={t("member_contribution_receipt.labels.payment_reference")} value={contribution.payment_reference || t("member_contribution_receipt.no_payment_reference")} />
            </dl>
            {contribution.notes ? <div className="mt-6 border-t pt-5"><p className="text-xs font-semibold uppercase text-muted-foreground">{t("member_contribution_receipt.labels.notes")}</p><p className="mt-1 whitespace-pre-wrap text-sm">{contribution.notes}</p></div> : null}
          </CardContent>
        </Card>
        <div className="mt-4 flex flex-col gap-2 print:hidden sm:flex-row"><Button className="flex-1" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{t("member_contribution_receipt.actions.print")}</Button><Button asChild variant="outline" className="flex-1"><Link to="/portal/contribution-history">{t("member_contribution_receipt.actions.back")}</Link></Button></div>
      </>}
  </main>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>; }
function Unavailable() {
  const { t } = useTranslation();
  return <Card className="mx-auto max-w-2xl rounded-3xl"><CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center"><AlertCircle className="h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-bold">{t("member_contribution_receipt.unavailable.title")}</h1><p className="max-w-md text-sm text-muted-foreground">{t("member_contribution_receipt.unavailable.description")}</p><Button asChild variant="outline"><Link to="/portal/contribution-history">{t("member_contribution_receipt.unavailable.history_link")}</Link></Button></CardContent></Card>;
}
