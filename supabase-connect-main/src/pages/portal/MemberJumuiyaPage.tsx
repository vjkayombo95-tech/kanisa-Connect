import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Church, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
              {t("member_jumuiya.assignment.position", {
                current: index + 1,
                total,
              })}
            </p>
          ) : (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t("member_jumuiya.assignment.single_label")}
            </p>
          )}

          <h2 className="mt-1 break-words text-xl font-bold tracking-tight">
            {assignment.community_name}
          </h2>

          {description ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("member_jumuiya.assignment.no_description")}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MemberJumuiyaPage() {
  const navigate = useNavigate();
  const { churchId, user } = useAuth();
  const { t } = useTranslation();

  const assignments = useQuery({
    queryKey: memberJumuiyaAssignmentsQueryKey(user?.id, churchId),
    queryFn: () => fetchMyJumuiyaAssignments(churchId!),
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
        {t("member_services.jumuiya.back_title")}
      </Button>

      <header className="rounded-[28px] border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card))_68%)] p-5 shadow-sm sm:p-7">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <Church className="h-4 w-4" aria-hidden="true" />
          {t("member_services.jumuiya.label")}
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {t("member_services.jumuiya.label")}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("member_jumuiya.description")}
        </p>
      </header>

      {assignments.isLoading ? (
        <section
          aria-label={t("member_jumuiya.loading.aria_label")}
          className="space-y-3"
        >
          <Skeleton className="h-28 rounded-[24px]" />
          <Skeleton className="h-36 rounded-[24px]" />
          <span className="sr-only">
            {t("member_jumuiya.loading.message")}
          </span>
        </section>
      ) : assignments.isError ? (
        <Card
          className="rounded-[24px] border-destructive/30 bg-card/90"
          data-testid="member-jumuiya-error"
        >
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                {t("member_jumuiya.error.title")}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("member_jumuiya.error.description")}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-2xl"
              onClick={retryLoad}
              disabled={assignments.isFetching}
            >
              {assignments.isFetching ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {t("shared.actions.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : assignments.data?.length ? (
        <section
          aria-labelledby="member-jumuiya-list"
          className="space-y-3"
        >
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <ShieldCheck
              className="h-4 w-4 text-primary"
              aria-hidden="true"
            />
            <h2
              id="member-jumuiya-list"
              className="font-semibold text-foreground"
            >
              {assignments.data.length === 1
                ? t("member_jumuiya.assignment.single_label")
                : t("member_jumuiya.assignment.multiple_label")}
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
        <Card
          className="rounded-[24px] border-border/70 bg-card/85"
          data-testid="member-jumuiya-unassigned"
        >
          <CardContent className="space-y-2 p-5">
            <p className="font-semibold text-foreground">
              {t("member_jumuiya.unassigned.title")}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("member_jumuiya.unassigned.description")}
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
