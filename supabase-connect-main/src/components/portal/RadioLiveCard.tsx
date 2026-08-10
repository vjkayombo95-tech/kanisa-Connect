import { ChevronRight, Play, Radio } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { useRadioPlayer } from "@/contexts/RadioPlayerContext";
import { useChurchRadioStations } from "@/hooks/use-church-radio";

export function RadioLiveCard({ playInline = false }: { playInline?: boolean }) {
  const { data, featureEnabled, error } = useChurchRadioStations();
  const player = useRadioPlayer();
  const station = data.find((item) => item.isFeatured) ?? data[0];
  if (!featureEnabled || error || !station) return null;
  return <section data-testid="radio-live-card" className="rounded-[1.4rem] border border-red-400/15 bg-gradient-to-br from-zinc-950 to-zinc-900 p-5 text-white shadow-xl">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/15 text-red-300"><Radio className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[11px] font-extrabold tracking-[0.18em] text-red-300">RADIO LIVE</p><h2 className="truncate font-bold">{station.name}</h2><p className="text-xs text-zinc-400">Hewani sasa</p></div></div>
    {playInline ? <button type="button" onClick={() => void player.play(station)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950">Sikiliza <Play className="h-4 w-4 fill-current" aria-hidden="true" /></button> : <AppLink to="/portal/radio" className="mt-4 flex min-h-12 items-center justify-center gap-1 rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950">Sikiliza <ChevronRight className="h-4 w-4" /></AppLink>}
  </section>;
}
