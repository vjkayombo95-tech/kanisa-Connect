import { ExternalLink, Radio } from "lucide-react";
import { useParams } from "react-router-dom";

import { AppLink } from "@/components/AppLink";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberLivestream } from "@/hooks/use-church-livestream";
import {
  getMemberLivestreamPresentation,
  getValidatedYouTubeWatchUrl,
  getYouTubeEmbedUrl,
} from "@/lib/church-livestreams";

function formatStartedAt(value: string) {
  return new Intl.DateTimeFormat("sw-KE", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function UnavailableState() {
  return (
    <section className="rounded-[1.65rem] border border-border/60 bg-card p-6 text-center shadow-sm" data-testid="livestream-unavailable">
      <Radio className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold">Matangazo hayapatikani</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Misa hii haipatikani kwa sasa au huna ruhusa ya kuitazama.</p>
      <AppLink to="/portal" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground">Rudi Nyumbani</AppLink>
    </section>
  );
}

export default function MemberLivestreamPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const { profile } = useAuth();
  const { data: stream, isLoading, error, featureEnabled, featureLoading, churchId } = useMemberLivestream(streamId);

  if (isLoading || featureLoading) {
    return <div className="space-y-4"><Skeleton className="h-24 rounded-3xl" /><Skeleton className="aspect-video w-full rounded-[1.65rem]" /></div>;
  }

  const presentation = getMemberLivestreamPresentation(stream);
  const embedUrl = stream ? getYouTubeEmbedUrl(stream) : null;
  const watchUrl = stream ? getValidatedYouTubeWatchUrl(stream) : null;
  if (!featureEnabled || error || !stream || stream.churchId !== churchId || !presentation || !embedUrl) return <UnavailableState />;

  const churchName = String(profile?.church_name || profile?.church?.name || "Parokia yako");
  const isLive = presentation === "live";

  return (
    <article className="mx-auto w-full min-w-0 max-w-5xl space-y-5 overflow-x-hidden pb-4" data-testid="member-livestream-viewer">
      <header className="min-w-0">
        <p className="inline-flex min-h-7 items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-3 text-[0.68rem] font-extrabold tracking-[0.16em] text-red-500">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
          {isLive ? "LIVE SASA" : "INAKARIBIA"}
        </p>
        <h1 className="mt-3 break-words text-2xl font-bold tracking-tight sm:text-3xl">{stream.title}</h1>
        <p className="mt-1 break-words text-sm text-muted-foreground">{churchName}</p>
      </header>

      <div className="aspect-video w-full overflow-hidden rounded-[1.65rem] border border-white/10 bg-black shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)]">
        <iframe
          src={embedUrl}
          title={`${stream.title} — ${churchName}`}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">{churchName}</p>
          {isLive && stream.actualStartedAt ? <p>Ilianza saa {formatStartedAt(stream.actualStartedAt)}</p> : null}
        </div>
        {watchUrl ? (
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-border px-4 font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
            Fungua YouTube <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
