import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { usePersistentLivestream } from "@/contexts/PersistentLivestreamContext";
import { useMemberLivestream } from "@/hooks/use-church-livestream";
import { getYouTubeEmbedUrl, memberLivestreamPresentation } from "@/lib/church-livestreams";
import { formatAppDate } from "@/lib/localization";

export default function MemberLivestreamPage() {
  const { streamId } = useParams();
  const { churchId } = useAuth();
  const { t, i18n } = useTranslation();
  const p = usePersistentLivestream();
  const q = useMemberLivestream(streamId);

  if (q.isLoading || q.featureLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-48 animate-pulse rounded-3xl bg-muted"
      >
        <span className="sr-only">{t("member_livestream.loading")}</span>
      </div>
    );
  }

  if (q.isError) {
    return (
      <section
        data-testid="livestream-error"
        role="alert"
        className="rounded-3xl border border-destructive/30 p-8 text-center"
      >
        <h1 className="text-xl font-bold">
          {t("member_livestream.error.title")}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {t("member_livestream.error.description")}
        </p>

        <button
          type="button"
          onClick={() => void q.refetch()}
          className="mt-4 min-h-11 rounded-xl border px-4 font-semibold"
        >
          {t("member_livestream.actions.retry")}
        </button>
      </section>
    );
  }

  const stream = q.data;
  const presentation = stream ? memberLivestreamPresentation(stream) : null;

  if (
    !q.featureEnabled ||
    !stream ||
    stream.churchId !== churchId ||
    !presentation ||
    !getYouTubeEmbedUrl(stream)
  ) {
    return (
      <section
        data-testid="livestream-unavailable"
        className="rounded-3xl border p-8 text-center"
      >
        <h1 className="text-xl font-bold">
          {t("member_livestream.unavailable.title")}
        </h1>
      </section>
    );
  }

  const isLive = presentation.state === "live";

  const label = isLive
    ? t("member_home.livestream.live.label")
    : t("member_home.livestream.upcoming.label");

  const action = isLive
    ? t("member_home.livestream.live.action")
    : t("member_home.livestream.upcoming.action");

  const scheduledDate = presentation.scheduledStart
    ? formatAppDate(presentation.scheduledStart, i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const detail = isLive
    ? null
    : scheduledDate
      ? t("member_home.livestream.starts_at", { date: scheduledDate })
      : t("member_home.livestream.starts_soon");

  return (
    <article
      data-testid="member-livestream-viewer"
      className="mx-auto min-w-0 max-w-5xl space-y-5 overflow-x-hidden"
    >
      <header className="min-w-0">
        <span className="text-xs font-bold text-red-500">{label}</span>

        <h1 className="mt-2 break-words text-3xl font-bold">
          {stream.title}
        </h1>

        {detail ? (
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        ) : null}
      </header>

      {p.activeStreamId === stream.id ? (
        <div
          className="aspect-video w-full overflow-hidden rounded-3xl bg-black"
          data-testid="persistent-livestream-host"
          data-persistent-livestream-host="true"
        />
      ) : (
        <button
          data-testid="start-livestream"
          onClick={() => p.open(stream.id)}
          className="flex aspect-video w-full flex-col items-center justify-center rounded-3xl bg-black text-white"
        >
          <Play className="h-12 w-12 fill-current" />
          <span className="mt-3 font-bold">{action}</span>
        </button>
      )}
    </article>
  );
}