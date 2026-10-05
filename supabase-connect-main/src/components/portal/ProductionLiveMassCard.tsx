import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChurchLivestream } from "@/hooks/use-church-livestream";
import { getYouTubeEmbedUrl, memberLivestreamPresentation } from "@/lib/church-livestreams";
import { useOptionalPersistentLivestream } from "@/contexts/PersistentLivestreamContext";
import { formatAppDate } from "@/lib/localization";

export function ProductionLiveMassCard() {
  const { t, i18n } = useTranslation();
  const { data: stream, featureEnabled, churchId, error } = useChurchLivestream();
  const player = useOptionalPersistentLivestream();
  const presentation = stream ? memberLivestreamPresentation(stream) : null;

  if (!featureEnabled || error || !stream || stream.churchId !== churchId || !presentation || !getYouTubeEmbedUrl(stream)) return null;

  const detail = presentation.state === "upcoming"
    ? presentation.scheduledStart
      ? t("member_home.livestream.starts_at", {
          date: formatAppDate(presentation.scheduledStart, i18n.language, { dateStyle: "medium", timeStyle: "short" }),
        })
      : t("member_home.livestream.starts_soon")
    : null;
  const label = presentation.state === "live"
    ? t("member_home.livestream.live.label")
    : t("member_home.livestream.upcoming.label");
  const action = presentation.state === "live"
    ? t("member_home.livestream.live.action")
    : t("member_home.livestream.upcoming.action");

  return (
    <section data-testid="live-mass-card" className="rounded-[28px] border border-red-500/20 bg-zinc-950 p-5 text-white shadow-xl">
      <span className="rounded-full border border-red-400/30 px-3 py-1 text-xs font-bold text-red-300">
        {label}
      </span>
      <h2 className="mt-4 text-xl font-bold">{stream.title}</h2>
      {detail ? <p className="mt-2 text-sm text-zinc-300">{detail}</p> : null}
      <button type="button" onClick={() => player?.open(stream.id)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 font-bold text-zinc-950">
        <Play className="h-4 w-4 fill-current" />
        {action}
      </button>
    </section>
  );
}
