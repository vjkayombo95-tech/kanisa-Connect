import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertCircle, BookOpen, CalendarDays, Check, Church, Clipboard, HandCoins, HeartHandshake, Mail, MapPin, Megaphone, Phone, Radio, RotateCw, Users } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchLivestream } from "@/hooks/use-church-livestream";
import { useChurchRadioStations } from "@/hooks/use-church-radio";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useLinkedMember } from "@/hooks/use-linked-member";
import { announcementHtmlToPlainText } from "@/lib/announcement-content";
import { getYouTubeEmbedUrl, presentation } from "@/lib/church-livestreams";
import { formatAppDate } from "@/lib/localization";
import { dailyLifeKeys, fetchLatestAnnouncement, fetchNextTimetableMass, fetchParishEvents, fetchParishIdentity, getParishDirectionsHref, getParishEmailHref, getParishPhoneHref, isUpcomingEvent } from "@/lib/member-daily-life";
import { fetchMemberMinistries, memberMinistriesQueryKey } from "@/lib/member-ministries";
import type { PortalFeatureKey } from "@/lib/portal-features";

function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="mb-3 flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-bold">{title}</h2>{action}</div>;
}

function EmptyCard({ children }: { children: ReactNode }) {
  return <Card className="rounded-[24px] border-border/70 bg-card/80"><CardContent className="p-4 text-sm text-muted-foreground">{children}</CardContent></Card>;
}

function ContactLink({ href, label, value, icon: Icon }: { href: string; label: string; value: string; icon: typeof Church }) {
  return <a href={href} aria-label={`${label}: ${value}`} className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 text-sm shadow-sm"><Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0"><span className="block font-bold">{label}</span><span className="block break-all text-muted-foreground">{value}</span></span></a>;
}

function SectionFeedback({
  title,
  description,
  retryLabel,
  retryingLabel,
  retryAriaLabel,
  tone = "empty",
  onRetry,
  isRetrying = false,
}: {
  title: string;
  description: string;
  retryLabel: string;
  retryingLabel: string;
  retryAriaLabel: string;
  tone?: "empty" | "error";
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  const error = tone === "error";

  return (
    <Card className={error ? "rounded-[24px] border-destructive/25 bg-destructive/5" : "rounded-[24px] border-border/70 bg-card/80"}>
      <CardContent className="flex min-w-0 flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3" role={error ? "alert" : undefined}>
          {error ? <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-destructive" aria-hidden="true" /> : null}
          <div className="min-w-0">
            <p className={error ? "font-semibold text-destructive" : "font-semibold text-foreground"}>{title}</p>
            <p className="mt-1 break-words text-muted-foreground">{description}</p>
          </div>
        </div>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRetrying}
            onClick={onRetry}
            aria-label={retryAriaLabel}
            className="min-h-10 w-full shrink-0 rounded-2xl sm:w-auto"
          >
            <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {isRetrying ? retryingLabel : retryLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LinkCard({ to, title, detail, icon: Icon }: { to?: string; title: string; detail: string; icon: typeof Church }) {
  const content = <><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block break-words font-bold">{title}</span><span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{detail}</span></span></>;
  const className = "flex min-h-24 items-center gap-4 rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm";
  return to ? <AppLink to={to} className={className}>{content}</AppLink> : <div className={className}>{content}</div>;
}

function Shortcut({ to, title, icon: Icon }: { to: string; title: string; icon: typeof Church }) {
  return <AppLink to={to} className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2.5 text-sm font-bold shadow-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="min-w-0 break-words">{title}</span></AppLink>;
}

const featureVisible = (
  getFeatureState: ReturnType<typeof useFeatureAccess>["getFeatureState"],
  featureKey: PortalFeatureKey,
) => getFeatureState(featureKey).visible;

export default function MemberMyParishPage() {
  const { t, i18n } = useTranslation();
  const { churchId } = useAuth();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const { getFeatureState } = useFeatureAccess();
  const parish = useQuery({ queryKey: dailyLifeKeys.parish(churchId), queryFn: () => fetchParishIdentity(churchId!), enabled: !!churchId, staleTime: 5 * 60_000 });
  const member = useLinkedMember();
  const mass = useQuery({ queryKey: dailyLifeKeys.nextTimetableMass(churchId), queryFn: () => fetchNextTimetableMass(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const announcement = useQuery({ queryKey: dailyLifeKeys.announcements(churchId), queryFn: () => fetchLatestAnnouncement(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const events = useQuery({ queryKey: dailyLifeKeys.events(churchId), queryFn: () => fetchParishEvents(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const ministries = useQuery({ queryKey: memberMinistriesQueryKey(churchId, member.data?.id), queryFn: () => fetchMemberMinistries(churchId!, member.data!.id), enabled: !!churchId && !!member.data?.id, staleTime: 60_000 });
  const radio = useChurchRadioStations();
  const livestream = useChurchLivestream();
  const upcoming = events.data?.filter((event) => isUpcomingEvent(event)).slice(0, 3) ?? [];
  const joined = ministries.data?.filter((ministry) => ministry.joined) ?? [];
  const phoneHref = getParishPhoneHref(parish.data?.phone);
  const emailHref = getParishEmailHref(parish.data?.email);
  const directionsHref = getParishDirectionsHref(parish.data);
  const memberName = member.data?.full_name?.trim() ?? "";
  const announcementsVisible = featureVisible(getFeatureState, "announcements");
  const eventsVisible = featureVisible(getFeatureState, "events");
  const ministriesVisible = featureVisible(getFeatureState, "ministries");
  const eventRequestsVisible = featureVisible(getFeatureState, "event_requests");
  const eligibleLivestream = !!(livestream.featureEnabled && !livestream.error && livestream.data && livestream.data.churchId === livestream.churchId && presentation(livestream.data) && getYouTubeEmbedUrl(livestream.data));
  const formatDateTime = (value: Date | string | number) => formatAppDate(value, i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const retryLabel = t("member_my_parish.actions.retry");
  const retryingLabel = t("member_my_parish.actions.retrying");
  const retryAriaLabel = (title: string) => t("member_my_parish.actions.retry_aria", { title });
  const feedback = (title: string, description: string, extras: Partial<Parameters<typeof SectionFeedback>[0]> = {}) => (
    <SectionFeedback
      title={title}
      description={description}
      retryLabel={retryLabel}
      retryingLabel={retryingLabel}
      retryAriaLabel={retryAriaLabel(title)}
      {...extras}
    />
  );

  const copyAddress = async () => {
    if (!parish.data?.address || !navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(parish.data.address);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return <main data-testid="member-my-parish-page" className="min-h-full overflow-x-hidden bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-10"><div className="mx-auto max-w-6xl space-y-5">
    {parish.isLoading ? <Skeleton className="h-36 rounded-[30px]" /> : parish.isError ? feedback(t("member_my_parish.errors.parish_title"), t("member_my_parish.errors.parish_description"), { tone: "error", onRetry: () => void parish.refetch(), isRetrying: parish.isFetching }) : parish.data ? <section className="flex min-w-0 flex-col gap-4 rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 sm:flex-row sm:items-center sm:p-6">
      {parish.data.logoUrl ? <img src={parish.data.logoUrl} alt={t("member_my_parish.hero.logo_alt", { church: parish.data.name })} className="h-16 w-16 shrink-0 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Church className="h-8 w-8" aria-hidden="true" /></span>}
      <div className="min-w-0"><p className="text-sm font-bold text-primary">{t("member_my_parish.hero.eyebrow")}</p><h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{parish.data.name}</h1>{memberName ? <p className="mt-1 break-words text-sm text-muted-foreground">{t("member_my_parish.hero.linked_as", { name: memberName })}</p> : null}</div>
    </section> : feedback(t("member_my_parish.empty.parish_title"), t("member_my_parish.empty.parish_description"))}

    {parish.data ? <section aria-label={t("member_my_parish.sections.contact_location")} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0"><SectionTitle title={t("member_my_parish.sections.contact")} />{(phoneHref || emailHref) ? <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {phoneHref && parish.data.phone ? <ContactLink href={phoneHref} label={t("member_my_parish.contact.call")} value={parish.data.phone} icon={Phone} /> : null}
        {emailHref && parish.data.email ? <ContactLink href={emailHref} label={t("member_my_parish.contact.email")} value={parish.data.email} icon={Mail} /> : null}
      </div> : <EmptyCard>{t("member_my_parish.contact.empty")}</EmptyCard>}</div>
      <div className="min-w-0"><SectionTitle title={t("member_my_parish.sections.location")} />{directionsHref ? <Card className="rounded-[24px] border-border/70 bg-card/80"><CardContent className="space-y-3 p-4 text-sm">{parish.data.address ? <p className="min-w-0 break-words text-muted-foreground">{parish.data.address}</p> : <p className="min-w-0 break-words text-muted-foreground">{t("member_my_parish.location.map_saved")}</p>}<div className="grid gap-2 sm:grid-cols-2">
        {parish.data.address ? <button type="button" onClick={() => void copyAddress()} className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-left font-semibold"><Clipboard className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 break-words">{t("member_my_parish.actions.copy_address")}</span></button> : null}
        <a href={directionsHref} target="_blank" rel="noopener noreferrer" aria-label={t("member_my_parish.location.directions_aria", { target: parish.data.address ?? parish.data.name })} className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 font-semibold"><MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 break-words">{t("member_my_parish.actions.directions")}</span></a>
      </div>{copyStatus !== "idle" ? <p role="status" className="flex items-center gap-1 text-xs text-muted-foreground">{copyStatus === "copied" ? <><Check className="h-3.5 w-3.5" aria-hidden="true" />{t("member_my_parish.location.address_copied")}</> : t("member_my_parish.location.address_copy_failed")}</p> : null}</CardContent></Card> : <EmptyCard>{t("member_my_parish.location.empty")}</EmptyCard>}</div>
    </section> : null}

    {eventRequestsVisible ? <section aria-label={t("member_my_parish.sections.office_services")}>
      <SectionTitle title={t("member_my_parish.sections.office_services")} action={<AppLink to="/portal/event-requests" className="text-sm font-bold text-primary">{t("member_my_parish.actions.my_requests")}</AppLink>} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Shortcut to="/portal/event-requests?service=wedding" title={t("event_request.wedding")} icon={HeartHandshake} />
        <Shortcut to="/portal/event-requests?service=baptism" title={t("event_request.baptism")} icon={Church} />
        <Shortcut to="/portal/event-requests?service=confirmation" title={t("event_request.confirmation")} icon={Check} />
        <Shortcut to="/portal/event-requests?service=first_communion" title={t("event_request.first_communion")} icon={Church} />
        <Shortcut to="/portal/event-requests?service=funeral" title={t("event_request.funeral")} icon={Church} />
        <Shortcut to="/portal/event-requests?service=requested_event" title={t("event_request.requested_event")} icon={CalendarDays} />
        <Shortcut to="/portal/event-requests?service=other" title={t("event_request.other")} icon={Clipboard} />
      </div>
    </section> : null}

    <section>
      <SectionTitle title={t("member_my_parish.sections.next_mass")} action={eventsVisible ? <AppLink to="/portal/calendar" className="text-sm font-bold text-primary">{t("member_my_parish.actions.schedule")}</AppLink> : undefined} />
      {mass.isLoading ? <Skeleton className="h-32 rounded-[24px]" /> : mass.isError ? feedback(t("member_my_parish.errors.mass_title"), t("member_my_parish.errors.mass_description"), { tone: "error", onRetry: () => void mass.refetch(), isRetrying: mass.isFetching }) : mass.data ? <LinkCard to={eventsVisible ? "/portal/calendar" : undefined} title={mass.data.title} detail={`${mass.data.description ? `${mass.data.description} - ` : ""}${formatDateTime(new Date(`${mass.data.massDate}T${mass.data.startTime}`))}`} icon={Church} /> : <EmptyCard>{t("member_my_parish.empty.next_mass")}</EmptyCard>}
    </section>

    <section>
      <SectionTitle title={t("member_my_parish.sections.latest_announcement")} action={announcementsVisible ? <AppLink to="/portal/announcements" className="text-sm font-bold text-primary">{t("member_my_parish.actions.all_announcements")}</AppLink> : undefined} />
      {announcement.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : announcement.isError ? feedback(t("member_my_parish.errors.announcement_title"), t("member_my_parish.errors.announcement_description"), { tone: "error", onRetry: () => void announcement.refetch(), isRetrying: announcement.isFetching }) : announcement.data ? <LinkCard to={announcementsVisible ? "/portal/announcements" : undefined} title={announcement.data.title} detail={announcementHtmlToPlainText(announcement.data.content) || t("member_my_parish.fallbacks.announcement")} icon={Megaphone} /> : <EmptyCard>{t("member_my_parish.empty.announcement")}</EmptyCard>}
    </section>

    <section>
      <SectionTitle title={t("member_my_parish.sections.upcoming_events")} action={eventsVisible ? <AppLink to="/portal/events" className="text-sm font-bold text-primary">{t("member_my_parish.actions.all_events")}</AppLink> : undefined} />
      {events.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : events.isError ? feedback(t("member_my_parish.errors.events_title"), t("member_my_parish.errors.events_description"), { tone: "error", onRetry: () => void events.refetch(), isRetrying: events.isFetching }) : upcoming.length ? <div className="grid gap-3 md:grid-cols-3">{upcoming.map((event) => <LinkCard key={event.id} to={eventsVisible ? "/portal/events" : undefined} title={event.title} detail={formatDateTime(event.startDate)} icon={CalendarDays} />)}</div> : <EmptyCard>{t("member_my_parish.empty.events")}</EmptyCard>}
    </section>

    {member.isLoading || ministries.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : <section><SectionTitle title={t("member_my_parish.sections.my_ministries")} action={ministriesVisible ? <AppLink to="/portal/ministries" className="text-sm font-bold text-primary">{t("member_my_parish.actions.all_ministries")}</AppLink> : undefined} />{member.isError ? feedback(t("member_my_parish.errors.member_title"), t("member_my_parish.errors.member_description"), { tone: "error", onRetry: () => void member.refetch(), isRetrying: member.isFetching }) : ministries.isError ? feedback(t("member_my_parish.errors.ministries_title"), t("member_my_parish.errors.ministries_description"), { tone: "error", onRetry: () => void ministries.refetch(), isRetrying: ministries.isFetching }) : joined.length ? <div className="grid gap-3 md:grid-cols-2">{joined.slice(0, 4).map((ministry) => <LinkCard key={ministry.id} to={ministriesVisible ? `/portal/ministries/${ministry.id}` : undefined} title={ministry.name} detail={ministry.description || t("member_my_parish.fallbacks.ministry_joined")} icon={Users} />)}</div> : <Card className="rounded-[24px] border-border/70 bg-card/80"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground"><span>{t("member_my_parish.empty.ministries")}</span>{ministriesVisible ? <AppLink to="/portal/ministries" className="font-bold text-primary">{t("member_my_parish.actions.view_services")}</AppLink> : null}</CardContent></Card>}</section>}

    <section aria-label={t("member_my_parish.sections.quick_links")}><SectionTitle title={t("member_my_parish.sections.quick_links")} /><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {eligibleLivestream && livestream.data ? <Shortcut to={`/portal/live/${livestream.data.id}`} title={t("member_services.livestream.label")} icon={Church} /> : null}
      {radio.featureEnabled && !radio.isError && radio.data.length ? <Shortcut to="/portal/radio" title={t("member_services.radio.label")} icon={Radio} /> : null}
      {featureVisible(getFeatureState, "give") ? <Shortcut to="/portal/give" title={t("member_services.give.label")} icon={HandCoins} /> : null}
      {featureVisible(getFeatureState, "mass_intentions") ? <Shortcut to="/portal/mass-intentions" title={t("member_services.mass_intentions.label")} icon={HeartHandshake} /> : null}
      {featureVisible(getFeatureState, "prayer_requests") ? <Shortcut to="/portal/prayer-requests" title={t("member_services.prayer_requests.label")} icon={HeartHandshake} /> : null}
      {featureVisible(getFeatureState, "sermons") ? <Shortcut to="/portal/sermons" title={t("member_services.sermons.label")} icon={Church} /> : null}
      {featureVisible(getFeatureState, "events") ? <Shortcut to="/portal/calendar" title={t("member_services.calendar.label")} icon={CalendarDays} /> : null}
      <Shortcut to="/portal/library" title={t("member_services.library.label")} icon={BookOpen} />
    </div></section>

    {(parish.isError || member.isError || mass.isError || announcement.isError || events.isError || ministries.isError) ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">{t("member_my_parish.errors.partial")}</p> : null}
  </div></main>;
}
