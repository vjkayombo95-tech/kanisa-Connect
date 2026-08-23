import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { useParams } from "react-router-dom";

import { AppLink } from "@/components/AppLink";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLinkedMember } from "@/hooks/use-linked-member";
import {
  fetchMemberMinistries,
  leaveMemberMinistry,
  memberMinistriesQueryKey,
  requestMinistryMembership,
  type MemberMinistry,
} from "@/lib/member-ministries";

function MinistryCard({ ministry, memberId }: { ministry: MemberMinistry; memberId: string }) {
  const queryClient = useQueryClient();
  const { churchId } = useAuth();
  const { toast } = useToast();
  const leaveRequested = useRef(false);
  const mutation = useMutation({
    mutationFn: () => {
      if (!churchId) throw new Error("Parish context is unavailable.");
      return ministry.joined
        ? leaveMemberMinistry(memberId, ministry.id)
        : requestMinistryMembership(churchId, memberId, ministry.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: memberMinistriesQueryKey(churchId, memberId) });
      toast({
        title: ministry.joined ? "Umeondoka kwenye huduma" : "Ombi limetumwa",
        description: ministry.joined ? "Uanachama wako umesasishwa." : "Parokia itakagua ombi lako.",
      });
    },
    onError: (error: Error) => toast({ title: "Hatukuweza kusasisha huduma", description: error.message, variant: "destructive" }),
    onSettled: () => { leaveRequested.current = false; },
  });

  const confirmLeave = () => {
    if (leaveRequested.current || mutation.isPending) return;
    leaveRequested.current = true;
    mutation.mutate();
  };

  return (
    <Card className="rounded-[24px] border-border/70 bg-card/90 shadow-sm" data-testid={`member-ministry-${ministry.id}`}>
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-lg font-bold">{ministry.name}</h2>
            {ministry.joined ? <Badge>Umejiunga</Badge> : ministry.requestPending ? <Badge variant="secondary">Ombi linasubiri</Badge> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{ministry.description || "Huduma ya parokia inayokukaribisha kushiriki."}</p>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">Wanachama {ministry.memberCount}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <AppLink to={`/portal/ministries/${ministry.id}`}>Maelezo</AppLink>
          </Button>
          {ministry.joined ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="secondary" className="min-h-11 rounded-xl" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Ondoka kwenye huduma
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ondoka kwenye huduma?</AlertDialogTitle>
                  <AlertDialogDescription>Unakaribia kuondoka kwenye huduma ya {ministry.name}. Uanachama wako utaondolewa baada ya kuthibitisha.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={mutation.isPending}>Ghairi</AlertDialogCancel>
                  <AlertDialogAction disabled={mutation.isPending} onClick={confirmLeave}>
                    {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Thibitisha kuondoka
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button type="button" className="min-h-11 rounded-xl" disabled={mutation.isPending || ministry.requestPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : !ministry.requestPending ? <UserPlus className="mr-2 h-4 w-4" /> : null}
              {ministry.requestPending ? "Ombi linasubiri" : "Omba kujiunga"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MemberMinistriesPage() {
  const { ministryId } = useParams();
  const { churchId } = useAuth();
  const member = useLinkedMember();
  const [search, setSearch] = useState("");
  const ministries = useQuery({
    queryKey: memberMinistriesQueryKey(churchId, member.data?.id),
    queryFn: () => fetchMemberMinistries(churchId!, member.data!.id),
    enabled: !!churchId && !!member.data?.id,
    staleTime: 60_000,
  });

  const visible = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("sw");
    if (!normalized) return ministries.data ?? [];
    return (ministries.data ?? []).filter(({ name, description }) => `${name} ${description ?? ""}`.toLocaleLowerCase("sw").includes(normalized));
  }, [ministries.data, search]);
  const joined = visible.filter((ministry) => ministry.joined);
  const other = visible
    .filter((ministry) => !ministry.joined)
    .sort((left, right) => Number(right.requestPending) - Number(left.requestPending));
  const selected = ministryId ? (ministries.data ?? []).find(({ id }) => id === ministryId) : null;

  if (member.isLoading || ministries.isLoading) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-6"><Skeleton className="h-32 rounded-[24px]" /><Skeleton className="h-48 rounded-[24px]" /></div>;

  return (
    <main className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-hidden px-4 py-6 pb-28 lg:px-8 lg:pb-10" data-testid="member-ministries-page">
      <header className="rounded-[28px] border border-primary/20 bg-card/90 p-5 shadow-sm sm:p-7">
        <p className="flex items-center gap-2 text-sm font-bold text-primary"><Users className="h-4 w-4" />Huduma za parokia</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Tumikia pamoja na jumuiya yako</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Tafuta huduma, soma maelezo yake, na utume ombi la kujiunga.</p>
      </header>

      {member.isError || ministries.isError ? <Card className="border-destructive/30"><CardContent className="p-5 text-sm text-destructive">Huduma hazikuweza kupakiwa. Jaribu tena baadaye.</CardContent></Card> : null}
      {!member.isError && !member.data ? <Card><CardContent className="p-5 text-sm text-muted-foreground">Wasifu wa mshirika haujapatikana kwa parokia hii.</CardContent></Card> : null}

      {selected && member.data ? (
        <section className="space-y-4">
          <Button asChild variant="ghost"><AppLink to="/portal/ministries">Huduma zote</AppLink></Button>
          <MinistryCard ministry={selected} memberId={member.data.id} />
        </section>
      ) : member.data ? (
        <section className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tafuta huduma" placeholder="Tafuta huduma..." className="h-12 rounded-2xl bg-card pl-12" />
          </div>
          {!ministries.data?.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Hakuna huduma zilizowekwa kwa parokia hii.</CardContent></Card> : !visible.length ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Hakuna huduma zinazolingana na utafutaji wako.</CardContent></Card> : <div className="space-y-7">
            {joined.length ? <section aria-labelledby="joined-ministries-heading"><h2 id="joined-ministries-heading" className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-primary">Huduma zangu</h2><div className="grid gap-4 md:grid-cols-2">{joined.map((ministry) => <MinistryCard key={ministry.id} ministry={ministry} memberId={member.data.id} />)}</div></section> : null}
            {other.length ? <section aria-labelledby="other-ministries-heading"><h2 id="other-ministries-heading" className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">Huduma nyingine</h2><div className="grid gap-4 md:grid-cols-2">{other.map((ministry) => <MinistryCard key={ministry.id} ministry={ministry} memberId={member.data.id} />)}</div></section> : null}
          </div>}
        </section>
      ) : null}
    </main>
  );
}
