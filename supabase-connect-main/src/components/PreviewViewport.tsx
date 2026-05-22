import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Monitor, Smartphone, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type PreviewMode = "desktop" | "mobile" | "both";

const STORAGE_KEY = "ecclesia-preview-mode";
const MOBILE_BREAKPOINT = 768;

const previewModes: Array<{
  id: PreviewMode;
  label: string;
  icon: typeof Monitor;
}> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "mobile", label: "Mobile", icon: Smartphone },
  { id: "both", label: "Both", icon: PanelsTopLeft },
];

function buildEmbeddedUrl(pathname: string, search: string, hash: string) {
  const params = new URLSearchParams(search);
  params.set("embedded", "1");
  const query = params.toString();

  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function PreviewViewport({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<PreviewMode>(() => {
    if (typeof window === "undefined") return "desktop";

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "mobile" || stored === "both" || stored === "desktop" ? stored : "desktop";
  });
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  const isEmbedded = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("embedded") === "1";
  }, [location.search]);

  const iframeSrc = useMemo(
    () => buildEmbeddedUrl(location.pathname, location.search, location.hash),
    [location.hash, location.pathname, location.search],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode]);

  useEffect(() => {
    if (user && mode !== "desktop") {
      setMode("desktop");
    }
  }, [mode, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_BREAKPOINT);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  if (isEmbedded) {
    return <>{children}</>;
  }

  if (user) {
    return <>{children}</>;
  }

  if (isMobileViewport) {
    return <>{children}</>;
  }

  const toolbar = (
    <div className="fixed right-4 top-20 z-[120] xl:top-24">
      <div className="rounded-2xl border border-border/70 bg-card/85 p-2 shadow-[0_18px_60px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <div className="mb-2 px-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Preview</p>
        </div>
        <div className="flex items-center gap-1">
          {previewModes.map((previewMode) => {
            const Icon = previewMode.icon;

            return (
              <Button
                key={previewMode.id}
                variant={mode === previewMode.id ? "default" : "ghost"}
                size="sm"
                className="rounded-xl"
                onClick={() => setMode(previewMode.id)}
              >
                <Icon className="h-4 w-4" />
                {previewMode.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (mode === "mobile") {
    return (
      <>
        {toolbar}
        <div className="min-h-screen bg-background">
          <div className="mx-auto flex min-h-screen max-w-[1600px] items-start justify-center px-6 pb-10 pt-24">
            <div className="w-full max-w-[430px] rounded-[2rem] border border-border/70 bg-card/70 p-3 shadow-[0_36px_100px_-42px_rgba(0,0,0,0.95)] backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-center">
                <div className="h-1.5 w-24 rounded-full bg-muted-foreground/30" />
              </div>
              <iframe
                key={iframeSrc}
                title="Mobile preview"
                src={iframeSrc}
                className="h-[820px] w-full rounded-[1.45rem] border border-border/60 bg-background"
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (mode === "both") {
    return (
      <>
        {toolbar}
        <div className="min-h-screen bg-background">
          <div className="mx-auto grid min-h-screen max-w-[1700px] grid-cols-1 gap-6 px-6 pb-10 pt-24 xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-border/60 bg-background shadow-[0_30px_90px_-40px_rgba(0,0,0,0.85)]">
              {children}
            </div>
            <div className="rounded-[2rem] border border-border/70 bg-card/70 p-3 shadow-[0_36px_100px_-42px_rgba(0,0,0,0.95)] backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-center">
                <div className="h-1.5 w-24 rounded-full bg-muted-foreground/30" />
              </div>
              <iframe
                key={iframeSrc}
                title="Mobile preview"
                src={iframeSrc}
                className="h-[820px] w-full rounded-[1.45rem] border border-border/60 bg-background"
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {toolbar}
      <div className={cn("md:pt-0")}>{children}</div>
    </>
  );
}
