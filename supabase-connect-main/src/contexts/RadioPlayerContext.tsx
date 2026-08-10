import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pause, Play, Radio, RotateCcw, Volume2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isSafeRadioStreamUrl, type ChurchRadioStation } from "@/lib/church-radio";
import { logWarning } from "@/lib/error-logger";

type State = "idle" | "loading" | "playing" | "paused" | "error";
type RadioPlayerValue = { station: ChurchRadioStation | null; state: State; volume: number; play: (station: ChurchRadioStation) => Promise<void>; pause: () => void; retry: () => Promise<void>; setVolume: (value: number) => void };
const RadioPlayerContext = createContext<RadioPlayerValue | null>(null);

export function RadioPlayerProvider({ children }: { children: ReactNode }) {
  const { churchId, user } = useAuth();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scopeRef = useRef({ churchId, userId: user?.id ?? null });
  const [station, setStation] = useState<ChurchRadioStation | null>(null);
  const [state, setState] = useState<State>("idle");
  const [volume, setVolumeState] = useState(0.8);

  const stop = useCallback(() => { audioRef.current?.pause(); if (audioRef.current) audioRef.current.src = ""; audioRef.current = null; setStation(null); setState("idle"); }, []);
  useEffect(() => { const next = { churchId, userId: user?.id ?? null }; if (!next.userId || next.churchId !== scopeRef.current.churchId || next.userId !== scopeRef.current.userId) stop(); scopeRef.current = next; }, [churchId, stop, user?.id]);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (!station) return;
    const keepPlaybackOnPortalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const target = new URL(anchor.href, window.location.href);
      const churchWorkspacePrefixes = ["/portal", "/member", "/church-admin", "/pastoral", "/finance", "/community", "/church-live"];
      if (target.origin !== window.location.origin || !churchWorkspacePrefixes.some((prefix) => target.pathname.startsWith(prefix))) return;
      event.preventDefault();
      window.history.pushState({}, "", `${target.pathname}${target.search}${target.hash}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };
    document.addEventListener("click", keepPlaybackOnPortalNavigation, true);
    return () => document.removeEventListener("click", keepPlaybackOnPortalNavigation, true);
  }, [station]);

  const play = useCallback(async (next: ChurchRadioStation) => {
    if (!churchId || next.churchId !== churchId || !next.isActive || !isSafeRadioStreamUrl(next.streamUrl)) { setState("error"); return; }
    if (!audioRef.current || station?.id !== next.id) {
      audioRef.current?.pause();
      const audio = new Audio(next.streamUrl); audio.preload = "none"; audio.volume = volume;
      audio.addEventListener("playing", () => setState("playing"));
      audio.addEventListener("waiting", () => setState("loading"));
      audio.addEventListener("error", () => { setState("error"); logWarning("MEMBER_RADIO_PLAYBACK_FAILED", { component: "RadioPlayerProvider", metadata: { stationId: next.id } }); });
      audioRef.current = audio; setStation(next);
    }
    setState("loading");
    try { await audioRef.current.play(); } catch { setState("error"); logWarning("MEMBER_RADIO_PLAYBACK_FAILED", { component: "RadioPlayerProvider", metadata: { stationId: next.id } }); }
  }, [churchId, station?.id, volume]);
  const pause = useCallback(() => { audioRef.current?.pause(); setState("paused"); }, []);
  const retry = useCallback(async () => { if (station) { if (audioRef.current) audioRef.current.load(); await play(station); } }, [play, station]);
  const setVolume = useCallback((next: number) => { const safe = Math.min(1, Math.max(0, next)); setVolumeState(safe); if (audioRef.current) audioRef.current.volume = safe; }, []);
  const value = useMemo(() => ({ station, state, volume, play, pause, retry, setVolume }), [pause, play, retry, setVolume, state, station, volume]);
  const inChurchWorkspace = Boolean(churchId) && !location.pathname.startsWith("/super-admin");

  return <RadioPlayerContext.Provider value={value}>{children}{station && inChurchWorkspace ? <RadioMiniPlayer value={value} /> : null}</RadioPlayerContext.Provider>;
}

function RadioMiniPlayer({ value }: { value: RadioPlayerValue }) {
  const { station, state, pause, play, retry, volume, setVolume } = value;
  if (!station) return null;
  return <aside data-testid="radio-mini-player" data-radio-state={state} className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[45] mx-auto flex min-h-16 max-w-lg items-center gap-3 rounded-2xl border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur lg:inset-x-auto lg:bottom-4 lg:right-4 lg:w-96">
    <Radio className="h-5 w-5 shrink-0 text-red-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{station.name}</p><p className="text-[11px] font-bold text-red-500">LIVE</p></div>
    {state === "error" ? <button className="min-h-11 min-w-11" aria-label="Jaribu tena" onClick={() => void retry()}><RotateCcw className="mx-auto h-5 w-5" /></button> : state === "playing" || state === "loading" ? <button className="min-h-11 min-w-11" aria-label="Sitisha radio" onClick={pause}><Pause className="mx-auto h-5 w-5" /></button> : <button className="min-h-11 min-w-11" aria-label="Sikiliza radio" onClick={() => void play(station)}><Play className="mx-auto h-5 w-5" /></button>}
    <label className="hidden items-center gap-1 sm:flex"><Volume2 className="h-4 w-4" /><span className="sr-only">Sauti</span><input aria-label="Sauti" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-16" /></label>
  </aside>;
}

export function useRadioPlayer() { const value = useContext(RadioPlayerContext); if (!value) throw new Error("useRadioPlayer must be used inside RadioPlayerProvider"); return value; }
