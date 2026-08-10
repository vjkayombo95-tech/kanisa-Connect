import { useState } from "react";
import { Radio, Video, X } from "lucide-react";

import { AppLink } from "@/components/AppLink";
import { useChurchLivestream } from "@/hooks/use-church-livestream";
import { useChurchRadioStations } from "@/hooks/use-church-radio";
import { getYouTubeEmbedUrl, isSecureLivestreamUrl } from "@/lib/church-livestreams";
import { cn } from "@/lib/utils";
import { RadioStationSelector } from "@/components/portal/RadioStationSelector";

export function DesktopLiveMediaAwareness({ disabled = false }: { disabled?: boolean }) {
  if (disabled) return null;
  return <DesktopLiveMediaContent />;
}

function DesktopLiveMediaContent() {
  const livestream = useChurchLivestream();
  const radio = useChurchRadioStations();
  const [dismissedIdentity, setDismissedIdentity] = useState<string | null>(null);

  const stream = livestream.featureEnabled
    && !livestream.error
    && livestream.data?.status === "live"
    && livestream.data.churchId === livestream.churchId
    && isSecureLivestreamUrl(livestream.data.watchUrl)
    ? livestream.data
    : null;
  const stations = radio.featureEnabled && !radio.error ? radio.data.filter((item) => item.churchId === radio.churchId) : [];
  const station = stations[0] ?? null;
  const mediaIdentity = stream || station
    ? `live:${stream?.id ?? "none"}|radio:${station?.id ?? "none"}`
    : null;
  const panelOpen = mediaIdentity !== null && dismissedIdentity !== mediaIdentity;
  const viewer = stream && getYouTubeEmbedUrl(stream) ? `/church-live/${stream.id}` : stream?.watchUrl;

  if (!mediaIdentity) return null;

  return <>
    <button
      type="button"
      onClick={() => setDismissedIdentity(null)}
      aria-label="Fungua matangazo ya moja kwa moja"
      aria-expanded={panelOpen}
      data-testid="desktop-live-indicator"
      className={cn("hidden min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary lg:inline-flex", stream ? "border-red-400/20 bg-red-500/10 text-red-500 hover:bg-red-500/15" : "border-amber-300/20 bg-amber-300/10 text-amber-500 hover:bg-amber-300/15")}
    >
      <span className={cn("h-2 w-2 rounded-full", stream ? "bg-red-500" : "bg-amber-400")} aria-hidden="true" />
      {stream ? "Live" : "Radio"}
    </button>
    {panelOpen ? <aside
      data-testid="desktop-live-media-awareness"
      aria-label="Live Media"
      className="fixed right-6 top-[calc(var(--staging-banner-height,0px)+4.5rem)] z-30 hidden w-[min(24rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-amber-300/20 bg-zinc-950/95 text-white shadow-[0_24px_70px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 lg:block"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Live Media</p>
        <button type="button" onClick={() => setDismissedIdentity(mediaIdentity)} aria-label="Funga taarifa ya Live Media" className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"><X className="h-4 w-4" /></button>
      </div>
      <div className="divide-y divide-white/10">
        {stream ? <div className="flex min-w-0 items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-300"><Video className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold tracking-[0.16em] text-red-300">LIVE NOW</p><p className="break-words text-sm font-bold leading-5">{stream.title}</p><p className="text-xs text-zinc-400">Mass is streaming now</p></div>
          <AppLink to={viewer!} target={getYouTubeEmbedUrl(stream) ? undefined : "_blank"} rel={getYouTubeEmbedUrl(stream) ? undefined : "noopener noreferrer"} className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-white px-3 text-xs font-bold text-zinc-950">Watch Live</AppLink>
        </div> : null}
        {station ? <div className="flex min-w-0 items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300"><Radio className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold tracking-[0.16em] text-amber-300">RADIO AVAILABLE</p><p className="break-words text-sm font-bold leading-5">{stations.length > 1 ? `${stations.length} stations available` : station.name}</p>{stations.length > 1 ? <p className="text-xs text-zinc-400">Choose what to listen to</p> : null}</div>
          <RadioStationSelector stations={stations} className="w-32 shrink-0" />
        </div> : null}
      </div>
    </aside> : null}
  </>;
}
