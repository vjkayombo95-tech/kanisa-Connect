import { useState } from "react";
import { ChevronDown, Play } from "lucide-react";

import { useRadioPlayer } from "@/contexts/RadioPlayerContext";
import { orderChurchRadioStations, type ChurchRadioStation } from "@/lib/church-radio";
import { cn } from "@/lib/utils";

export function RadioStationSelector({ stations, className, singleLabel = "Listen Now", chooseLabel = "Choose Station", listenLabel = "Listen" }: { stations: ChurchRadioStation[]; className?: string; singleLabel?: string; chooseLabel?: string; listenLabel?: string }) {
  const player = useRadioPlayer();
  const [expanded, setExpanded] = useState(false);
  const ordered = orderChurchRadioStations(stations);
  if (!ordered.length) return null;

  if (ordered.length === 1) {
    return <button type="button" onClick={() => void player.play(ordered[0])} className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-zinc-950", className)}>{singleLabel} <Play className="h-4 w-4 fill-current" aria-hidden="true" /></button>;
  }

  return <div className={cn("relative", className)} data-testid="radio-station-selector">
    <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 text-xs font-bold text-amber-200 hover:bg-amber-300/15">{chooseLabel} <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} /></button>
    {expanded ? <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-zinc-900 p-2" data-testid="radio-station-options">
      {ordered.map((station) => <div key={station.id} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
        <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold text-white">{station.name}</p>{station.isFeatured ? <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Default</p> : null}</div>
        <button type="button" onClick={() => void player.play(station)} aria-label={`${listenLabel}: ${station.name}`} className="min-h-11 shrink-0 rounded-lg bg-white px-3 text-xs font-bold text-zinc-950">{listenLabel}</button>
      </div>)}
    </div> : null}
  </div>;
}
