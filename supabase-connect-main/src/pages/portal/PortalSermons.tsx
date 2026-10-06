import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BookMarked, Video, Headphones } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatAppDate } from "@/lib/localization";
import { useTranslation } from "react-i18next";

export default function PortalSermons() {
  const { churchId } = useAuth();
  const { isFeatureEnabled } = useFeatureAccess();
  const { t, i18n } = useTranslation();

  const { data: sermons = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["portal-sermons", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("sermons")
        .select("*")
        .eq("church_id", churchId)
        .is("archived_at", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!churchId && isFeatureEnabled("sermons"),
  });

  return (
    <main className="min-h-full overflow-x-hidden bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.28))] px-4 py-5 pb-28 lg:px-8 lg:pb-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="space-y-1">
          <p className="text-sm font-bold text-primary">Kanisa Connect</p>
          <h1 className="break-words font-serif text-2xl font-bold md:text-3xl">{t("member_sermons.title")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("member_sermons.description")}
          </p>
        </header>

        {isLoading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <Skeleton className="h-32 rounded-[24px]" />
            <Skeleton className="h-32 rounded-[24px]" />
            <span className="sr-only">{t("member_sermons.loading")}</span>
          </div>
        ) : isError ? (
          <Card className="rounded-[24px] border-destructive/30 bg-card/85">
            <CardContent className="flex flex-col items-center gap-3 px-5 py-8 text-center" role="alert">
              <AlertCircle className="h-9 w-9 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">{t("member_sermons.error.title")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("member_sermons.error.description")}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void refetch()}>{t("member_sermons.actions.retry")}</Button>
            </CardContent>
          </Card>
        ) : sermons.length === 0 ? (
          <Card className="rounded-[24px] border-border/70 bg-card/80">
            <CardContent className="flex items-start gap-4 p-5 text-muted-foreground">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BookMarked className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">{t("member_sermons.empty.title")}</p>
                <p className="mt-1 text-sm">{t("member_sermons.empty.description")}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sermons.map((s: any) => (
              <Card key={s.id} className="rounded-[24px] border-border/70 bg-card/85 shadow-sm transition-shadow hover:border-primary/25">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{s.title}</h3>
                      {s.preacher && <p className="text-sm text-primary mt-0.5">{s.preacher}</p>}
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{s.content || t("member_sermons.fallbacks.no_notes")}</p>
                      <div className="flex gap-3 mt-3">
                        {s.video_url && (
                          <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Video className="h-3.5 w-3.5" /> {t("member_sermons.actions.watch_video")}
                          </a>
                        )}
                        {s.audio_url && (
                          <a href={s.audio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Headphones className="h-3.5 w-3.5" /> {t("member_sermons.actions.listen_audio")}
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">{formatAppDate(s.date, i18n.language, { dateStyle: "medium" })}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
