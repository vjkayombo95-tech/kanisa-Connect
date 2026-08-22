import { CalendarClock, ExternalLink, Radio, Video } from "lucide-react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchLivestream } from "@/hooks/use-church-livestream";
import { useChurchRadioStations } from "@/hooks/use-church-radio";

const workspaceMedia = {
  admin: { livestream: true, radio: true },
  pastoral: { livestream: true, radio: false },
} as const;

function formatSchedule(value: string | null) {
  if (!value) return "Schedule available in Livestreams";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule available in Livestreams";
  return date.toLocaleString("en-TZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChurchAdminLiveMediaAwareness() {
  const { staffWorkspace } = useAuth();
  const livestream = useChurchLivestream();
  const radio = useChurchRadioStations();
  const roleMedia = staffWorkspace === "admin" || staffWorkspace === "pastoral" ? workspaceMedia[staffWorkspace] : null;

  if (!roleMedia) return null;

  const livestreamAvailable = roleMedia.livestream && livestream.featureEnabled;
  const radioAvailable = roleMedia.radio && radio.featureEnabled;
  const loading = livestream.featureLoading || radio.featureLoading;

  if (loading && !livestreamAvailable && !radioAvailable) {
    return (
      <section aria-label="Live Media" data-testid="church-admin-live-media-loading" className="rounded-xl border border-border/70 bg-card/85 p-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-4 h-24 rounded-lg" />
      </section>
    );
  }

  if (!livestreamAvailable && !radioAvailable) return null;

  return (
    <section aria-labelledby="church-admin-live-media-title" data-testid="church-admin-live-media" className="space-y-4 rounded-xl border border-primary/20 bg-card/85 p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Live Media</p>
        <h2 id="church-admin-live-media-title" className="mt-1 font-serif text-xl font-semibold text-foreground">Broadcast awareness</h2>
        <p className="mt-1 text-sm text-muted-foreground">Current authorized livestream and radio status. Playback never starts automatically.</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {livestreamAvailable ? (
          <article data-testid="church-admin-livestream-awareness" className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-border/70 bg-background/50 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500"><Video className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Livestream</p>
                {livestream.isLoading ? <Skeleton className="mt-2 h-5 w-40" /> : livestream.isError ? (
                  <p className="mt-1 text-sm text-destructive">Status is temporarily unavailable.</p>
                ) : livestream.data?.status === "live" ? (
                  <><p className="mt-1 text-sm font-semibold text-red-500">LIVE NOW</p><p className="mt-1 truncate text-sm text-muted-foreground">{livestream.data.title}</p></>
                ) : livestream.data?.status === "scheduled" ? (
                  <><p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary"><CalendarClock className="h-4 w-4" />Scheduled</p><p className="mt-1 text-sm text-muted-foreground">{formatSchedule(livestream.data.scheduledStart)}</p></>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No active or scheduled broadcast is currently published.</p>
                )}
              </div>
            </div>
            <Link to="/church-admin/livestreams" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Open Livestreams <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        ) : null}

        {radioAvailable ? (
          <article data-testid="church-admin-radio-awareness" className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-border/70 bg-background/50 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Radio className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Radio</p>
                {radio.isLoading ? <Skeleton className="mt-2 h-5 w-40" /> : radio.isError ? (
                  <p className="mt-1 text-sm text-destructive">Station status is temporarily unavailable.</p>
                ) : radio.data.length ? (
                  <><p className="mt-1 text-sm font-semibold text-primary">Available</p><p className="mt-1 truncate text-sm text-muted-foreground">{radio.data.find((station) => station.isDefault)?.name ?? radio.data[0].name}</p></>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No approved station is currently enabled.</p>
                )}
              </div>
            </div>
            <Link to="/church-admin/radio" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Open Radio <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        ) : null}
      </div>
    </section>
  );
}
