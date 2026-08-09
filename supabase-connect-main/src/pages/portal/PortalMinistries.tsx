import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Megaphone,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { emptyParishCalendarFilters, formatCalendarDate, formatCalendarTime } from "@/components/calendar/calendarUtils";
import { WorkflowStatusBadge } from "@/components/workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMember } from "@/hooks/useMember";
import { useParishCalendarEvents } from "@/hooks/useParishCalendar";
import {
  fetchMinistrySummaries,
  getMinistriesQueryKey,
  getMinistryMembershipsQueryKey,
  getMyMinistriesQueryKey,
  leaveMinistry,
  requestToJoinMinistry,
  type MinistrySummary,
} from "@/lib/ministries";
import { normalizeAppLanguage } from "@/lib/localization";

function MinistryCard({
  ministry,
  isPending,
  onJoin,
  onLeave,
}: {
  ministry: MinistrySummary;
  isPending: boolean;
  onJoin: (ministryId: string) => void;
  onLeave: (ministryId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="line-clamp-2 text-lg">{ministry.name ?? t("member_portal.parish_life.ministry")}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full">
                <Users className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {t("member_portal.parish_life.members_count", { count: ministry.memberCount })}
              </Badge>
              {ministry.isMember ? (
                <WorkflowStatusBadge state="approved" label={t("member_portal.parish_life.joined")} />
              ) : ministry.requestStatus === "pending" ? (
                <WorkflowStatusBadge state="pending" label={t("member_portal.parish_life.requested")} />
              ) : (
                <WorkflowStatusBadge state="submitted" label={t("member_portal.parish_life.open")} />
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="line-clamp-3 min-h-16 text-sm leading-6 text-muted-foreground">
          {ministry.description || t("member_portal.parish_life.ministry_description_fallback")}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <AppLink to={`/portal/ministries/${ministry.id}`}>{t("member_portal.parish_life.view_details")}</AppLink>
          </Button>
          {ministry.isMember ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl"
              disabled={isPending}
              onClick={() => onLeave(ministry.id)}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("member_portal.parish_life.leave_ministry")}
            </Button>
          ) : (
            <Button type="button" className="h-10 rounded-xl" disabled={isPending || ministry.requestStatus === "pending"} onClick={() => onJoin(ministry.id)}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />}
              {ministry.requestStatus === "pending" ? t("member_portal.parish_life.request_sent") : t("member_portal.parish_life.request_to_join")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MinistryPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 rounded-[28px]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-56 rounded-[28px]" />
        <Skeleton className="h-56 rounded-[28px]" />
        <Skeleton className="h-56 rounded-[28px]" />
      </div>
    </div>
  );
}

export default function PortalMinistries() {
  const { i18n, t } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";
  const { ministryId } = useParams();
  const [search, setSearch] = useState("");
  const { churchId } = useAuth();
  const { data: member } = useMember("id, full_name, church_id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const memberId = member?.id ?? null;

  const {
    data: ministries = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: getMyMinistriesQueryKey(memberId, churchId),
    queryFn: () => fetchMinistrySummaries({ churchId, memberId }),
    enabled: !!churchId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { events } = useParishCalendarEvents({
    churchId,
    filters: emptyParishCalendarFilters,
    workspace: "member",
    enabled: !!churchId,
  });

  const invalidateMinistryQueries = () => {
    queryClient.invalidateQueries({ queryKey: getMyMinistriesQueryKey(memberId, churchId) });
    queryClient.invalidateQueries({ queryKey: getMinistriesQueryKey(churchId) });
    queryClient.invalidateQueries({ queryKey: getMinistryMembershipsQueryKey(churchId) });
  };

  const join = useMutation({
    mutationFn: async (nextMinistryId: string) => {
      if (!memberId) throw new Error(t("member_portal.parish_life.member_record_unavailable"));
      if (!churchId) throw new Error(t("member_portal.parish_life.church_context_unavailable"));
      await requestToJoinMinistry({ churchId, memberId, ministryId: nextMinistryId });
    },
    onSuccess: () => {
      invalidateMinistryQueries();
      toast({ title: t("member_portal.parish_life.request_sent"), description: t("member_portal.parish_life.request_sent_description") });
    },
    onError: (mutationError: Error) => {
      toast({ title: t("member_portal.parish_life.unable_request_ministry"), description: mutationError.message, variant: "destructive" });
    },
  });

  const leave = useMutation({
    mutationFn: async (nextMinistryId: string) => {
      if (!memberId) throw new Error(t("member_portal.parish_life.member_record_unavailable"));
      await leaveMinistry({ memberId, ministryId: nextMinistryId });
    },
    onSuccess: () => {
      invalidateMinistryQueries();
      toast({ title: t("member_portal.parish_life.ministry_left"), description: t("member_portal.parish_life.ministry_left_description") });
    },
    onError: (mutationError: Error) => {
      toast({ title: t("member_portal.parish_life.unable_leave_ministry"), description: mutationError.message, variant: "destructive" });
    },
  });

  const selectedMinistry = ministries.find((ministry) => ministry.id === ministryId) ?? null;
  const myMinistries = ministries.filter((ministry) => ministry.isMember);
  const filteredMinistries = ministries.filter((ministry) => {
    const value = search.trim().toLowerCase();
    if (!value) return true;
    return [ministry.name, ministry.description].filter(Boolean).join(" ").toLowerCase().includes(value);
  });

  const upcomingMinistryEvents = useMemo(() => {
    const now = Date.now();
    const ministryNames = new Set(myMinistries.map((ministry) => ministry.name).filter(Boolean));

    return events
      .filter((event) => event.ministry && ministryNames.has(event.ministry))
      .filter((event) => new Date(event.startsAt).getTime() >= now)
      .slice(0, 5);
  }, [events, myMinistries]);

  const volunteerOpportunities = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => event.ministry)
      .filter((event) => new Date(event.startsAt).getTime() >= now)
      .slice(0, 6);
  }, [events]);

  const pendingMutationId = String(join.variables ?? leave.variables ?? "");
  const mutationPending = join.isPending || leave.isPending;

  return (
    <main className="min-h-full bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-[28px] border-primary/20 bg-card/90 shadow-sm">
          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  {t("member_portal.parish_life.parish_ministries")}
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("member_portal.parish_life.serve_with_parish")}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("member_portal.parish_life.ministries_description")}
                </p>
              </div>
              <div className="relative lg:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label={t("member_portal.parish_life.search_ministries")}
                  className="h-12 rounded-2xl pl-11"
                  placeholder={t("member_portal.parish_life.search_ministries")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? <MinistryPageSkeleton /> : null}

        {isError ? (
          <Card className="rounded-[28px] border-destructive/20 bg-destructive/5">
            <CardContent className="p-5 text-sm text-destructive">
              {error instanceof Error ? error.message : t("member_portal.parish_life.ministries_load_error")}
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !isError && selectedMinistry ? (
          <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">{t("member_portal.parish_life.ministry_details")}</p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">{selectedMinistry.name}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {selectedMinistry.description || t("member_portal.parish_life.no_description")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline">{t("member_portal.parish_life.members_count", { count: selectedMinistry.memberCount })}</Badge>
                    {selectedMinistry.isMember ? (
                      <WorkflowStatusBadge state="approved" label={t("member_portal.parish_life.member")} />
                    ) : selectedMinistry.requestStatus === "pending" ? (
                      <WorkflowStatusBadge state="pending" label={t("member_portal.parish_life.request_pending")} />
                    ) : (
                      <WorkflowStatusBadge state="submitted" label={t("member_portal.parish_life.open_to_join")} />
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="outline" className="h-10 rounded-xl">
                    <AppLink to="/portal/ministries">{t("member_portal.parish_life.all_ministries")}</AppLink>
                  </Button>
                  {selectedMinistry.isMember ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 rounded-xl"
                      disabled={mutationPending}
                      onClick={() => leave.mutate(selectedMinistry.id)}
                    >
                      {t("member_portal.parish_life.leave_ministry")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-10 rounded-xl"
                      disabled={mutationPending || selectedMinistry.requestStatus === "pending"}
                      onClick={() => join.mutate(selectedMinistry.id)}
                    >
                      {selectedMinistry.requestStatus === "pending" ? t("member_portal.parish_life.request_sent") : t("member_portal.parish_life.request_to_join")}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isLoading && !isError ? (
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-foreground">{t("member_portal.parish_life.browse_ministries")}</h2>
                <Badge variant="outline">{t("member_portal.parish_life.available_count", { count: filteredMinistries.length })}</Badge>
              </div>
              {filteredMinistries.length === 0 ? (
                <Card className="rounded-[28px] border-border/70 bg-card/85">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("member_portal.parish_life.no_ministries_match")}</CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredMinistries.map((ministry) => (
                    <MinistryCard
                      key={ministry.id}
                      ministry={ministry}
                      isPending={mutationPending && pendingMutationId === ministry.id}
                      onJoin={(nextMinistryId) => join.mutate(nextMinistryId)}
                      onLeave={(nextMinistryId) => leave.mutate(nextMinistryId)}
                    />
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                    {t("member_portal.parish_life.my_ministries")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {myMinistries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("member_portal.parish_life.no_my_ministries")}</p>
                  ) : (
                    myMinistries.map((ministry) => (
                      <AppLink
                        key={ministry.id}
                        to={`/portal/ministries/${ministry.id}`}
                        className="block rounded-2xl border border-border/60 bg-background/50 p-3 text-sm font-medium hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {ministry.name}
                      </AppLink>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
                    {t("member_portal.parish_life.todays_ministry_schedule")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingMinistryEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("member_portal.parish_life.no_ministry_schedule")}</p>
                  ) : (
                    upcomingMinistryEvents.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-border/60 bg-background/50 p-3">
                        <p className="text-sm font-semibold text-foreground">{event.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCalendarDate(event.startsAt, language)} {t("member_portal.parish_life.at")} {formatCalendarTime(event.startsAt, language)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-border/70 bg-card/85 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Megaphone className="h-5 w-5 text-primary" aria-hidden="true" />
                    {t("member_portal.parish_life.service_opportunities")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {volunteerOpportunities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("member_portal.parish_life.no_service_opportunities")}</p>
                  ) : (
                    volunteerOpportunities.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-border/60 bg-background/50 p-3">
                        <p className="text-sm font-semibold text-foreground">{event.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {event.ministry} - {formatCalendarDate(event.startsAt, language)}
                        </p>
                      </div>
                    ))
                  )}
                  <Button asChild variant="outline" className="h-10 w-full rounded-xl">
                    <AppLink to="/portal/calendar">{t("member_portal.parish_life.open_parish_calendar")}</AppLink>
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}
