import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Church, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchMyJumuiyaAssignments,
  memberJumuiyaAssignmentsQueryKey,
  type MemberJumuiyaAssignment,
} from "@/lib/member-jumuiya";

function JumuiyaAssignmentCard({
  assignment,
  index,
  total,
}: {
  assignment: MemberJumuiyaAssignment;
  index: number;
  total: number;
}) {
  const description = assignment.description?.trim();

  return (
    <article
      className="rounded-[24px] border border-primary/15 bg-card/85 p-5 shadow-sm"
      data-testid="member-jumuiya-assignment"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {total > 1 ? (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Jumuiya {index + 1} kati ya {total}
            </p>
          ) : (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Jumuiya uliyopewa</p>
          )}
          <h2 className="mt-1 break-words text-xl font-bold tracking-tight">{assignment.community_name}</h2>
          {description ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Maelezo ya Jumuiya hii bado hayajawekwa.</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MemberJumuiyaPage() {
  const navigate = useNavigate();
  const { churchId, user } = useAuth();
  const assignments = useQuery({
    queryKey: memberJumuiyaAssignmentsQueryKey(user?.id, churchId),
    queryFn: fetchMyJumuiyaAssignments,
    enabled: !!user?.id && !!churchId,
    retry: false,
    staleTime: 60_000,
  });

  const retryLoad = () => {
    void assignments.refetch();
  };

  return (
    <main
      className="mx-auto min-w-0 max-w-4xl space-y-5 overflow-x-hidden px-4 py-5 pb-28 lg:px-8 lg:py-7 lg:pb-10"
      data-testid="member-jumuiya-page"
    >
      <Button
        type="button"
        variant="ghost"
        className="hidden min-h-11 rounded-2xl px-2 text-muted-foreground hover:text-primary lg:inline-flex"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        Rudi
      </Button>

      <header className="rounded-[28px] border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_68%)] p-5 shadow-sm sm:p-7">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <Church className="h-4 w-4" aria-hidden="true" />
          Jumuiya Yangu
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Jumuiya Yangu</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Angalia Jumuiya ya parokia uliyopewa. Mabadiliko ya uanachama hufanywa na ofisi ya parokia au kiongozi aliyeidhinishwa.
        </p>
      </header>

      {assignments.isLoading ? (
        <section aria-label="Inapakia taarifa ya Jumuiya" className="space-y-3">
          <Skeleton className="h-28 rounded-[24px]" />
          <Skeleton className="h-36 rounded-[24px]" />
          <span className="sr-only">Tunaangalia taarifa ya Jumuiya yako...</span>
        </section>
      ) : assignments.isError ? (
        <Card className="rounded-[24px] border-destructive/30 bg-card/90" data-testid="member-jumuiya-error">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Taarifa ya Jumuiya haikuweza kupakiwa kwa sasa.</p>
              <p className="text-sm leading-6 text-muted-foreground">Jaribu tena ili kuona Jumuiya uliyopewa.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-2xl"
              onClick={retryLoad}
              disabled={assignments.isFetching}
            >
              {assignments.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Jaribu tena
            </Button>
          </CardContent>
        </Card>
      ) : assignments.data?.length ? (
        <section aria-labelledby="member-jumuiya-list" className="space-y-3">
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 id="member-jumuiya-list" className="font-semibold text-foreground">
              {assignments.data.length === 1 ? "Jumuiya uliyopewa" : "Jumuiya ulizopewa"}
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.data.map((assignment, index) => (
              <JumuiyaAssignmentCard
                key={`${assignment.community_name}-${index}`}
                assignment={assignment}
                index={index}
                total={assignments.data.length}
              />
            ))}
          </div>
        </section>
      ) : (
        <Card className="rounded-[24px] border-border/70 bg-card/85" data-testid="member-jumuiya-unassigned">
          <CardContent className="space-y-2 p-5">
            <p className="font-semibold text-foreground">Hujapangiwa Jumuiya kwa sasa.</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Wasiliana na ofisi ya parokia ili kuthibitisha au kusasisha taarifa ya Jumuiya yako.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
