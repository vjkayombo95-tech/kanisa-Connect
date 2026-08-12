import { useEffect, useState } from "react";
import { Clock3, Play, Radio } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { useOptionalPersistentLivestream } from "@/contexts/PersistentLivestreamContext";
import { useChurchLivestream } from "@/hooks/use-church-livestream";
import { getMemberLivestreamPresentation, getYouTubeEmbedUrl, isSecureLivestreamUrl } from "@/lib/church-livestreams";
import { logWarning } from "@/lib/error-logger";
import { cn } from "@/lib/utils";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("sw-KE", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatUpcomingStart(value: string) {
  const date = new Date(value);
  const today = new Date();
  const day = date.toDateString() === today.toDateString()
    ? "Leo"
    : new Intl.DateTimeFormat("sw-KE", { weekday: "short", day: "numeric", month: "short" }).format(date);
  return `${day} · ${formatTime(value)}`;
}

type LiveMassCardProps = {
  churchName?: string | null;
  viewerBasePath?: string;
};

export function LiveMassCard({ churchName, viewerBasePath = "/portal/live" }: LiveMassCardProps) {
  const { data: stream, error, featureEnabled, churchId } = useChurchLivestream();
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const persistentPlayer = useOptionalPersistentLivestream();

  useEffect(() => {
    if (!error) return;
    logWarning("MEMBER_LIVESTREAM_LOOKUP_FAILED", {
      component: "LiveMassCard",
      metadata: { message: error instanceof Error ? error.message : String(error) },
    });
  }, [error]);

  if (!featureEnabled || error || !stream || stream.churchId !== churchId) return null;

  const presentation = getMemberLivestreamPresentation(stream);
  if (!presentation || !isSecureLivestreamUrl(stream.watchUrl)) return null;

  const isLive = presentation === "live";
  const internalViewer = getYouTubeEmbedUrl(stream) ? `${viewerBasePath}/${stream.id}` : null;
  const thumbnail = stream.thumbnailUrl && isSecureLivestreamUrl(stream.thumbnailUrl)
    && failedThumbnail !== stream.thumbnailUrl
    ? stream.thumbnailUrl
    : null;

  return (
    <section
      aria-label={isLive ? "Misa inaendelea moja kwa moja" : "Misa inayokaribia"}
      data-livestream-status={presentation}
      data-testid="live-mass-card"
      className={cn(
        "relative overflow-hidden rounded-[1.65rem] border bg-zinc-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_50px_-34px_rgba(0,0,0,0.95)]",
        isLive
          ? "border-red-400/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_54px_-32px_rgba(185,28,28,0.48)]"
          : "border-amber-300/20",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0", isLive ? "bg-[radial-gradient(circle_at_88%_8%,rgba(239,68,68,0.13),transparent_38%)]" : "bg-[radial-gradient(circle_at_88%_8%,rgba(245,158,11,0.10),transparent_38%)]")} aria-hidden="true" />

      {thumbnail ? (
        <div className="relative aspect-video max-h-52 w-full overflow-hidden border-b border-white/10 bg-zinc-900">
          <img
            src={thumbnail}
            alt={`Picha ya matangazo: ${stream.title}`}
            className="h-full w-full object-cover"
            onError={() => setFailedThumbnail(stream.thumbnailUrl)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" aria-hidden="true" />
          {isLive ? <LiveBadge className="absolute right-4 top-4" /> : null}
        </div>
      ) : null}

      <div className="relative p-5 sm:p-6">
        {!thumbnail ? (isLive ? <LiveBadge /> : <UpcomingBadge />) : !isLive ? <UpcomingBadge /> : null}
        <p className="mt-4 text-lg font-bold leading-tight tracking-[-0.015em] sm:text-xl">
          {isLive ? "Misa Inaendelea Sasa" : "Misa Inaanza Hivi Karibuni"}
        </p>
        <h2 className="mt-1.5 break-words text-base font-semibold leading-snug text-white/90">{stream.title}</h2>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs leading-5 text-zinc-400">
          {churchName ? <span className="break-words">{churchName}</span> : null}
          {isLive && stream.actualStartedAt ? <span>Ilianza saa {formatTime(stream.actualStartedAt)}</span> : null}
          {!isLive && stream.scheduledStart ? <span>{formatUpcomingStart(stream.scheduledStart)}</span> : null}
        </div>

        <AppLink
          to={internalViewer ?? stream.watchUrl}
          target={internalViewer ? undefined : "_blank"}
          rel={internalViewer ? undefined : "noopener noreferrer"}
          onClick={(event) => {
            if (!internalViewer || !persistentPlayer || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            persistentPlayer.open(stream.id);
          }}
          aria-label={isLive ? `Tazama moja kwa moja: ${stream.title}` : `Angalia maelezo ya: ${stream.title}`}
          className={cn(
            "mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold outline-none transition-[transform,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none",
            isLive ? "bg-white text-zinc-950 hover:bg-zinc-100" : "bg-amber-300 text-zinc-950 hover:bg-amber-200",
          )}
        >
          <Play className="h-4 w-4 fill-current stroke-[1.8]" aria-hidden="true" />
          {isLive ? "Tazama Moja kwa Moja" : "Angalia Maelezo"}
        </AppLink>
      </div>
    </section>
  );
}

function LiveBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-2 rounded-full border border-red-300/20 bg-black/55 px-3 text-[0.68rem] font-extrabold tracking-[0.16em] text-red-200 backdrop-blur-sm", className)}>
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-red-400/45 motion-reduce:animate-none" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      LIVE
    </span>
  );
}

function UpcomingBadge() {
  return (
    <span className="inline-flex min-h-7 items-center gap-2 rounded-full border border-amber-200/15 bg-amber-300/10 px-3 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-amber-200">
      <Clock3 className="h-3.5 w-3.5 stroke-[1.8]" aria-hidden="true" />
      Inakaribia
      <Radio className="h-3.5 w-3.5 stroke-[1.8]" aria-hidden="true" />
    </span>
  );
}
