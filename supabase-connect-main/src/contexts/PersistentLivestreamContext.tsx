import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useMemberLivestream } from "@/hooks/use-church-livestream";
import type { ChurchLivestream } from "@/lib/church-livestreams";

export type LivestreamPlayerMode = "closed" | "full" | "mini";

type PersistentLivestreamContextValue = {
  activeStreamId: string | null;
  mode: LivestreamPlayerMode;
  stream: ChurchLivestream | null;
  featureEnabled: boolean;
  churchId: string | null;
  open: (streamId: string) => void;
  expand: () => void;
  close: () => void;
};

const PersistentLivestreamContext = createContext<PersistentLivestreamContextValue | null>(null);

function routeStreamId(pathname: string) {
  return pathname.match(/^\/(?:portal|member)\/live\/([^/]+)\/?$/)?.[1] ?? null;
}

function memberLivePath(pathname: string, streamId: string) {
  return `${pathname.startsWith("/member") ? "/member" : "/portal"}/live/${encodeURIComponent(streamId)}`;
}

export function PersistentLivestreamProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { churchId, user } = useAuth();
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [mode, setMode] = useState<LivestreamPlayerMode>("closed");
  const scopeRef = useRef({ churchId, userId: user?.id ?? null });
  const activeQuery = useMemberLivestream(activeStreamId ?? undefined);
  const currentRouteStreamId = routeStreamId(location.pathname);

  const close = useCallback(() => {
    setActiveStreamId(null);
    setMode("closed");
  }, []);

  useEffect(() => {
    const nextScope = { churchId, userId: user?.id ?? null };
    if (scopeRef.current.churchId !== nextScope.churchId || scopeRef.current.userId !== nextScope.userId) close();
    scopeRef.current = nextScope;
  }, [churchId, close, user?.id]);

  useEffect(() => {
    if (!activeStreamId) return;
    if (!activeQuery.featureLoading && (!activeQuery.featureEnabled || activeQuery.error)) close();
    if (activeQuery.data && activeQuery.data.churchId !== churchId) close();
  }, [activeQuery.data, activeQuery.error, activeQuery.featureEnabled, activeQuery.featureLoading, activeStreamId, churchId, close]);

  useEffect(() => {
    if (!activeStreamId) return;
    setMode(currentRouteStreamId === activeStreamId ? "full" : "mini");
  }, [activeStreamId, currentRouteStreamId]);

  useEffect(() => {
    const interceptMemberNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target || target.hasAttribute("download")) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || !/^\/(?:portal|member)(?:\/|$)/.test(destination.pathname)) return;
      event.preventDefault();
      navigate(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    document.addEventListener("click", interceptMemberNavigation, true);
    return () => document.removeEventListener("click", interceptMemberNavigation, true);
  }, [navigate]);

  const open = useCallback((streamId: string) => {
    setActiveStreamId(streamId);
    setMode("full");
    navigate(memberLivePath(location.pathname, streamId));
  }, [location.pathname, navigate]);

  const expand = useCallback(() => {
    if (!activeStreamId) return;
    setMode("full");
    navigate(memberLivePath(location.pathname, activeStreamId));
  }, [activeStreamId, location.pathname, navigate]);

  const value = useMemo(() => ({ activeStreamId, mode, stream: activeQuery.data, featureEnabled: activeQuery.featureEnabled, churchId, open, expand, close }), [activeQuery.data, activeQuery.featureEnabled, activeStreamId, churchId, close, expand, mode, open]);
  return <PersistentLivestreamContext.Provider value={value}>{children}</PersistentLivestreamContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePersistentLivestream() {
  const value = useContext(PersistentLivestreamContext);
  if (!value) throw new Error("usePersistentLivestream must be used inside PersistentLivestreamProvider");
  return value;
}

// Shared media cards also render outside the member portal, where persistence is intentionally unavailable.
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalPersistentLivestream() {
  return useContext(PersistentLivestreamContext);
}
