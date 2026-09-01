import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Check, Church, Clipboard, HandCoins, HeartHandshake, Mail, MapPin, Megaphone, Phone, Radio, Users } from "lucide-react";

import { AppLink } from "@/components/AppLink";
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
    {parish.isLoading ? <Skeleton className="h-36 rounded-[30px]" /> : parish.data ? <section className="flex min-w-0 items-center gap-4 rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 sm:p-6">
      {parish.data.logoUrl ? <img src={parish.data.logoUrl} alt={`${parish.data.name} logo`} className="h-16 w-16 shrink-0 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Church className="h-8 w-8" /></span>}
      <div className="min-w-0"><p className="text-sm font-bold text-primary">Parokia Yangu</p><h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{parish.data.name}</h1>{member.data ? <p className="mt-1 break-words text-sm text-muted-foreground">{member.data.full_name}</p> : null}</div>
    </section> : <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Taarifa za parokia hazikupatikana.</p>}

    <section>
      <SectionTitle title="Misa ijayo" action={eventsVisible ? <AppLink to="/portal/calendar" className="text-sm font-bold text-primary">Kalenda</AppLink> : undefined} />
      {mass.isLoading ? <Skeleton className="h-32 rounded-[24px]" /> : mass.data?.mass ? <LinkCard to={eventsVisible ? "/portal/calendar" : undefined} title={mass.data.mass.title} detail={`${mass.data.mass.description ? `${mass.data.mass.description} - ` : ""}${new Date(`${mass.data.mass.massDate}T${mass.data.mass.startTime}`).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })}`} icon={Church} /> : <EmptyCard>Hakuna Misa ijayo iliyopangwa kwa sasa.</EmptyCard>}
    </section>

    <section>
      <SectionTitle title="Tangazo la karibuni" action={announcementsVisible ? <AppLink to="/portal/announcements" className="text-sm font-bold text-primary">Matangazo yote</AppLink> : undefined} />
      {announcement.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : announcement.data ? <LinkCard to={announcementsVisible ? "/portal/announcements" : undefined} title={announcement.data.title} detail={announcement.data.content || "Tangazo la karibuni"} icon={Megaphone} /> : <EmptyCard>Hakuna tangazo jipya kwa sasa.</EmptyCard>}
    </section>

    <section>
      <SectionTitle title="Matukio yajayo" action={eventsVisible ? <AppLink to="/portal/events" className="text-sm font-bold text-primary">Matukio yote</AppLink> : undefined} />
      {events.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : upcoming.length ? <div className="grid gap-3 md:grid-cols-3">{upcoming.map((event) => <LinkCard key={event.id} to={eventsVisible ? "/portal/events" : undefined} title={event.title} detail={new Date(event.startDate).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })} icon={CalendarDays} />)}</div> : <EmptyCard>Hakuna tukio lijalo lililochapishwa kwa sasa.</EmptyCard>}
    </section>

    {ministries.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : !ministries.isError ? <section><SectionTitle title="Huduma zangu" action={ministriesVisible ? <AppLink to="/portal/ministries" className="text-sm font-bold text-primary">Huduma zote</AppLink> : undefined} />{joined.length ? <div className="grid gap-3 md:grid-cols-2">{joined.slice(0, 4).map((ministry) => <LinkCard key={ministry.id} to={ministriesVisible ? `/portal/ministries/${ministry.id}` : undefined} title={ministry.name} detail={ministry.description || "Umejiunga"} icon={Users} />)}</div> : <Card className="rounded-[24px] border-border/70 bg-card/80"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground"><span>Bado hujajiunga na huduma ya parokia.</span>{ministriesVisible ? <AppLink to="/portal/ministries" className="font-bold text-primary">Angalia huduma</AppLink> : null}</CardContent></Card>}</section> : null}

    <section aria-label="Njia za haraka"><SectionTitle title="Njia za haraka" /><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {eligibleLivestream && livestream.data ? <Shortcut to={`/portal/live/${livestream.data.id}`} title="Misa Mubashara" icon={Church} /> : null}
      {radio.featureEnabled && !radio.isError && radio.data.length ? <Shortcut to="/portal/radio" title="Radio" icon={Radio} /> : null}
      {featureVisible(getFeatureState, "give") ? <Shortcut to="/portal/give" title="Michango" icon={HandCoins} /> : null}
      {featureVisible(getFeatureState, "mass_intentions") ? <Shortcut to="/portal/mass-intentions" title="Nia za Misa" icon={HeartHandshake} /> : null}
      {featureVisible(getFeatureState, "prayer_requests") ? <Shortcut to="/portal/prayer-requests" title="Maombi" icon={HeartHandshake} /> : null}
      {featureVisible(getFeatureState, "sermons") ? <Shortcut to="/portal/sermons" title="Mahubiri" icon={Church} /> : null}
      {featureVisible(getFeatureState, "events") ? <Shortcut to="/portal/calendar" title="Kalenda" icon={CalendarDays} /> : null}
      <Shortcut to="/portal/library" title="Maktaba" icon={BookOpen} />
    </div></section>

    {(phoneHref || emailHref || mapHref) ? <section aria-label="Mawasiliano ya parokia"><SectionTitle title="Mawasiliano ya parokia" /><div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {phoneHref ? <a href={phoneHref} className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 text-sm"><Phone className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-all">{parish.data?.phone}</span></a> : null}
      {emailHref ? <a href={emailHref} className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 text-sm"><Mail className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-all">{parish.data?.email}</span></a> : null}
      {mapHref ? <button type="button" onClick={() => void copyAddress()} className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 text-left text-sm"><Clipboard className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-words">Nakili anwani</span></button> : null}
      {mapHref ? <a href={mapHref} target="_blank" rel="noopener noreferrer" className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 text-sm"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-words">Fungua ramani</span></a> : null}
      {mapHref ? <p className="min-w-0 break-words text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{parish.data?.address}</p> : null}
      {copyStatus !== "idle" ? <p role="status" className="flex items-center gap-1 text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{copyStatus === "copied" ? <><Check className="h-3.5 w-3.5" />Anwani imenakiliwa.</> : "Anwani haikuweza kunakiliwa."}</p> : null}
    </div></section> : null}

    {(parish.isError || member.isError || mass.isError || announcement.isError || events.isError || ministries.isError) ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">Baadhi ya taarifa za parokia hazikupatikana. Njia nyingine bado zinaweza kutumika.</p> : null}
  </div></main>;
}
