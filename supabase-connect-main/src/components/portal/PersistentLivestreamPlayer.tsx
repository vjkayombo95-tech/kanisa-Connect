import { ExternalLink, Maximize2, Radio, X } from "lucide-react";

import { usePersistentLivestream } from "@/contexts/PersistentLivestreamContext";
import { getValidatedYouTubeWatchUrl, getYouTubeEmbedUrl } from "@/lib/church-livestreams";
import { cn } from "@/lib/utils";

export function PersistentLivestreamPlayer() {
  const { activeStreamId, mode, stream, featureEnabled, churchId, expand, close } = usePersistentLivestream();
  if (!activeStreamId || mode === "closed" || !featureEnabled || !stream || stream.churchId !== churchId) return null;

  const embedUrl = getYouTubeEmbedUrl(stream);
  if (!embedUrl) return null;
  const watchUrl = getValidatedYouTubeWatchUrl(stream);
  const ended = stream.status === "ended" || stream.status === "cancelled";

  return (
    <section aria-label="Live Mass player" data-player-mode={mode} data-stream-id={activeStreamId} data-testid="persistent-livestream-player" className={cn("overflow-hidden border border-white/10 bg-zinc-950 text-white shadow-2xl", mode === "full" ? "fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] top-[calc(4rem+var(--staging-banner-height,0px))] z-30 mx-auto flex max-w-5xl flex-col justify-center rounded-3xl lg:bottom-6 lg:left-[calc(280px+1.5rem)] lg:right-6 lg:top-[calc(4.5rem+var(--staging-banner-height,0px))]" : "fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-50 w-[min(72vw,20rem)] rounded-2xl lg:bottom-6 lg:right-6 lg:w-96")}>
      <div className="relative aspect-video w-full shrink-0 bg-black">
        <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 h-full w-full border-0" data-testid="livestream-embed" referrerPolicy="strict-origin-when-cross-origin" src={embedUrl} title={`${stream.title} livestream`} />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-2">
          <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-full bg-black/65 px-2.5 text-[0.65rem] font-extrabold tracking-widest", ended ? "text-zinc-200" : "text-red-200")}><Radio className="h-3.5 w-3.5" aria-hidden="true" /> {ended ? "ENDED" : stream.status === "live" ? "LIVE" : "INAKARIBIA"}</span>
          <div className="pointer-events-auto flex gap-1">{mode === "mini" ? <button type="button" onClick={expand} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Expand live stream"><Maximize2 className="h-5 w-5" /></button> : null}<button type="button" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Close live stream"><X className="h-5 w-5" /></button></div>
        </div>
      </div>
      <button type="button" onClick={mode === "mini" ? expand : undefined} className={cn("min-w-0 p-3 text-left", mode === "mini" && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white")} aria-label={mode === "mini" ? "Expand live stream" : undefined}><p className="truncate text-sm font-bold">{stream.title}</p>{ended ? <p className="mt-1 text-xs text-zinc-300">Matangazo haya yamekwisha.</p> : null}</button>
      {mode === "full" && watchUrl ? <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="mx-3 mb-3 inline-flex min-h-11 items-center gap-2 self-start text-xs font-semibold text-zinc-300">Fungua YouTube <ExternalLink className="h-4 w-4" /></a> : null}
    </section>
  );
}
