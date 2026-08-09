import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Filter, Printer, Receipt, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useMember } from "@/hooks/useMember";
import { supabase } from "@/integrations/supabase/client";
import { formatTZSForLanguage } from "@/lib/currency";
import { formatLocalizedDate, normalizeAppLanguage } from "@/lib/localization";

type MemberRecord = {
  id: string;
  full_name: string | null;
  church_id: string;
};

type ContributionCategory = {
  id: string;
  name: string;
};

type ContributionRow = {
  id: string;
  amount: number;
  date: string | null;
  created_at: string | null;
  notes: string | null;
  payment_reference: string | null;
  category_id: string | null;
  contribution_categories?: { name: string | null } | null;
};

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

function formatDate(value: string | null | undefined, language: "en" | "sw") {
  if (!value) return "-";

  return formatLocalizedDate(value, language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getContributionDate(contribution: ContributionRow) {
  return contribution.date || contribution.created_at || null;
}

function getPurpose(contribution: ContributionRow) {
  return contribution.contribution_categories?.name || contribution.notes || "General";
}

function buildYearOptions(years: number[]) {
  const currentYear = new Date().getFullYear();
  const merged = new Set([currentYear, ...years]);
  return Array.from(merged).sort((left, right) => right - left);
}

export default function PortalContributionHistoryPage() {
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const { user, churchId } = useAuth();
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [receiptContribution, setReceiptContribution] = useState<ContributionRow | null>(null);

  const { data: member, isLoading: memberLoading } = useMember<MemberRecord>("id, full_name, church_id");

  const { data: categories = [] } = useQuery({
    queryKey: ["member-giving-history-categories", churchId],
    queryFn: async (): Promise<ContributionCategory[]> => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("contribution_categories")
        .select("id, name")
        .eq("church_id", churchId)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!churchId,
    staleTime: 10 * 60 * 1000,
  });

  const { data: contributionYears = [] } = useQuery({
    queryKey: ["member-giving-history-years", member?.id],
    queryFn: async (): Promise<number[]> => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from("contributions")
        .select("date, created_at")
        .eq("member_id", member.id)
        .order("date", { ascending: false });

      if (error) throw error;

      return Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.date || row.created_at)
            .filter(Boolean)
            .map((value) => new Date(value as string).getFullYear()),
        ),
      );
    },
    enabled: !!member?.id,
    staleTime: 10 * 60 * 1000,
  });

  const {
    data: contributions = [],
    isLoading: contributionsLoading,
    isError: contributionsError,
  } = useQuery({
    queryKey: ["member-giving-history", member?.id, churchId, month, year, categoryId],
    queryFn: async (): Promise<ContributionRow[]> => {
      if (!member?.id || !churchId) return [];

      let query = supabase
        .from("contributions")
        .select("id, amount, date, created_at, notes, payment_reference, category_id, contribution_categories!contributions_category_id_fkey(name)")
        .eq("church_id", churchId)
        .eq("member_id", member.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (categoryId !== "all") {
        query = query.eq("category_id", categoryId);
      }

      if (year !== "all") {
        const selectedMonth = month === "all" ? null : Number(month) - 1;
        const start = selectedMonth === null
          ? new Date(Number(year), 0, 1)
          : new Date(Number(year), selectedMonth, 1);
        const end = selectedMonth === null
          ? new Date(Number(year) + 1, 0, 1)
          : new Date(Number(year), selectedMonth + 1, 1);

        query = query
          .gte("date", start.toISOString().slice(0, 10))
          .lt("date", end.toISOString().slice(0, 10));
      } else if (month !== "all") {
        const currentYear = new Date().getFullYear();
        const selectedMonth = Number(month) - 1;
        const start = new Date(currentYear, selectedMonth, 1);
        const end = new Date(currentYear, selectedMonth + 1, 1);

        query = query
          .gte("date", start.toISOString().slice(0, 10))
          .lt("date", end.toISOString().slice(0, 10));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!member?.id && !!churchId,
    staleTime: 60 * 1000,
  });

  const yearOptions = useMemo(() => buildYearOptions(contributionYears), [contributionYears]);
  const total = useMemo(
    () => contributions.reduce((sum, contribution) => sum + Number(contribution.amount ?? 0), 0),
    [contributions],
  );
  const loading = memberLoading || contributionsLoading;

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 rounded-xl">
            <Link to="/portal">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("member_portal.common.back")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{t("member_portal.giving_account.contribution_history")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("member_portal.giving_account.contribution_history_description")}</p>
        </div>
        <Card className="rounded-2xl border-primary/20 bg-card/95 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.filtered_total")}</p>
              <p className="text-lg font-bold">{formatTZSForLanguage(total, language)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("member_portal.giving_account.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue placeholder={t("member_portal.giving_account.month")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("member_portal.giving_account.all_months")}</SelectItem>
                {MONTHS.map((item) => (
                  <SelectItem key={item} value={item}>{formatLocalizedDate(new Date(2026, Number(item) - 1, 1), language, { month: "long" })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue placeholder={t("member_portal.giving_account.year")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("member_portal.giving_account.all_years")}</SelectItem>
                {yearOptions.map((item) => (
                  <SelectItem key={item} value={String(item)}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={t("member_portal.giving_account.contribution_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("member_portal.giving_account.all_types")}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl bg-card/95 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member_portal.giving_account.amount")}</TableHead>
                <TableHead>{t("member_portal.giving_account.purpose")}</TableHead>
                <TableHead>{t("member_portal.giving_account.date")}</TableHead>
                <TableHead>{t("member_portal.giving_account.status")}</TableHead>
                <TableHead className="text-right">{t("member_portal.giving_account.receipt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : contributionsError ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-destructive">
                    {t("member_portal.giving_account.unable_load_history")}
                  </TableCell>
                </TableRow>
              ) : !member ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    {t("member_portal.giving_account.no_member_record")}
                  </TableCell>
                </TableRow>
              ) : contributions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    {t("member_portal.giving_account.no_contributions_match")}
                  </TableCell>
                </TableRow>
              ) : (
                contributions.map((contribution) => (
                  <TableRow key={contribution.id}>
                    <TableCell className="font-semibold text-primary">{formatTZSForLanguage(Number(contribution.amount ?? 0), language)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getPurpose(contribution)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(getContributionDate(contribution), language)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t("member_portal.giving_account.recorded")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setReceiptContribution(contribution)} aria-label={t("member_portal.giving_account.open_receipt_for", { amount: formatTZSForLanguage(Number(contribution.amount ?? 0), language) })}>
                        <Receipt className="mr-2 h-4 w-4" aria-hidden="true" />
                        {t("member_portal.giving_account.receipt")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!receiptContribution} onOpenChange={(open) => !open && setReceiptContribution(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("member_portal.giving_account.contribution_receipt")}</DialogTitle>
          </DialogHeader>
          {receiptContribution ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("member_portal.giving_account.member")}</p>
                    <p className="font-semibold">{member?.full_name || user?.email || t("member_portal.common.member")}</p>
                  </div>
                  <Badge variant="outline">{t("member_portal.giving_account.recorded")}</Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.amount")}</p>
                    <p className="font-semibold">{formatTZSForLanguage(Number(receiptContribution.amount ?? 0), language)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.purpose")}</p>
                    <p className="font-semibold">{getPurpose(receiptContribution)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.date")}</p>
                    <p className="font-semibold">{formatDate(getContributionDate(receiptContribution), language)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.reference")}</p>
                    <p className="font-semibold">{receiptContribution.payment_reference || "-"}</p>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={() => window.print()} aria-label={t("member_portal.giving_account.print_receipt")}>
                <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("member_portal.giving_account.print_receipt")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
    </main>
  );
}
