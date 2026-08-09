import { useMemo, type ReactNode } from "react";
import { ArrowRight, CalendarClock, CircleAlert, Clock3, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import type { WorkspaceConfig, WorkspaceNavigationItem } from "@/components/workspace";
import { AssistantBriefing } from "@/components/assistant/AssistantBriefing";
import { AssistantSuggestions } from "@/components/assistant/AssistantSuggestions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventPriorityStyles } from "@/lib/assistant/events";
import { getAutomationHistory } from "@/lib/automation";
import { cn } from "@/lib/utils";
import type { AssistantEvent, AssistantModel } from "@/lib/assistant";

import {
  DashboardSectionRenderer,
  type DashboardConfig,
  type DashboardSectionConfig,
  type DashboardWidget,
} from "./framework";

type TimelineItem = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  to?: string;
};

type DashboardExperienceProps<TContext> = {
  workspace: WorkspaceConfig<TContext>;
  role?: string | null;
  context: TContext;
  widgets: Record<string, DashboardWidget<TContext>>;
  config: DashboardConfig<TContext>;
  assistant: AssistantModel;
  quickActions?: WorkspaceNavigationItem[];
  className?: string;
};

const snapshotSkipIds = new Set(["greeting", "hero", "quick-actions", "footer"]);

function isSnapshotSection<TContext>(section: DashboardSectionConfig<TContext>) {
  return section.widgets.some((slot) => !snapshotSkipIds.has(slot.id));
}

function snapshotSection<TContext>(section: DashboardSectionConfig<TContext>): DashboardSectionConfig<TContext> {
  return {
    ...section,
    showHeader: true,
    className: "space-y-3",
    widgets: section.widgets.filter((slot) => !snapshotSkipIds.has(slot.id)),
  };
}

function renderWidget<TContext>(
  id: string,
  context: TContext,
  widgets: Record<string, DashboardWidget<TContext>>,
): ReactNode {
  return widgets[id]?.render(context) ?? null;
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readDate(value: unknown) {
  return typeof value === "string" && value ? value : new Date().toISOString();
}

function collectContextTimeline(context: unknown): TimelineItem[] {
  const record = readRecord(context);
  if (!record) return [];

  const items: TimelineItem[] = [];
  const add = (item: Omit<TimelineItem, "id"> & { id?: string }) => {
    items.push({ id: item.id ?? `${item.title}-${item.at}-${items.length}`, ...item });
  };

  const home = readRecord(record.home);
  const critical = readRecord(record.critical);
  const summary = readRecord(record.summary);
  const deferred = readRecord(record.deferred);

  const latestAnnouncement = readRecord(home?.latestAnnouncement ?? critical?.latestAnnouncement ?? summary?.latestAnnouncement);
  if (latestAnnouncement) {
    add({
      at: readDate(latestAnnouncement.date),
      title: "Announcement published",
      detail: typeof latestAnnouncement.title === "string" ? latestAnnouncement.title : undefined,
    });
  }

  readArray(deferred?.recentRegistrations).forEach((member, index) => {
    const row = readRecord(member);
    add({
      id: `registration-${String(row?.id ?? index)}`,
      at: readDate(row?.created_at),
      title: "Member registered",
      detail: typeof row?.full_name === "string" ? row.full_name : "New member record",
      to: "/church-admin/members",
    });
  });

  readArray(record.recentContributions).forEach((contribution, index) => {
    const row = readRecord(contribution);
    add({
      id: `contribution-${String(row?.id ?? index)}`,
      at: readDate(row?.created_at ?? row?.date),
      title: "Contribution recorded",
      detail: typeof row?.donor_name === "string" ? row.donor_name : "Finance activity",
      to: "/finance/contributions",
    });
  });

  readArray(record.pendingChurches).forEach((church, index) => {
    const row = readRecord(church);
    add({
      id: `pending-church-${String(row?.id ?? index)}`,
      at: readDate(row?.created_at),
      title: "Church awaiting approval",
      detail: typeof row?.name === "string" ? row.name : "Pending church",
      to: "/super-admin/churches",
    });
  });

  readArray(record.recentAlerts).forEach((alert, index) => {
    const row = readRecord(alert);
    add({
      id: `alert-${String(row?.id ?? index)}`,
      at: readDate(row?.created_at),
      title: "Platform alert",
      detail: typeof row?.title === "string" ? row.title : "System alert",
      to: "/super-admin/system-health",
    });
  });

  readArray(record.recentAudits).forEach((audit, index) => {
    const row = readRecord(audit);
    add({
      id: `audit-${String(row?.id ?? index)}`,
      at: readDate(row?.created_at),
      title: "Audit activity",
      detail: typeof row?.action === "string" ? row.action.replace(/_/g, " ") : "Audit log entry",
      to: "/super-admin/audit-logs",
    });
  });

  return items;
}

function formatTimelineTime(value: string, language: string, labels: { now: string; yesterday: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return labels.now;

  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(language === "sw" ? "sw-TZ" : undefined, { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return labels.yesterday;

  return date.toLocaleDateString(language === "sw" ? "sw-TZ" : undefined, { month: "short", day: "numeric" });
}

export function DashboardPriorityCards({ events }: { events: AssistantEvent[] }) {
  const { t } = useTranslation();
  const priorityEvents = events
    .filter((event) => ["critical", "high", "medium"].includes(event.priority))
    .slice(0, 5);

  if (!priorityEvents.length) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">{t("member_portal.dashboard.no_priorities")}</p>
            <p className="text-sm text-muted-foreground">{t("member_portal.dashboard.no_priorities_description")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {priorityEvents.map((event) => {
        const card = (
          <div className="flex min-h-36 flex-col justify-between rounded-lg border border-border/70 bg-card/85 p-4 transition-colors hover:border-primary/35">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-primary" aria-hidden="true" />
                <Badge variant="outline" className={cn("capitalize", eventPriorityStyles[event.priority])}>
                  {event.priority}
                </Badge>
              </div>
              <h3 className="line-clamp-2 text-sm font-semibold">{event.title}</h3>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{event.detail}</p>
            </div>
            {event.to ? (
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                {event.actionLabel || t("member_portal.common.open")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        );

        return event.to ? (
          <AppLink key={event.id} to={event.to} aria-label={`${event.actionLabel || t("member_portal.common.open")} ${event.title}`}>
            {card}
          </AppLink>
        ) : (
          <div key={event.id}>{card}</div>
        );
      })}
    </div>
  );
}

export function DashboardActivityTimeline({ items }: { items: TimelineItem[] }) {
  const { t, i18n } = useTranslation();
  const visibleItems = items.slice(0, 8);

  return (
    <Card className="h-full border-border/70 bg-card/85">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-sans text-base">
          <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("member_portal.dashboard.timeline_title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visibleItems.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-background/50 p-4 text-sm text-muted-foreground">
            {t("member_portal.dashboard.timeline_empty")}
          </div>
        ) : (
          <ol className="space-y-3" aria-label={t("member_portal.dashboard.timeline_label")}>
            {visibleItems.map((item) => {
              const content = (
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:border-primary/30">
                  <time className="text-xs font-medium text-primary" dateTime={item.at}>
                    {formatTimelineTime(item.at, i18n.language, {
                      now: t("member_portal.dashboard.now"),
                      yesterday: t("member_portal.dashboard.yesterday"),
                    })}
                  </time>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize">{item.title}</p>
                    {item.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p> : null}
                  </div>
                </div>
              );

              return (
                <li key={item.id}>
                  {item.to ? (
                    <AppLink to={item.to} aria-label={`${t("member_portal.common.open")} ${item.title}`}>
                      {content}
                    </AppLink>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardQuickActions({
  suggestions,
  quickActions,
}: {
  suggestions: AssistantModel["suggestions"];
  quickActions: WorkspaceNavigationItem[];
}) {
  return (
    <div className="space-y-4">
      {suggestions.length ? <AssistantSuggestions suggestions={suggestions} /> : null}
      {quickActions.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <AppLink
                key={action.id}
                to={action.to}
                aria-label={action.label}
                className="flex min-h-20 items-center gap-3 rounded-lg border border-border/70 bg-card/85 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                {Icon ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                ) : null}
                <span className="font-semibold">{action.label}</span>
              </AppLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardExperience<TContext>({
  workspace,
  role,
  context,
  widgets,
  config,
  assistant,
  quickActions = [],
  className,
}: DashboardExperienceProps<TContext>) {
  const { t } = useTranslation();
  const snapshotSections = useMemo(
    () => config.sections.filter(isSnapshotSection).map(snapshotSection),
    [config.sections],
  );

  const timelineItems = useMemo(() => {
    const assistantItems = assistant.events.map((event) => ({
      id: `assistant-${event.id}`,
      at: event.createdAt,
      title: event.title,
      detail: event.detail,
      to: event.to,
    }));

    const automationItems = getAutomationHistory().map((entry) => ({
      id: `automation-${entry.id}`,
      at: entry.time,
      title: entry.action,
      detail: `${entry.ruleId} ${entry.status}`,
    }));

    return [...assistantItems, ...automationItems, ...collectContextTimeline(context)]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [assistant.events, context]);

  const focusItems = assistant.events.slice(0, 3);
  const quickActionWidget = renderWidget("quick-actions", context, widgets);

  return (
    <div className={cn("space-y-8", className)}>
      <section aria-label={t("member_portal.dashboard.assistant_greeting")}>
        <Card className="overflow-hidden border-primary/20 bg-card/90">
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)] lg:items-center">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-bold font-serif">{assistant.greeting.salutation}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{assistant.greeting.detail}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {workspace.title} {role ? `.${" "}${t("member_portal.dashboard.role")}: ${role.replace(/_/g, " ")}` : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("member_portal.dashboard.todays_focus")}
              </div>
              {focusItems.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {focusItems.map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="line-clamp-2">{item.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t("member_portal.dashboard.no_focus")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="dashboard-priorities-title">
        <div>
          <h2 id="dashboard-priorities-title" className="text-xl font-semibold">{t("member_portal.dashboard.priorities_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("member_portal.dashboard.priorities_description")}</p>
        </div>
        <DashboardPriorityCards events={assistant.events} />
      </section>

      <section className="space-y-3" aria-labelledby="dashboard-briefing-title">
        <div>
          <h2 id="dashboard-briefing-title" className="text-xl font-semibold">{t("member_portal.dashboard.briefing_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("member_portal.dashboard.briefing_description")}</p>
        </div>
        <AssistantBriefing items={assistant.briefing} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <section className="space-y-5" aria-labelledby="dashboard-snapshot-title">
          <div>
            <h2 id="dashboard-snapshot-title" className="text-xl font-semibold">{t("member_portal.dashboard.snapshot_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("member_portal.dashboard.snapshot_description")}</p>
          </div>
          <div className="space-y-6">
            {snapshotSections.map((section) => (
              <DashboardSectionRenderer
                key={section.id}
                context={context}
                section={section}
                widgets={widgets}
              />
            ))}
          </div>
        </section>

        <DashboardActivityTimeline items={timelineItems} />
      </div>

      <section className="space-y-3" aria-labelledby="dashboard-actions-title">
        <div>
          <h2 id="dashboard-actions-title" className="text-xl font-semibold">{t("member_portal.dashboard.quick_actions_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("member_portal.dashboard.quick_actions_description")}</p>
        </div>
        <div className="space-y-4">
          {quickActionWidget}
          <DashboardQuickActions suggestions={assistant.suggestions} quickActions={quickActions} />
        </div>
      </section>
    </div>
  );
}
