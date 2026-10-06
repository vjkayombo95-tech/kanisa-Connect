import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, HandCoins, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useLinkedMember } from "@/hooks/use-linked-member";
import { formatTZS } from "@/lib/currency";
import { formatAppDate } from "@/lib/localization";
import { fetchMemberContributionPage, MEMBER_CONTRIBUTION_PAGE_SIZE, type MemberContribution } from "@/lib/member-contributions";

export default function PortalContributionHistoryPage() {
  const { t, i18n } = useTranslation();
  const { churchId } = useAuth();
  const { data: member, isLoading: memberLoading, isError: memberError } = useLinkedMember();
  const [page, setPage] = useState(0);
  const history = useQuery({
    queryKey: ["member-contribution-history", churchId, member?.id, page],
    queryFn: () => fetchMemberContributionPage(churchId!, member!.id, page),
    enabled: !!churchId && !!member?.id,
  });
  const loading = memberLoading || history.isLoading;
  const records = history.data?.records ?? [];
  const count = history.data?.count ?? 0;
  const purpose = (row: MemberContribution) => row.contribution_categories?.name || t("member_contribution_history.fallback_category");
  const dateLabel = (value: string) => formatAppDate(value, i18n.language, { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 pb-28 lg:px-8 lg:py-8" data-testid="contribution-history-page">
      <div>
        <p className="text-sm font-semibold text-primary">{t("member_contribution_history.eyebrow")}</p>
        <h1 className="text-2xl font-bold tracking-tight">{t("member_contribution_history.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("member_contribution_history.subtitle")}</p>
      </div>

      <Card className="overflow-hidden rounded-3xl">
        <CardContent className="p-0">
          {loading ? <div className="space-y-3 p-5" aria-label={t("member_contribution_history.loading_aria")}><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            : memberError || history.isError ? <State icon={ReceiptText} text={t("member_contribution_history.error")} />
            : !member ? <State icon={ReceiptText} text={t("member_contribution_history.member_not_linked")} />
            : records.length === 0 ? <State icon={HandCoins} text={t("member_contribution_history.empty")} />
            : <>
              <div className="divide-y md:hidden">
                {records.map((row) => <Link key={row.id} to={`/portal/contribution-receipt/${row.id}`} state={{ from: "/portal/contribution-history" }} className="flex min-h-24 items-center gap-3 p-4 hover:bg-muted/40">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ReceiptText className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{formatTZS(row.amount)}</span><span className="block truncate text-sm text-muted-foreground">{purpose(row)} - {dateLabel(row.date)}</span>{row.payment_reference ? <span className="block truncate text-xs text-muted-foreground">{t("member_contribution_history.reference_prefix", { reference: row.payment_reference })}</span> : null}</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>)}
              </div>
              <Table className="hidden md:table">
                <TableHeader><TableRow><TableHead>{t("member_contribution_history.table.date")}</TableHead><TableHead>{t("member_contribution_history.table.category")}</TableHead><TableHead>{t("member_contribution_history.table.reference")}</TableHead><TableHead className="text-right">{t("member_contribution_history.table.amount")}</TableHead></TableRow></TableHeader>
                <TableBody>{records.map((row) => <TableRow key={row.id} className="cursor-pointer"><TableCell><Link className="block" to={`/portal/contribution-receipt/${row.id}`}>{dateLabel(row.date)}</Link></TableCell><TableCell>{purpose(row)}</TableCell><TableCell>{row.payment_reference || t("member_contribution_history.no_reference")}</TableCell><TableCell className="text-right font-bold">{formatTZS(row.amount)}</TableCell></TableRow>)}</TableBody>
              </Table>
            </>}
        </CardContent>
      </Card>

      {count > MEMBER_CONTRIBUTION_PAGE_SIZE ? <div className="flex items-center justify-between">
        <Button variant="outline" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-2 h-4 w-4" />{t("member_contribution_history.pagination.previous")}</Button>
        <span className="text-sm text-muted-foreground">{t("member_contribution_history.pagination.page", { page: page + 1 })}</span>
        <Button variant="outline" disabled={(page + 1) * MEMBER_CONTRIBUTION_PAGE_SIZE >= count || loading} onClick={() => setPage((value) => value + 1)}>{t("member_contribution_history.pagination.next")}<ChevronRight className="ml-2 h-4 w-4" /></Button>
      </div> : null}
    </main>
  );
}

function State({ icon: Icon, text }: { icon: typeof ReceiptText; text: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><Icon className="h-10 w-10 text-muted-foreground" /><p className="max-w-md text-sm text-muted-foreground">{text}</p></div>;
}
