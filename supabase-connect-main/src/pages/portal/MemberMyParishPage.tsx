import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { getYouTubeEmbedUrl, presentation } from "@/lib/church-livestreams";
import { dailyLifeKeys, fetchLatestAnnouncement, fetchNextMassSummary, fetchParishEvents, fetchParishIdentity, getParishEmailHref, getParishMapHref, getParishPhoneHref, isUpcomingEvent } from "@/lib/member-daily-life";
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
  tone = "empty",
  onRetry,
  isRetrying = false,
}: {
  title: string;
  description: string;
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
            aria-label={`Jaribu tena: ${title}`}
            className="min-h-10 w-full shrink-0 rounded-2xl sm:w-auto"
          >
            <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
            {isRetrying ? "Inapakia..." : "Jaribu tena"}
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
  const { churchId } = useAuth();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const { getFeatureState } = useFeatureAccess();
  const parish = useQuery({ queryKey: dailyLifeKeys.parish(churchId), queryFn: () => fetchParishIdentity(churchId!), enabled: !!churchId, staleTime: 5 * 60_000 });
  const member = useLinkedMember();
  const mass = useQuery({ queryKey: dailyLifeKeys.nextMass(churchId), queryFn: () => fetchNextMassSummary(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const announcement = useQuery({ queryKey: dailyLifeKeys.announcements(churchId), queryFn: () => fetchLatestAnnouncement(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const events = useQuery({ queryKey: dailyLifeKeys.events(churchId), queryFn: () => fetchParishEvents(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const ministries = useQuery({ queryKey: memberMinistriesQueryKey(churchId, member.data?.id), queryFn: () => fetchMemberMinistries(churchId!, member.data!.id), enabled: !!churchId && !!member.data?.id, staleTime: 60_000 });
  const radio = useChurchRadioStations();
  const livestream = useChurchLivestream();
  const upcoming = events.data?.filter((event) => isUpcomingEvent(event)).slice(0, 3) ?? [];
  const joined = ministries.data?.filter((ministry) => ministry.joined) ?? [];
  const phoneHref = getParishPhoneHref(parish.data?.phone);
  const emailHref = getParishEmailHref(parish.data?.email);
  const mapHref = getParishMapHref(parish.data?.address);
  const memberName = member.data?.full_name?.trim() ?? "";
  const announcementsVisible = featureVisible(getFeatureState, "announcements");
  const eventsVisible = featureVisible(getFeatureState, "events");
  const ministriesVisible = featureVisible(getFeatureState, "ministries");
  const eligibleLivestream = !!(livestream.featureEnabled && !livestream.error && livestream.data && livestream.data.churchId === livestream.churchId && presentation(livestream.data) && getYouTubeEmbedUrl(livestream.data));

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
    {parish.isLoading ? <Skeleton className="h-36 rounded-[30px]" /> : parish.isError ? <SectionFeedback title="Hatukuweza kupakia taarifa za parokia kwa sasa." description="Taarifa nyingine bado zinaweza kupatikana. Tafadhali jaribu tena." tone="error" onRetry={() => void parish.refetch()} isRetrying={parish.isFetching} /> : parish.data ? <section className="flex min-w-0 flex-col gap-4 rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 sm:flex-row sm:items-center sm:p-6">
      {parish.data.logoUrl ? <img src={parish.data.logoUrl} alt={`Nembo ya ${parish.data.name}`} className="h-16 w-16 shrink-0 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Church className="h-8 w-8" aria-hidden="true" /></span>}
      <div className="min-w-0"><p className="text-sm font-bold text-primary">Parokia Yangu</p><h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{parish.data.name}</h1>{memberName ? <p className="mt-1 break-words text-sm text-muted-foreground">Umeunganishwa kama {memberName}</p> : null}</div>
    </section> : <SectionFeedback title="Taarifa za parokia bado hazijachapishwa." description="Utaziona hapa mara tu zitakapowekwa kwa waumini." />}

    {parish.data ? <section aria-label="Mawasiliano na mahali pa parokia" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0"><SectionTitle title="Mawasiliano" />{(phoneHref || emailHref) ? <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {phoneHref && parish.data.phone ? <ContactLink href={phoneHref} label="Piga simu" value={parish.data.phone} icon={Phone} /> : null}
        {emailHref && parish.data.email ? <ContactLink href={emailHref} label="Tuma barua pepe" value={parish.data.email} icon={Mail} /> : null}
      </div> : <EmptyCard>Mawasiliano ya parokia bado hayajachapishwa.</EmptyCard>}</div>
      <div className="min-w-0"><SectionTitle title="Mahali pa parokia" />{mapHref && parish.data.address ? <Card className="rounded-[24px] border-border/70 bg-card/80"><CardContent className="space-y-3 p-4 text-sm"><p className="min-w-0 break-words text-muted-foreground">{parish.data.address}</p><div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => void copyAddress()} className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-left font-semibold"><Clipboard className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 break-words">Nakili anwani</span></button>
        <a href={mapHref} target="_blank" rel="noopener noreferrer" aria-label={`Fungua ramani: ${parish.data.address}`} className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 font-semibold"><MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 break-words">Fungua ramani</span></a>
      </div>{copyStatus !== "idle" ? <p role="status" className="flex items-center gap-1 text-xs text-muted-foreground">{copyStatus === "copied" ? <><Check className="h-3.5 w-3.5" aria-hidden="true" />Anwani imenakiliwa.</> : "Anwani haikuweza kunakiliwa."}</p> : null}</CardContent></Card> : <EmptyCard>Mahali pa parokia bado hapajawekwa.</EmptyCard>}</div>
    </section> : null}

    <section>
      <SectionTitle title="Misa ijayo" action={eventsVisible ? <AppLink to="/portal/calendar" className="text-sm font-bold text-primary">Ratiba</AppLink> : undefined} />
      {mass.isLoading ? <Skeleton className="h-32 rounded-[24px]" /> : mass.isError ? <SectionFeedback title="Hatukuweza kupakia Misa ijayo kwa sasa." description="Ratiba ya Misa haijapotea. Tafadhali jaribu tena baada ya muda mfupi." tone="error" onRetry={() => void mass.refetch()} isRetrying={mass.isFetching} /> : mass.data?.mass ? <LinkCard to={eventsVisible ? "/portal/calendar" : undefined} title={mass.data.mass.title} detail={`${mass.data.mass.description ? `${mass.data.mass.description} - ` : ""}${new Date(`${mass.data.mass.massDate}T${mass.data.mass.startTime}`).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })}`} icon={Church} /> : <EmptyCard>Hakuna Misa ijayo iliyopangwa kwa sasa.</EmptyCard>}
    </section>

    <section>
      <SectionTitle title="Tangazo la karibuni" action={announcementsVisible ? <AppLink to="/portal/announcements" className="text-sm font-bold text-primary">Matangazo yote</AppLink> : undefined} />
      {announcement.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : announcement.isError ? <SectionFeedback title="Hatukuweza kupakia tangazo la karibuni kwa sasa." description="Matangazo mengine yanaweza kuendelea kupatikana kwenye ukurasa wake." tone="error" onRetry={() => void announcement.refetch()} isRetrying={announcement.isFetching} /> : announcement.data ? <LinkCard to={announcementsVisible ? "/portal/announcements" : undefined} title={announcement.data.title} detail={announcement.data.content || "Tangazo la karibuni"} icon={Megaphone} /> : <EmptyCard>Hakuna tangazo jipya kwa sasa.</EmptyCard>}
    </section>

    <section>
      <SectionTitle title="Matukio yajayo" action={eventsVisible ? <AppLink to="/portal/events" className="text-sm font-bold text-primary">Matukio yote</AppLink> : undefined} />
      {events.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : events.isError ? <SectionFeedback title="Hatukuweza kupakia matukio yajayo kwa sasa." description="Tafadhali jaribu tena ili kuona matukio mapya ya parokia." tone="error" onRetry={() => void events.refetch()} isRetrying={events.isFetching} /> : upcoming.length ? <div className="grid gap-3 md:grid-cols-3">{upcoming.map((event) => <LinkCard key={event.id} to={eventsVisible ? "/portal/events" : undefined} title={event.title} detail={new Date(event.startDate).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })} icon={CalendarDays} />)}</div> : <EmptyCard>Hakuna tukio lijalo lililochapishwa kwa sasa.</EmptyCard>}
    </section>

    {member.isLoading || ministries.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : <section><SectionTitle title="Huduma zangu" action={ministriesVisible ? <AppLink to="/portal/ministries" className="text-sm font-bold text-primary">Huduma zote</AppLink> : undefined} />{member.isError ? <SectionFeedback title="Hatukuweza kuthibitisha taarifa zako za mshiriki kwa sasa." description="Tafadhali jaribu tena ili tuangalie huduma zako za parokia." tone="error" onRetry={() => void member.refetch()} isRetrying={member.isFetching} /> : ministries.isError ? <SectionFeedback title="Hatukuweza kupakia huduma zako kwa sasa." description="Tafadhali jaribu tena ili kuona huduma ulizojiunga nazo." tone="error" onRetry={() => void ministries.refetch()} isRetrying={ministries.isFetching} /> : joined.length ? <div className="grid gap-3 md:grid-cols-2">{joined.slice(0, 4).map((ministry) => <LinkCard key={ministry.id} to={ministriesVisible ? `/portal/ministries/${ministry.id}` : undefined} title={ministry.name} detail={ministry.description || "Umejiunga"} icon={Users} />)}</div> : <Card className="rounded-[24px] border-border/70 bg-card/80"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground"><span>Bado hujajiunga na huduma ya parokia.</span>{ministriesVisible ? <AppLink to="/portal/ministries" className="font-bold text-primary">Angalia huduma</AppLink> : null}</CardContent></Card>}</section>}

    <section aria-label="Njia za haraka"><SectionTitle title="Njia za haraka" /><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {eligibleLivestream && livestream.data ? <Shortcut to={`/portal/live/${livestream.data.id}`} title="Misa Mubashara" icon={Church} /> : null}
      {radio.featureEnabled && !radio.isError && radio.data.length ? <Shortcut to="/portal/radio" title="Radio" icon={Radio} /> : null}
      {featureVisible(getFeatureState, "give") ? <Shortcut to="/portal/give" title="Michango" icon={HandCoins} /> : null}
      {featureVisible(getFeatureState, "mass_intentions") ? <Shortcut to="/portal/mass-intentions" title="Nia za Misa" icon={HeartHandshake} /> : null}
      {featureVisible(getFeatureState, "prayer_requests") ? <Shortcut to="/portal/prayer-requests" title="Maombi" icon={HeartHandshake} /> : null}
      {featureVisible(getFeatureState, "sermons") ? <Shortcut to="/portal/sermons" title="Mahubiri" icon={Church} /> : null}
      {featureVisible(getFeatureState, "events") ? <Shortcut to="/portal/calendar" title="Ratiba" icon={CalendarDays} /> : null}
      <Shortcut to="/portal/library" title="Maktaba" icon={BookOpen} />
    </div></section>

    {(parish.isError || member.isError || mass.isError || announcement.isError || events.isError || ministries.isError) ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">Baadhi ya taarifa za parokia hazikupatikana. Njia nyingine bado zinaweza kutumika.</p> : null}
  </div></main>;
}
