import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BarChart3, FileText, ShieldCheck } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StateProps = {
  isLoading?: boolean;
  isError?: boolean;
};

type FinanceMetricWidgetProps = StateProps & {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  to?: string;
};

export function FinanceMetricWidget({
  title,
  value,
  description,
  icon: Icon,
  to,
  isLoading,
  isError,
}: FinanceMetricWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          {to ? (
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label={`Open ${title}`}>
              <AppLink to={to}>
                <ArrowRight className="h-4 w-4" />
              </AppLink>
            </Button>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-9 w-28 rounded-xl" />
          ) : isError ? (
            <p className="mt-2 text-sm text-destructive">Unable to load.</p>
          ) : (
            <p className="mt-1 break-words text-3xl font-bold text-foreground">{value}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

type CollectionItem = {
  id: string;
  title: string;
  detail: string;
  amount?: string;
  date?: string | null;
};

type RecentCollectionsWidgetProps = StateProps & {
  title: string;
  description: string;
  items: CollectionItem[];
  emptyMessage: string;
  to?: string;
};

export function RecentCollectionsWidget({
  title,
  description,
  items,
  emptyMessage,
  to,
  isLoading,
  isError,
}: RecentCollectionsWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {to ? (
            <Button asChild variant="outline" size="sm" className="h-10 shrink-0 rounded-xl">
              <AppLink to={to}>Open</AppLink>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </>
        ) : isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Unable to load this collection summary.
          </p>
        ) : items.length ? (
          items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/50 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <div className="shrink-0 text-right">
                {item.amount ? <p className="text-sm font-semibold text-primary">{item.amount}</p> : null}
                {item.date ? <p className="mt-1 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString()}</p> : null}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type ContributionTrendWidgetProps = StateProps & {
  title: string;
  description: string;
  points: Array<{ label: string; value: number }>;
  formatValue: (value: number) => string;
};

export function ContributionTrendWidget({
  title,
  description,
  points,
  formatValue,
  isLoading,
  isError,
}: ContributionTrendWidgetProps) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </span>
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-6 items-end gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Contribution trends could not be loaded.
          </p>
        ) : points.length ? (
          <div className="grid grid-cols-6 items-end gap-3">
            {points.map((point) => (
              <div key={point.label} className="space-y-2">
                <div className="flex h-32 items-end rounded-2xl border border-border/60 bg-background/50 p-2">
                  <div
                    className="w-full rounded-xl bg-primary"
                    style={{ height: `${Math.max((point.value / maxValue) * 100, point.value > 0 ? 8 : 0)}%` }}
                    aria-label={`${point.label}: ${formatValue(point.value)}`}
                  />
                </div>
                <p className="truncate text-center text-xs text-muted-foreground">{point.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No trend data is available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

type FinanceReportsWidgetProps = StateProps & {
  title: string;
  description: string;
  rows: Array<{ label: string; value: string }>;
  to?: string;
};

export function FinanceReportsWidget({ title, description, rows, to, isLoading, isError }: FinanceReportsWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {to ? (
            <Button asChild variant="outline" size="sm" className="h-10 shrink-0 rounded-xl">
              <AppLink to={to}>Open</AppLink>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </>
        ) : isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Report data could not be loaded.
          </p>
        ) : rows.length ? (
          rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/50 p-3">
              <p className="text-sm text-muted-foreground">{row.label}</p>
              <p className="text-sm font-semibold text-foreground">{row.value}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No report data available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

type PlatformFeeSummaryWidgetProps = StateProps & {
  totalFees: string;
  netAmount: string;
  feeCount: number;
};

export function PlatformFeeSummaryWidget({
  totalFees,
  netAmount,
  feeCount,
  isLoading,
  isError,
}: PlatformFeeSummaryWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Platform Fees Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : isError ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            Platform fee records could not be loaded.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Fees" value={totalFees} />
            <InlineStat label="Net Amount" value={netAmount} />
            <InlineStat label="Rows" value={String(feeCount)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type FinanceQuickActionsWidgetProps = {
  actions: Array<{
    id: string;
    label: string;
    to: string;
    icon?: (props: { className?: string }) => ReactNode;
    primary?: boolean;
  }>;
};

export function FinanceQuickActionsWidget({ actions }: FinanceQuickActionsWidgetProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <AppLink
            key={action.id}
            to={action.to}
            className={cn(
              "flex min-h-20 items-center gap-4 rounded-[28px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
              action.primary
                ? "border-primary/25 bg-primary text-primary-foreground"
                : "border-border/70 bg-card/85 text-foreground hover:border-primary/30",
            )}
          >
            {Icon ? (
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  action.primary ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight">{action.label}</span>
            </span>
          </AppLink>
        );
      })}
    </section>
  );
}

type AuditSummaryWidgetProps = StateProps & {
  count: number;
  latestLabel: string;
  auditLogsPath?: string;
};

export function AuditSummaryWidget({
  count,
  latestLabel,
  auditLogsPath = "/church-admin/audit-logs",
  isLoading,
  isError,
}: AuditSummaryWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">Audit Summary</h3>
            {isLoading ? (
              <Skeleton className="mt-2 h-4 w-48 rounded" />
            ) : isError ? (
              <p className="mt-1 text-sm text-destructive">Unable to load audit status.</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {count} audit {count === 1 ? "entry" : "entries"} tracked. {latestLabel}
              </p>
            )}
          </div>
        </div>
        <Button asChild variant="outline" className="h-10 shrink-0 rounded-xl">
          <AppLink to={auditLogsPath}>
            <FileText className="mr-2 h-4 w-4" />
            Open
          </AppLink>
        </Button>
      </CardContent>
    </Card>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
