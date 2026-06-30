import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, BookOpen, CalendarDays, Clock, FileText, ImageOff, Library, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFeastDay } from "@/lib/catholic-library";
import { fetchCatholicDashboardStats, fetchSaintsForAdmin } from "@/lib/super-admin/saints-cms-service";
import { fetchImportHistory } from "@/lib/super-admin/import-history-service";
import { analyzeSaintDataQuality } from "@/lib/super-admin/saints-data-quality";

function MetricCard({ title, value, icon: Icon, hint }: { title: string; value: string | number; icon: typeof BookOpen; hint: string }) {
  return (
    <Card className="rounded-[24px] border-border/70 bg-card/85">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminCatholicDashboard() {
  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ["super-admin-catholic-dashboard"],
    queryFn: fetchCatholicDashboardStats,
    staleTime: 5 * 60 * 1000,
  });

  const { data: importHistory = [] } = useQuery({
    queryKey: ["super-admin-catholic-import-history"],
    queryFn: fetchImportHistory,
  });

  const { data: qualitySaints = [] } = useQuery({
    queryKey: ["super-admin-saints-manager"],
    queryFn: fetchSaintsForAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const latestUpdates = stats?.recentSaints ?? [];
  const quality = analyzeSaintDataQuality(qualitySaints);
  const draftSaints = qualitySaints.filter((saint) => !saint.is_active);
  const missingImageIssues = quality.issues.filter((issue) => issue.field === "image_url");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <section className="rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--card))_55%)] p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          Catholic Content
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Catholic Content Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage global Catholic content for Kanisa Connect.</p>
      </section>

      {isError ? (
        <Card className="rounded-[24px] border-destructive/25 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Catholic content dashboard could not be loaded: {(error as Error)?.message || "Please try again."}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-[24px]" />
          ))}
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Saints" value={stats?.totalSaints ?? 0} icon={BookOpen} hint="All saint records" />
          <MetricCard title="Featured Saints" value={stats?.featuredSaints ?? 0} icon={Sparkles} hint="Highlighted in member surfaces" />
          <MetricCard title="Daily Readings" value="Future" icon={FileText} hint="Schema pending" />
          <MetricCard title="Prayer Categories" value="8" icon={Library} hint="Prepared categories" />
          <MetricCard title="Published Saints" value={stats?.publishedSaints ?? 0} icon={Archive} hint="Active records" />
          <MetricCard title="Inactive Saints" value={stats?.inactiveSaints ?? 0} icon={Clock} hint="Hidden from member pages" />
          <MetricCard title="Saints Missing Images" value={stats?.saintsMissingImages ?? 0} icon={ImageOff} hint="Need images before full polish" />
          <MetricCard title="Draft Saints" value={draftSaints.length} icon={Clock} hint="Inactive saint records" />
          <MetricCard title="Recent Imports" value={importHistory.length} icon={Upload} hint="Placeholder history until tracking table exists" />
          <MetricCard title="Data Quality Issues" value={quality.issues.length} icon={AlertTriangle} hint="Biography, prayer, image, tag checks" />
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[24px] border-border/70 bg-card/85">
          <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Recently Updated Saints</h2>
              <p className="mt-1 text-sm text-muted-foreground">Most recently changed Catholic content records.</p>
            </div>
            <Badge variant="outline" className="rounded-full">
              Saints
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {latestUpdates.length ? (
              latestUpdates.map((saint) => (
                <div key={saint.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/45 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{saint.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFeastDay(saint.feast_month, saint.feast_day)}</p>
                  </div>
                  <Badge variant={saint.is_active ? "default" : "outline"} className="w-fit rounded-full">
                    {saint.is_active ? "Published" : "Draft"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No Catholic content has been published yet.</p>
            )}
          </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-border/70 bg-card/85">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Content Integrity Checker</h2>
                <p className="mt-1 text-sm text-muted-foreground">Production checks for missing content, invalid dates, images, and tags.</p>
              </div>
              <Badge variant={quality.errorCount ? "destructive" : quality.warningCount ? "outline" : "default"} className="rounded-full">
                {quality.errorCount} errors / {quality.warningCount} warnings
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              {quality.issues.length ? (
                quality.issues.slice(0, 6).map((issue, index) => (
                  <div key={`${issue.saintId}-${issue.field}-${index}`} className="rounded-2xl border border-border/60 bg-background/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{issue.saintName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{issue.message}</p>
                      </div>
                      <Badge variant={issue.severity === "error" ? "destructive" : "outline"}>{issue.field}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No content integrity issues detected.</p>
              )}
              {missingImageIssues.length ? (
                <p className="text-xs text-muted-foreground">{missingImageIssues.length} saint{missingImageIssues.length === 1 ? "" : "s"} need image review.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-border/70 bg-card/85">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold">Recently Imported Packs</h2>
            <p className="mt-1 text-sm text-muted-foreground">Import tracking is ready for persistence once a history table is introduced.</p>
            <div className="mt-4 space-y-3">
              {importHistory.length ? importHistory.slice(0, 5).map((record) => (
                <div key={record.id} className="rounded-2xl border border-border/60 bg-background/45 p-3">
                  <p className="font-medium">{record.workbookName}</p>
                  <p className="text-xs text-muted-foreground">{record.importDate} • {record.recordsImported} imported • {record.recordsFailed} failed</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No import packs have been recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-border/70 bg-card/85">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold">Inactive Saints</h2>
            <p className="mt-1 text-sm text-muted-foreground">Saint records hidden from member-facing Catholic Library pages.</p>
            <div className="mt-4 space-y-3">
              {draftSaints.length ? draftSaints.slice(0, 5).map((saint) => (
                <div key={saint.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/45 p-3">
                  <div>
                    <p className="font-medium">{saint.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFeastDay(saint.feast_month, saint.feast_day)}</p>
                  </div>
                  <Badge variant="outline">Inactive</Badge>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No inactive saints.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
