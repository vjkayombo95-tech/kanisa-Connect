import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Church,
  Clock,
  HandHeart,
  Heart,
  MapPin,
  Megaphone,
  Sparkles,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScriptureText } from "@/components/bible";
import { WorkflowStatusBadge } from "@/components/workflow";
import { normalizeAppLanguage } from "@/lib/localization";
import { cn } from "@/lib/utils";
import { categoryIconName, categoryLabel, categoryLabelKey, eventTypeLabel, eventTypeLabelKey, formatCalendarDate, formatCalendarTime } from "./calendarUtils";
import type { ParishCalendarEvent } from "./types";

type CalendarEventCardProps = {
  event: ParishCalendarEvent;
  compact?: boolean;
  className?: string;
};

export function CalendarEventCard({ event, compact, className }: CalendarEventCardProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const Icon = getCategoryIcon(event);
  const recurrenceDescription = typeof event.metadata?.recurrenceDescription === "string" ? event.metadata.recurrenceDescription : null;
  const audienceTargets = event.audienceTargets ?? [];
  const audienceLabel = event.audienceMode === "specific_groups" && audienceTargets.length
    ? audienceTargets.map((target) => target.name).join(", ")
    : event.audienceMode === "all_members"
      ? t("church_admin.events.audience.all_members")
      : null;
  const title = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: event.color ?? undefined }}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="truncate">{event.title}</span>
    </span>
  );

  return (
    <Card className={cn("border-border/70 bg-card/85 shadow-sm", compact && "rounded-xl", className)}>
      <CardContent className={cn("space-y-3", compact ? "p-3" : "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
              {event.href ? (
                <AppLink to={event.href} className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {title}
                </AppLink>
              ) : (
                title
              )}
            </h3>
            {event.description && !compact ? (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                <ScriptureText text={event.description} />
              </p>
            ) : null}
          </div>
          {event.workflow?.state ? (
            <WorkflowStatusBadge state={event.workflow.state} />
          ) : (
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Badge
                variant="outline"
                className="border-current"
                style={event.color ? { color: event.color } : undefined}
              >
                {t(categoryLabelKey(event.category), categoryLabel(event.category))}
              </Badge>
              {!compact ? (
                <Badge variant="secondary">
                  {t(eventTypeLabelKey(event.type), eventTypeLabel(event.type))}
                </Badge>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCalendarDate(event.startsAt, language)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {event.allDay ? t("member_portal.parish_life.all_day") : formatCalendarTime(event.startsAt, language)}
          </span>
          {event.location ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {event.location}
            </span>
          ) : null}
          {recurrenceDescription ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {recurrenceDescription}
            </span>
          ) : null}
          {event.workflow ? (
            <span className="flex items-center gap-1">
              <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
              {event.workflow.module}
            </span>
          ) : null}
          <Badge variant="outline" className="h-6 rounded-full text-[11px]">
            {t(`member_portal.parish_life.sources.${event.source}`, event.source.replace(/_/g, " "))}
          </Badge>
          <Badge variant="outline" className="h-6 rounded-full text-[11px]">
            {t(`workspace.${event.workspace}.title`, event.workspace.replace("_", " "))}
          </Badge>
          <Badge variant="outline" className="h-6 rounded-full text-[11px]">
            {t(`member_portal.parish_life.visibility.${event.visibility}`, event.visibility)}
          </Badge>
          {audienceLabel ? (
            <Badge variant="outline" className="h-6 rounded-full text-[11px]">
              {t("church_admin.events.audience.for")}: {audienceLabel}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getCategoryIcon(event: ParishCalendarEvent) {
  const iconName = categoryIconName(event.category);
  if (iconName === "church") return Church;
  if (iconName === "book-open") return BookOpen;
  if (iconName === "heart") return Heart;
  if (iconName === "users") return Users;
  if (iconName === "hand-heart") return HandHeart;
  if (iconName === "calendar-clock") return CalendarClock;
  if (iconName === "wallet") return Wallet;
  if (iconName === "megaphone") return Megaphone;
  if (iconName === "check-square") return CheckSquare;
  return Sparkles;
}
