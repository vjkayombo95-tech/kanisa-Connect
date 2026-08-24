import { useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

import { usePersistentLivestream } from "@/contexts/PersistentLivestreamContext";
import { getYouTubeEmbedUrl } from "@/lib/church-livestreams";

export function PersistentLivestreamPlayer() {
  const player = usePersistentLivestream();
  const portalContainer = useMemo(
    () => (typeof document === "undefined" ? null : document.createElement("div")),
    [],
  );
  const embed = player.stream ? getYouTubeEmbedUrl(player.stream) : null;
  const canRender = !!(
    player.activeStreamId
    && player.stream
    && embed
    && player.featureEnabled
    && player.stream.churchId === player.churchId
  );

  useLayoutEffect(() => {
    if (!portalContainer || !canRender) {
      portalContainer?.remove();
      return;
    }

    const fullHost = player.mode === "full"
      ? document.querySelector<HTMLElement>('[data-persistent-livestream-host="true"]')
      : null;
    const target = fullHost ?? document.body;
    portalContainer.className = fullHost ? "h-full w-full" : "";
    if (portalContainer.parentElement !== target) target.appendChild(portalContainer);
  }, [canRender, player.mode, portalContainer]);

  useLayoutEffect(() => () => portalContainer?.remove(), [portalContainer]);

  if (!portalContainer || !canRender || !player.stream || !embed) return null;

  return createPortal(
    <aside
      data-testid="persistent-livestream-player"
      data-player-mode={player.mode}
      data-stream-id={player.stream.id}
      className={player.mode === "full"
        ? "h-full w-full overflow-hidden rounded-3xl bg-black"
        : "fixed bottom-24 right-3 z-[60] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-black text-white shadow-2xl lg:bottom-6 lg:right-6"}
    >
      <div className="aspect-video w-full">
        <iframe
          data-testid="livestream-embed"
          title={player.stream.title}
          src={embed}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
      {player.mode === "mini" ? (
        <div className="flex min-h-14 items-center gap-2 px-3">
          <button aria-label={`Fungua Misa Mubashara: ${player.stream.title}`} onClick={player.expand} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left font-semibold">
            <span className="min-w-0 flex-1 truncate">{player.stream.title}</span>
            <Maximize2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          </button>
          <button aria-label="Funga Misa Mubashara" onClick={player.close} className="flex h-11 w-11 items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </aside>,
    portalContainer,
  );
}
