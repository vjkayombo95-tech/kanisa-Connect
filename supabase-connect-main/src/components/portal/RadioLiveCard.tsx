import { ChevronRight, Radio } from "lucide-react";
import { AppLink } from "@/components/AppLink";
import { useChurchRadioStations } from "@/hooks/use-church-radio";
import { RadioStationSelector } from "@/components/portal/RadioStationSelector";

export function RadioLiveCard({ playInline = false }: { playInline?: boolean }) {
  const { data, featureEnabled, error, churchId } = useChurchRadioStations();
  const stations = data.filter((item) => item.churchId === churchId);
  const station = stations.find((item) => item.isFeatured) ?? stations[0];
  if (!featureEnabled || error || !station) return null;
  return <section data-testid="radio-live-card" className="rounded-[1.4rem] border border-red-400/15 bg-gradient-to-br from-zinc-950 to-zinc-900 p-5 text-white shadow-xl">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/15 text-red-300"><Radio className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[11px] font-extrabold tracking-[0.18em] text-red-300">RADIO LIVE</p><h2 className="break-words font-bold">{stations.length > 1 ? `Stesheni ${stations.length} zinapatikana` : station.name}</h2><p className="text-xs text-zinc-400">{stations.length > 1 ? "Chagua unayotaka kusikiliza" : "Hewani sasa"}</p></div></div>
    {playInline ? <RadioStationSelector stations={stations} className="mt-4 w-full" singleLabel="Sikiliza" chooseLabel="Chagua Stesheni" listenLabel="Sikiliza" /> : <AppLink to="/portal/radio" className="mt-4 flex min-h-12 items-center justify-center gap-1 rounded-2xl bg-white px-4 text-sm font-bold text-zinc-950">Sikiliza <ChevronRight className="h-4 w-4" /></AppLink>}
  </section>;
}
