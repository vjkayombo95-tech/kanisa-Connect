import { CalendarDays, HandCoins, HeartHandshake, HelpCircle, MessageSquare, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTZS } from "@/lib/currency";

import type { NextMassSummary } from "./types";
import { formatDate } from "./utils";

type PastoralQueueWidgetProps = {
  title: string;
  description: string;
  primaryValue: number;
  primaryLabel: string;
  secondaryValue: number;
  secondaryLabel: string;
  to: string;
  icon: typeof HeartHandshake;
  isLoading?: boolean;
  isError?: boolean;
};

export function PastoralQueueWidget({
  title,
  description,
  primaryValue,
  primaryLabel,
  secondaryValue,
  secondaryLabel,
  to,
  icon: Icon,
  isLoading,
  isError,
}: PastoralQueueWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="h-10 shrink-0 rounded-xl">
            <AppLink to={to}>Open</AppLink>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Could not load this pastoral queue.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <QueueStat label={primaryLabel} value={primaryValue} />
            <QueueStat label={secondaryLabel} value={secondaryValue} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QueueStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

type ParishFinanceSummaryWidgetProps = {
  thisMonthGiving?: number;
  lifetimeGiving?: number;
  contributionCount?: number;
  thisMonthReceived?: number;
  totalReceived?: number;
  transactionCount?: number;
  contributionTotal?: number;
  pledgePaymentTotal?: number;
  eventRegistrationTotal?: number;
  isLoading?: boolean;
  isError?: boolean;
};

export function ParishFinanceSummaryWidget({
  thisMonthGiving,
  lifetimeGiving,
  contributionCount,
  thisMonthReceived,
  totalReceived,
  transactionCount,
  contributionTotal,
  pledgePaymentTotal,
  eventRegistrationTotal,
  isLoading,
  isError,
}: ParishFinanceSummaryWidgetProps) {
  const { t } = useTranslation();
  const resolvedThisMonth = thisMonthReceived ?? thisMonthGiving ?? 0;
  const resolvedTotal = totalReceived ?? lifetimeGiving ?? 0;
  const resolvedTransactions = transactionCount ?? contributionCount ?? 0;
  const hasBreakdown =
    Number(contributionTotal ?? 0) > 0 ||
    Number(pledgePaymentTotal ?? 0) > 0 ||
    Number(eventRegistrationTotal ?? 0) > 0;

  return (
    <Card className="rounded-[28px] border-primary/20 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
          {t("finance_summary.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Finance summary could not be loaded.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <FinanceStat label={t("finance_summary.this_month")} value={formatTZS(resolvedThisMonth)} />
              <FinanceStat label={t("finance_summary.total_received")} value={formatTZS(resolvedTotal)} />
              <FinanceStat label={t("finance_summary.transactions")} value={String(resolvedTransactions)} />
            </div>
            {hasBreakdown ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <FinanceBreakdownStat label={t("finance_summary.contributions")} value={formatTZS(Number(contributionTotal ?? 0))} />
                <FinanceBreakdownStat label={t("finance_summary.pledge_payments")} value={formatTZS(Number(pledgePaymentTotal ?? 0))} />
                <FinanceBreakdownStat label={t("finance_summary.event_registration_revenue")} value={formatTZS(Number(eventRegistrationTotal ?? 0))} />
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function FinanceBreakdownStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/30 px-3 py-2">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function PriestUpcomingEventsWidget({
  massSummary,
  massSchedulePath = "/church-admin/mass-schedule",
  isLoading,
  isError,
}: {
  massSummary: NextMassSummary | undefined;
  massSchedulePath?: string;
  isLoading?: boolean;
  isError?: boolean;
}) {
  const mass = massSummary?.mass ?? null;

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarDays className="h-4 w-4" />
              Upcoming Events
            </p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">{mass?.title ?? "No upcoming Mass scheduled"}</h2>
            {mass ? <p className="mt-1 text-sm text-muted-foreground">{formatDate(mass.mass_date)}</p> : null}
          </div>
          <Button asChild variant="outline" className="h-11 rounded-2xl">
            <AppLink to={massSchedulePath}>Mass Schedule</AppLink>
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Upcoming events could not be loaded.
          </div>
        ) : mass ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <QueueStat label="Attending" value={Number(massSummary?.yes_count ?? 0)} />
            <QueueStat label="Maybe" value={Number(massSummary?.maybe_count ?? 0)} />
            <QueueStat label="Response %" value={Number(massSummary?.response_rate ?? 0)} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Create a Mass schedule to show the next event here.</p>
        )}
      </CardContent>
    </Card>
  );
}

type PriestQuickActionsWidgetProps = {
  paths?: {
    massIntentions?: string;
    prayerRequests?: string;
    communityHelp?: string;
    contributions?: string;
  };
};

export function PriestQuickActionsWidget({ paths = {} }: PriestQuickActionsWidgetProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <PriestAction icon={HeartHandshake} label="Mass Intentions" hint="Review and schedule intentions" to={paths.massIntentions ?? "/church-admin/mass-intentions"} primary />
      <PriestAction icon={MessageSquare} label="Prayer Requests" hint="Review pastoral prayer needs" to={paths.prayerRequests ?? "/church-admin/prayer-requests"} />
      <PriestAction icon={HelpCircle} label="Community Help" hint="Review assistance requests" to={paths.communityHelp ?? "/church-admin/community-help"} />
      <PriestAction icon={HandCoins} label="Contributions" hint="Open parish contribution records" to={paths.contributions ?? "/church-admin/contributions"} />
    </section>
  );
}

function PriestAction({
  icon: Icon,
  label,
  hint,
  to,
  primary,
}: {
  icon: typeof HeartHandshake;
  label: string;
  hint: string;
  to: string;
  primary?: boolean;
}) {
  return (
    <AppLink
      to={to}
      className={
        primary
          ? "flex min-h-24 items-center gap-4 rounded-[28px] border border-primary/25 bg-primary p-4 text-left text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          : "flex min-h-24 items-center gap-4 rounded-[28px] border border-border/70 bg-card/85 p-4 text-left text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
      }
    >
      <span className={primary ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15" : "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight">{label}</span>
        <span className={primary ? "mt-1 block text-sm text-primary-foreground/80" : "mt-1 block text-sm text-muted-foreground"}>{hint}</span>
      </span>
    </AppLink>
  );
}
