import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CalendarDays, Copy, ExternalLink, QrCode, Settings } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SummaryStateProps = {
  isLoading?: boolean;
  isError?: boolean;
};

type MetricWidgetProps = SummaryStateProps & {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  to?: string;
};

export function ChurchAdminMetricWidget({
  title,
  value,
  description,
  icon: Icon,
  to,
  isLoading,
  isError,
}: MetricWidgetProps) {
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

type AttendanceSummaryWidgetProps = SummaryStateProps & {
  confirmed: number;
  maybe: number;
  responseRate: number;
  eventTitle: string | null;
};

export function AttendanceSummaryWidget({
  confirmed,
  maybe,
  responseRate,
  eventTitle,
  isLoading,
  isError,
}: AttendanceSummaryWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          Today's Attendance
        </CardTitle>
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
            Attendance could not be loaded.
          </p>
        ) : eventTitle ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{eventTitle}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <InlineStat label="Confirmed" value={String(confirmed)} />
              <InlineStat label="Maybe" value={String(maybe)} />
              <InlineStat label="Response" value={`${responseRate.toFixed(0)}%`} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming Mass attendance request is active.</p>
        )}
      </CardContent>
    </Card>
  );
}

type MemberSummaryWidgetProps = SummaryStateProps & {
  title: string;
  value: string;
  description: string;
  members?: string[];
  to?: string;
};

export function MemberSummaryWidget({
  title,
  value,
  description,
  members = [],
  to,
  isLoading,
  isError,
}: MemberSummaryWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-9 w-24 rounded-xl" />
            ) : isError ? (
              <p className="mt-2 text-sm text-destructive">Unable to load.</p>
            ) : (
              <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
            )}
          </div>
          {to ? (
            <Button asChild variant="outline" size="sm" className="h-10 rounded-xl">
              <AppLink to={to}>Open</AppLink>
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {members.length ? (
          <div className="space-y-2">
            {members.slice(0, 3).map((member) => (
              <p key={member} className="truncate rounded-2xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
                {member}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type InvitationSummaryWidgetProps = SummaryStateProps & {
  pending: number;
  accepted: number;
  revoked: number;
};

export function InvitationSummaryWidget({
  pending,
  accepted,
  revoked,
  isLoading,
  isError,
}: InvitationSummaryWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Pending Invitations</CardTitle>
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
            Invitations could not be loaded.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Pending" value={String(pending)} />
            <InlineStat label="Accepted" value={String(accepted)} />
            <InlineStat label="Revoked" value={String(revoked)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ChurchAdminQuickActionsWidgetProps = {
  actions: Array<{
    id: string;
    label: string;
    to: string;
    icon?: (props: { className?: string }) => ReactNode;
    primary?: boolean;
  }>;
};

export function ChurchAdminQuickActionsWidget({ actions }: ChurchAdminQuickActionsWidgetProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <AppLink
            key={action.id}
            to={action.to}
            className={cn(
              "flex min-h-24 items-center gap-4 rounded-[28px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
              action.primary
                ? "border-primary/25 bg-primary text-primary-foreground"
                : "border-border/70 bg-card/85 text-foreground hover:border-primary/30",
            )}
          >
            {Icon ? (
              <span
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                  action.primary ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-7 w-7" />
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block text-xl font-bold leading-tight">{action.label}</span>
            </span>
          </AppLink>
        );
      })}
    </section>
  );
}

type MemberSignupQrWidgetProps = SummaryStateProps & {
  churchName?: string | null;
  churchSlug?: string | null;
};

export function MemberSignupQrWidget({
  churchName,
  churchSlug,
  isLoading,
  isError,
}: MemberSignupQrWidgetProps) {
  const { toast } = useToast();
  const joinUrl = churchSlug && typeof window !== "undefined" ? `${window.location.origin}/join/${churchSlug}` : null;

  const copyJoinLink = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    toast({
      title: "Member signup link copied",
      description: "Share this link or QR code so members can register for this church.",
    });
  };

  return (
    <Card className="rounded-[28px] border-primary/20 bg-card/90 shadow-sm">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">Member Signup QR</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Let members scan this code to create an account and join {churchName || "this church"}.
              </p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-5 w-64 rounded" />
          ) : isError ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              Unable to load the church signup link.
            </p>
          ) : joinUrl ? (
            <p className="break-all rounded-2xl border border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
              {joinUrl}
            </p>
          ) : (
            <p className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              Add a church slug in settings to enable the public signup QR.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={copyJoinLink} disabled={!joinUrl}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Copy Link
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <AppLink to="/church-admin/roles">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Invite Hub
              </AppLink>
            </Button>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <div className="rounded-[24px] border border-border/70 bg-white p-4 shadow-sm">
            {joinUrl ? (
              <QRCodeSVG value={joinUrl} size={132} level="H" marginSize={2} title={`${churchName || "Church"} member signup QR code`} />
            ) : (
              <div className="flex h-[132px] w-[132px] items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <QrCode className="h-10 w-10" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ChurchSettingsSummaryWidgetProps = SummaryStateProps & {
  title?: string;
  description: string;
  statusLabel?: string;
  to?: string;
};

export function ChurchSettingsSummaryWidget({
  title = "Church Settings",
  description,
  statusLabel,
  to,
  isLoading,
  isError,
}: ChurchSettingsSummaryWidgetProps) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">{title}</h3>
            {isLoading ? (
              <Skeleton className="mt-2 h-4 w-48 rounded" />
            ) : isError ? (
              <p className="mt-1 text-sm text-destructive">Unable to load status.</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
            {statusLabel ? <p className="mt-2 text-xs font-medium text-primary">{statusLabel}</p> : null}
          </div>
        </div>
        {to ? (
          <Button asChild variant="outline" className="h-10 shrink-0 rounded-xl">
            <AppLink to={to}>Open</AppLink>
          </Button>
        ) : null}
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
