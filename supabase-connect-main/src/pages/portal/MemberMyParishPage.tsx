import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Church, HandCoins, HeartHandshake, Megaphone, Radio, Users } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { ProductionLiveMassCard } from "@/components/portal/ProductionLiveMassCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchRadioStations } from "@/hooks/use-church-radio";
import { useLinkedMember } from "@/hooks/use-linked-member";
import { fetchMemberMinistries, memberMinistriesQueryKey } from "@/lib/member-ministries";
import { dailyLifeKeys, fetchLatestAnnouncement, fetchNextMassSummary, fetchParishEvents, fetchParishIdentity, isUpcomingEvent } from "@/lib/member-daily-life";

function LinkCard({ to, title, detail, icon: Icon }: { to: string; title: string; detail: string; icon: typeof Church }) { return <AppLink to={to} className="flex min-h-24 items-center gap-4 rounded-[24px] border border-border/70 bg-card/85 p-4 shadow-sm"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block break-words font-bold">{title}</span><span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{detail}</span></span></AppLink>; }

export default function MemberMyParishPage() {
  const { churchId } = useAuth();
  const parish = useQuery({ queryKey: dailyLifeKeys.parish(churchId), queryFn: () => fetchParishIdentity(churchId!), enabled: !!churchId, staleTime: 5 * 60_000 });
  const member = useLinkedMember();
  const mass = useQuery({ queryKey: dailyLifeKeys.nextMass(churchId), queryFn: () => fetchNextMassSummary(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const announcement = useQuery({ queryKey: dailyLifeKeys.announcements(churchId), queryFn: () => fetchLatestAnnouncement(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const events = useQuery({ queryKey: dailyLifeKeys.events(churchId), queryFn: () => fetchParishEvents(churchId!), enabled: !!churchId, staleTime: 60_000 });
  const ministries = useQuery({ queryKey: memberMinistriesQueryKey(churchId, member.data?.id), queryFn: () => fetchMemberMinistries(churchId!, member.data!.id), enabled: !!churchId && !!member.data?.id, staleTime: 60_000 });
  const radio = useChurchRadioStations();
  const upcoming = events.data?.filter((event) => isUpcomingEvent(event)).slice(0, 3) ?? [];
  const joined = ministries.data?.filter((ministry) => ministry.joined) ?? [];

  return <main data-testid="member-my-parish-page" className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-5 pb-28 lg:px-8 lg:pb-10"><div className="mx-auto max-w-6xl space-y-5">
    {parish.isLoading ? <Skeleton className="h-36 rounded-[30px]" /> : parish.data ? <section className="flex min-w-0 items-center gap-4 rounded-[30px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_65%)] p-5 sm:p-7">{parish.data.logoUrl ? <img src={parish.data.logoUrl} alt={`${parish.data.name} logo`} className="h-16 w-16 shrink-0 rounded-2xl object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Church className="h-8 w-8" /></span>}<div className="min-w-0"><p className="text-sm font-bold text-primary">Parokia Yangu</p><h1 className="mt-1 break-words text-3xl font-bold">{parish.data.name}</h1>{member.data ? <p className="mt-1 break-words text-sm text-muted-foreground">{member.data.full_name}</p> : null}</div></section> : <p className="rounded-2xl border p-4 text-sm text-muted-foreground">Taarifa za parokia hazikupatikana.</p>}
    <div className="grid gap-4 md:grid-cols-2">{mass.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : mass.data?.mass ? <LinkCard to="/portal/calendar" title={mass.data.mass.title} detail={new Date(`${mass.data.mass.massDate}T${mass.data.mass.startTime}`).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })} icon={Church} /> : null}{announcement.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : announcement.data ? <LinkCard to="/portal/announcements" title={announcement.data.title} detail={announcement.data.content || "Tangazo la karibuni"} icon={Megaphone} /> : null}</div>
    {upcoming.length ? <section><h2 className="mb-3 text-xl font-bold">Matukio yajayo</h2><div className="grid gap-3 md:grid-cols-3">{upcoming.map((event) => <LinkCard key={event.id} to="/portal/events" title={event.title} detail={new Date(event.startDate).toLocaleString("sw-TZ", { dateStyle: "medium", timeStyle: "short" })} icon={CalendarDays} />)}</div></section> : null}
    {ministries.isLoading ? <Skeleton className="h-28 rounded-[24px]" /> : ministries.data?.length ? <section><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Huduma za parokia</h2><AppLink to="/portal/ministries" className="text-sm font-bold text-primary">Zote</AppLink></div><div className="grid gap-3 md:grid-cols-2">{(joined.length ? joined : ministries.data.slice(0, 2)).map((ministry) => <LinkCard key={ministry.id} to={`/portal/ministries/${ministry.id}`} title={ministry.name} detail={ministry.joined ? "Umejiunga" : ministry.requestPending ? "Ombi linasubiri" : "Huduma inayopatikana"} icon={Users} />)}</div></section> : null}
    <section><h2 className="mb-3 text-xl font-bold">Media</h2><div className="grid gap-3 md:grid-cols-2"><ProductionLiveMassCard />{radio.featureEnabled && !radio.isError && radio.data.length ? <LinkCard to="/portal/radio" title="Radio" detail={radio.data[0].name} icon={Radio} /> : null}</div></section>
    {(parish.isError || member.isError || mass.isError || announcement.isError || events.isError || ministries.isError) ? <p className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">Baadhi ya taarifa za parokia hazikupatikana. Njia nyingine bado zinaweza kutumika.</p> : null}
    <section className="grid gap-3 sm:grid-cols-3"><LinkCard to="/portal/give" title="Michango" detail="Toa au angalia michango" icon={HandCoins} /><LinkCard to="/portal/mass-intentions" title="Nia za Misa" detail="Wasilisha nia ya Misa" icon={HeartHandshake} /><LinkCard to="/portal/prayer-requests" title="Maombi" detail="Tuma ombi la maombi" icon={HeartHandshake} /></section>
    <section className="grid gap-3 sm:grid-cols-3"><LinkCard to="/portal/sermons" title="Mahubiri" detail="Mahubiri ya parokia" icon={Church} /><LinkCard to="/portal/calendar" title="Kalenda" detail="Misa na matukio" icon={CalendarDays} /><LinkCard to="/portal/library" title="Maktaba" detail="Watakatifu na imani" icon={BookOpen} /></section>
  </div></main>;
}
