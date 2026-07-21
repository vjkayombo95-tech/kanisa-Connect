import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AudioJobStatus, isActiveAudioStatus, isCompletedAudioStatus, isFailedAudioStatus, isReviewAudioStatus, statusLabel } from "@/lib/audio-cms";
import { AlertCircle, CheckCircle2, Clock3, Loader2, PauseCircle } from "lucide-react";

export function AudioStatusBadge({ status }: { status: AudioJobStatus }) {
  const className =
    isCompletedAudioStatus(status) || status === "published"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : isFailedAudioStatus(status)
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : isReviewAudioStatus(status)
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
          : isActiveAudioStatus(status)
            ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
            : "border-border bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", className)}>
      {statusLabel(status)}
    </Badge>
  );
}

export function AudioMetricCard({
  title,
  value,
  status,
}: {
  title: string;
  value: number | string;
  status: "complete" | "active" | "review" | "failed" | "draft";
}) {
  const Icon =
    status === "complete"
      ? CheckCircle2
      : status === "active"
        ? Loader2
        : status === "review"
          ? Clock3
          : status === "failed"
            ? AlertCircle
            : PauseCircle;

  return (
    <Card className="glass-card">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className={cn("h-5 w-5", status === "active" && "animate-spin")} />
        </span>
      </CardContent>
    </Card>
  );
}

export function AudioPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-md" />
    </div>
  );
}

export function EmptyAudioState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-border px-4 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
