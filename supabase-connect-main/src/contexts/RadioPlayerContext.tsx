import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchRadioStations } from "@/hooks/use-church-radio";
import { useLiveMediaCoordinator } from "@/contexts/LiveMediaCoordinator";
import type { ChurchRadioStation } from "@/lib/church-radio";
import { logWarning } from "@/lib/error-logger";

type PlayerState = "closed"|"paused"|"loading"|"playing"|"error";
type Value = { station:ChurchRadioStation|null; state:PlayerState; volume:number; play:(station:ChurchRadioStation)=>Promise<void>; pause:()=>void; close:()=>void; retry:()=>Promise<void>; setVolume:(volume:number)=>void };
const Context=createContext<Value|null>(null);

export function RadioPlayerProvider({children}:{children:ReactNode}) {
  const { churchId, user }=useAuth(); const stations=useChurchRadioStations(); const media=useLiveMediaCoordinator();
  const audio=useRef<HTMLAudioElement|null>(null); const scope=useRef({churchId,user:user?.id});
  const [station,setStation]=useState<ChurchRadioStation|null>(null); const [state,setState]=useState<PlayerState>("closed");
  const [volume,setVolumeState]=useState(0.8);
  const setAudio=useCallback((element:HTMLAudioElement|null)=>{const previous=audio.current;if(!element&&previous){previous.pause();previous.removeAttribute("src");previous.load();}audio.current=element;if(element)element.volume=volume},[volume]);
  const close=useCallback(()=>{const element=audio.current;if(element){element.pause();element.removeAttribute("src");element.load();}setStation(null);setState("closed")},[]);
  const pause=useCallback(()=>{audio.current?.pause();setState(current=>current==="closed"?current:"paused")},[]);
  const play=useCallback(async(next:ChurchRadioStation)=>{media.activate("radio");const element=audio.current;if(!element)return;if(station?.id!==next.id){element.src=next.streamUrl;setStation(next);}element.volume=volume;setState("loading");try{await element.play();setState("playing")}catch{setState("error");logWarning("Radio playback failed.",{component:"RadioPlayerProvider",metadata:{station_id:next.id}})}},[media,station?.id,volume]);
  const retry=useCallback(async()=>{if(!station)return;await play(station)},[play,station]);
  const setVolume=useCallback((next:number)=>{const safe=Math.min(1,Math.max(0,next));setVolumeState(safe);if(audio.current)audio.current.volume=safe},[]);
  useEffect(()=>media.register("radio",close),[media,close]);
  useEffect(()=>{if(scope.current.churchId!==churchId||scope.current.user!==user?.id)close();scope.current={churchId,user:user?.id}},[churchId,user?.id,close]);
  useEffect(()=>{if(stations.featureLoading||!stations.featureEnabled||(station&&!stations.data.some(item=>item.id===station.id)))close()},[stations.featureLoading,stations.featureEnabled,stations.data,station,close]);
  useEffect(()=>close,[close]);
  const value=useMemo(()=>({station,state,volume,play,pause,close,retry,setVolume}),[station,state,volume,play,pause,close,retry,setVolume]);
  return <Context.Provider value={value}>{children}{!stations.featureLoading&&stations.featureEnabled?<audio ref={setAudio} data-testid="persistent-radio-audio" preload="none" onPlaying={()=>setState("playing")} onPause={()=>setState(current=>current==="closed"?current:"paused")} onError={()=>{setState("error");if(station)logWarning("Radio playback failed.",{component:"RadioPlayerProvider",metadata:{station_id:station.id}})}} />:null}</Context.Provider>;
}
export function useRadioPlayer(){const value=useContext(Context);if(!value)throw new Error("RadioPlayerProvider required");return value;}
