import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBibleAudioRequest, type BibleAudioRequest } from "@/lib/bible-audio";

type BibleAudioPlayerProps = {
  request: BibleAudioRequest;
  previousPath: string | null;
  nextPath: string | null;
};

type BibleAudioResponse = {
  audioUrl: string;
  cached: boolean;
  expiresIn: number;
};

const SPEEDS = ["0.75", "1", "1.25", "1.5", "2"];

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function BibleAudioPlayer({ request, previousPath, nextPath }: BibleAudioPlayerProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState("1");
  const [autoPlayNext, setAutoPlayNext] = useState(false);

  const generation = useMutation({
    mutationFn: async () => {
      const payload = normalizeBibleAudioRequest(request);
      const { data, error } = await supabase.functions.invoke("generate-bible-audio", {
        body: payload,
      });
      if (error) throw error;
      return data as BibleAudioResponse;
    },
    onSuccess: (data) => {
      setAudioUrl(data.audioUrl);
    },
  });

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = Number(speed);
  }, [speed, audioUrl]);

  const togglePlayback = async () => {
    if (!audioUrl) {
      const response = await generation.mutateAsync();
      setAudioUrl(response.audioUrl);
      window.setTimeout(() => void audioRef.current?.play(), 0);
      return;
    }

    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      await audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  };

  const seekTo = (value: number[]) => {
    const nextTime = value[0] ?? 0;
    if (audioRef.current) audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <Card className="mx-auto max-w-3xl rounded-lg border-primary/20 bg-card/95 shadow-sm" data-testid="bible-audio-player">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">{t("member_portal.bible.audio.listen")}</p>
            <p className="text-xs text-muted-foreground">{t("member_portal.bible.audio.secure_generation")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-lg" disabled={!previousPath} aria-label={t("member_portal.bible.audio.previous_chapter")}>
              {previousPath ? (
                <Link to={previousPath}>
                  <SkipBack className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span>
                  <SkipBack className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </Button>
            <Button type="button" className="h-10 rounded-lg px-4" onClick={() => void togglePlayback()} disabled={generation.isPending}>
              {generation.isPending ? <RotateCcw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : playing ? <Pause className="mr-2 h-4 w-4" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
              {playing ? t("member_portal.bible.audio.pause") : t("member_portal.bible.audio.play")}
            </Button>
            <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-lg" disabled={!nextPath} aria-label={t("member_portal.bible.audio.next_chapter")}>
              {nextPath ? (
                <Link to={nextPath}>
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <span>
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
            </Button>
          </div>
        </div>

        {generation.isError ? <p className="text-sm text-destructive">{generation.error instanceof Error ? generation.error.message : t("member_portal.bible.audio.unavailable")}</p> : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-2">
            <Slider value={[currentTime]} max={duration || 1} step={1} onValueChange={seekTo} aria-label={t("member_portal.bible.audio.seek")} />
            <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <Select value={speed} onValueChange={setSpeed}>
            <SelectTrigger className="h-10 w-full rounded-lg sm:w-24" aria-label={t("member_portal.bible.audio.speed")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEEDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="bible-audio-autoplay" checked={autoPlayNext} onCheckedChange={(value) => setAutoPlayNext(value === true)} />
          <Label htmlFor="bible-audio-autoplay" className="text-sm text-muted-foreground">{t("member_portal.bible.audio.auto_play_next")}</Label>
        </div>

        {audioUrl ? (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onEnded={() => {
              setPlaying(false);
              if (autoPlayNext && nextPath) window.location.assign(nextPath);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
