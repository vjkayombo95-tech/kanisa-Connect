import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Printer, ReceiptText } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLinkedMember } from "@/hooks/use-linked-member";
import { formatTZS } from "@/lib/currency";
import { contributionDisplayReference, fetchMemberContributionReceipt } from "@/lib/member-contributions";

export default function PortalContributionReceiptPage() {
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
            <div className="flex items-start justify-between gap-4 border-b pb-5"><div><p className="text-sm font-semibold text-primary">Kanisa Connect</p><h1 className="mt-1 text-2xl font-bold">Risiti ya Mchango</h1></div><ReceiptText className="h-9 w-9 text-primary" /></div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <Detail label="Mwanachama" value={member.full_name || contribution.donor_name || "Mwanachama"} />
              <Detail label="Kiasi" value={formatTZS(contribution.amount)} />
              <Detail label="Aina ya mchango" value={contribution.contribution_categories?.name || "Mchango"} />
              <Detail label="Tarehe" value={new Intl.DateTimeFormat("sw-TZ", { dateStyle: "long" }).format(new Date(contribution.date))} />
              <Detail label="Rejea ya risiti" value={contributionDisplayReference(contribution)} />
              <Detail label="Rejea ya malipo" value={contribution.payment_reference || "—"} />
            </dl>
            {contribution.notes ? <div className="mt-6 border-t pt-5"><p className="text-xs font-semibold uppercase text-muted-foreground">Maelezo</p><p className="mt-1 whitespace-pre-wrap text-sm">{contribution.notes}</p></div> : null}
          </CardContent>
        </Card>
        <div className="mt-4 flex flex-col gap-2 print:hidden sm:flex-row"><Button className="flex-1" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Chapisha / Hifadhi PDF</Button><Button asChild variant="outline" className="flex-1"><Link to="/portal/contribution-history">Rudi kwenye historia</Link></Button></div>
      </>}
  </main>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>; }
function Unavailable() { return <Card className="mx-auto max-w-2xl rounded-3xl"><CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center"><AlertCircle className="h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-bold">Risiti haipatikani</h1><p className="max-w-md text-sm text-muted-foreground">Rekodi hii haipo au huna ruhusa ya kuiona.</p><Button asChild variant="outline"><Link to="/portal/contribution-history">Historia ya Michango</Link></Button></CardContent></Card>; }
