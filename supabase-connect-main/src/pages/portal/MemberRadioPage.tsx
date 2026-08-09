import { ExternalLink, Loader2, Pause, Play, Radio, RotateCcw, Volume2 } from "lucide-react";
import { useChurchRadioStations } from "@/hooks/use-church-radio";
import { useRadioPlayer } from "@/contexts/RadioPlayerContext";

export default function MemberRadioPage() {
  const { data, featureEnabled, isLoading, error } = useChurchRadioStations();
  const player = useRadioPlayer();
  if (isLoading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!featureEnabled || error || !data.length) return <div data-testid="radio-unavailable" className="rounded-3xl border bg-card p-8 text-center"><Radio className="mx-auto h-9 w-9 text-muted-foreground" /><h1 className="mt-4 text-xl font-bold">Radio haipatikani</h1><p className="mt-2 text-sm text-muted-foreground">Hakuna radio inayopatikana kwa sasa.</p></div>;
  const featured = data.find((item) => item.isFeatured) ?? data[0];
  const selected = player.station && data.some((item) => item.id === player.station?.id) ? player.station : featured;
  const playing = player.station?.id === selected.id && (player.state === "playing" || player.state === "loading");
  return <main className="mx-auto min-w-0 max-w-2xl space-y-5 overflow-x-hidden pb-32" data-testid="member-radio-page">
    <header><p className="text-xs font-extrabold tracking-[0.18em] text-red-500">RADIO LIVE</p><h1 className="mt-2 break-words text-3xl font-bold">{selected.name}</h1><p className="mt-1 text-sm font-bold text-red-500">● HEWANI</p></header>
    <section className="rounded-[1.75rem] border bg-gradient-to-br from-zinc-950 to-zinc-900 p-6 text-white shadow-2xl">
      <div className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-red-500/15">{selected.logoUrl ? <img src={selected.logoUrl} alt="" className="h-full w-full object-cover" /> : <Radio className="h-8 w-8 text-red-300" />}</span><div className="min-w-0"><h2 className="break-words text-xl font-bold">{selected.name}</h2><p className="mt-1 text-xs font-bold tracking-widest text-red-300">LIVE</p></div></div>
      {player.state === "error" && player.station?.id === selected.id ? <div className="mt-5 rounded-2xl bg-red-500/10 p-4"><p className="text-sm">Hatujaweza kuunganisha radio kwa sasa.</p><button onClick={() => void player.retry()} className="mt-2 min-h-11 font-bold text-red-200"><RotateCcw className="mr-2 inline h-4 w-4" />Jaribu tena</button></div> : null}
      <div className="mt-6 flex flex-wrap items-center gap-3"><button onClick={() => playing ? player.pause() : void player.play(selected)} aria-label={playing ? "Sitisha radio" : "Sikiliza LIVE"} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 font-bold text-zinc-950">{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}{playing ? "Sitisha" : "Sikiliza LIVE"}</button><label className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 px-3"><Volume2 className="h-5 w-5" /><span className="sr-only">Sauti</span><input aria-label="Sauti" type="range" min="0" max="1" step="0.05" value={player.volume} onChange={(event) => player.setVolume(Number(event.target.value))} className="w-24" /></label></div>
    </section>
    {data.length > 1 ? <section><h2 className="mb-3 text-lg font-bold">Radio nyingine</h2><div className="space-y-2">{data.filter((item) => item.id !== selected.id).map((item) => <button key={item.id} onClick={() => void player.play(item)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-left"><Radio className="h-5 w-5 text-red-500" /><span className="font-semibold">{item.name}</span></button>)}</div></section> : null}
    {selected.websiteUrl ? <a href={selected.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 font-semibold text-primary">Fungua tovuti ya radio <ExternalLink className="h-4 w-4" /></a> : null}
  </main>;
}
