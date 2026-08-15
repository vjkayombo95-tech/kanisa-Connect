import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type Medium = "radio" | "livestream";
type Coordinator = { activate:(medium:Medium)=>void; register:(medium:Medium, stop:()=>void)=>(()=>void) };
const fallback:Coordinator={activate:()=>{},register:()=>()=>{}};
const Context = createContext<Coordinator>(fallback);

export function LiveMediaCoordinatorProvider({children}:{children:ReactNode}) {
  const stops = useRef<Partial<Record<Medium,()=>void>>>({});
  const register = useCallback((medium:Medium, stop:()=>void) => { stops.current[medium] = stop; return () => { if (stops.current[medium] === stop) delete stops.current[medium]; }; }, []);
  const activate = useCallback((medium:Medium) => { const other:Medium = medium === "radio" ? "livestream" : "radio"; stops.current[other]?.(); }, []);
  return <Context.Provider value={useMemo(()=>({activate,register}),[activate,register])}>{children}</Context.Provider>;
}
export function useLiveMediaCoordinator(){return useContext(Context);}
