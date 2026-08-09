import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAudioTracks, useRecordAudioHistory, useSaveAudioProgress } from "@/hooks/use-universal-audio";
import { cn } from "@/lib/utils";
import { ExpandedAudioPlayer } from "./ExpandedAudioPlayer";
import { MiniAudioPlayer } from "./MiniAudioPlayer";
import {
  sourceFromTrack,
  type UniversalAudioPlayerEvent,
  type UniversalAudioPlayerProps,
  type UniversalAudioPlayerSource,
} from "./audio-player-types";

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, value);
  return Math.min(Math.max(0, value), duration);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}

export function UniversalAudioPlayer({
  source,
  contentId,
  title,
  subtitle,
  variant = "expanded",
  persistence,
  className,
  autoPlay = false,
  preload = "metadata",
  disabled = false,
  onPlay,
  onPause,
  onSeek,
  onProgress,
  onTimeUpdate,
  onEnded,
  onSpeedChanged,
}: UniversalAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProgressRef = useRef(0);
  const saveProgress = useSaveAudioProgress();
  const recordHistory = useRecordAudioHistory();
  const tracksQuery = useAudioTracks(source ? null : contentId);

  const loadedSource = useMemo<UniversalAudioPlayerSource | null>(() => {
    if (source) return source;
    const firstTrack = tracksQuery.data?.[0];
    return firstTrack ? sourceFromTrack(firstTrack) : null;
  }, [source, tracksQuery.data]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(contentId && !source));
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(loadedSource?.durationSeconds ?? 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(loadedSource?.durationSeconds ?? 0);
    setError(null);
  }, [loadedSource?.src, loadedSource?.durationSeconds]);

  useEffect(() => {
    setIsLoading(Boolean((contentId && !source && tracksQuery.isLoading) || (loadedSource && !error)));
  }, [contentId, error, loadedSource, source, tracksQuery.isLoading]);

  useEffect(() => {
    if (tracksQuery.isError) {
      const message = tracksQuery.error instanceof Error ? tracksQuery.error.message : "Audio tracks could not be loaded.";
      setError(message);
      setIsLoading(false);
    }
  }, [tracksQuery.error, tracksQuery.isError]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
  }, [speed, loadedSource?.src]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [muted, volume, loadedSource?.src]);

  const eventPayload = useCallback((): UniversalAudioPlayerEvent | null => {
    if (!loadedSource) return null;
    return { currentTime, duration, source: loadedSource };
  }, [currentTime, duration, loadedSource]);

  const persistProgress = useCallback(
    (position: number, completed = false) => {
      if (!persistence || !loadedSource) return;
      saveProgress.mutate({
        ...persistence,
        trackId: persistence.trackId ?? loadedSource.id ?? null,
        positionSeconds: position,
        durationSeconds: duration || loadedSource.durationSeconds || null,
        completed,
      });
    },
    [duration, loadedSource, persistence, saveProgress],
  );

  const recordEvent = useCallback(
    (eventType: "play" | "pause" | "resume" | "seek" | "complete" | "error", position = currentTime, metadata?: Record<string, unknown>) => {
      if (!persistence || !loadedSource) return;
      recordHistory.mutate({
        ...persistence,
        trackId: persistence.trackId ?? loadedSource.id ?? null,
        eventType,
        positionSeconds: position,
        durationSeconds: duration || loadedSource.durationSeconds || null,
        metadata,
      });
    },
    [currentTime, duration, loadedSource, persistence, recordHistory],
  );

  const togglePlayback = useCallback(() => {
    if (disabled || !audioRef.current) return;
    if (audioRef.current.paused) {
      void audioRef.current.play().catch((playError) => {
        setError(playError instanceof Error ? playError.message : "Audio could not be played.");
      });
    } else {
      audioRef.current.pause();
    }
  }, [disabled]);

  const seekTo = useCallback(
    (value: number) => {
      if (!audioRef.current) return;
      const nextTime = clampTime(value, duration);
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      persistProgress(nextTime);
      recordEvent("seek", nextTime);
      const payload = loadedSource ? { currentTime: nextTime, duration, source: loadedSource } : eventPayload();
      if (payload) onSeek?.(payload);
    },
    [duration, eventPayload, loadedSource, onSeek, persistProgress, recordEvent],
  );

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      seekTo((audioRef.current?.currentTime ?? currentTime) + deltaSeconds);
    },
    [currentTime, seekTo],
  );

  const changeSpeed = useCallback(
    (nextSpeed: number) => {
      setSpeed(nextSpeed);
      onSpeedChanged?.(nextSpeed);
    },
    [onSpeedChanged],
  );

  const changeVolume = useCallback((nextVolume: number) => {
    const normalized = Math.min(Math.max(nextVolume, 0), 1);
    setVolume(normalized);
    setMuted(normalized === 0);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        skipBy(-10);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        skipBy(10);
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        setMuted((value) => !value);
      }
    },
    [skipBy, togglePlayback],
  );

  const audioElement = loadedSource ? (
    <audio
      ref={audioRef}
      src={loadedSource.src}
      preload={preload}
      autoPlay={autoPlay}
      onLoadStart={() => {
        setIsLoading(true);
        setError(null);
      }}
      onCanPlay={() => setIsLoading(false)}
      onLoadedMetadata={(event) => {
        setDuration(event.currentTarget.duration || loadedSource.durationSeconds || 0);
        setIsLoading(false);
      }}
      onPlay={() => {
        setIsPlaying(true);
        recordEvent(currentTime > 0 ? "resume" : "play");
        const payload = eventPayload();
        if (payload) onPlay?.(payload);
      }}
      onPause={() => {
        setIsPlaying(false);
        persistProgress(audioRef.current?.currentTime ?? currentTime);
        recordEvent("pause");
        const payload = eventPayload();
        if (payload) onPause?.(payload);
      }}
      onTimeUpdate={(event) => {
        const nextTime = event.currentTarget.currentTime;
        const nextDuration = event.currentTarget.duration || duration;
        setCurrentTime(nextTime);
        onTimeUpdate?.({ currentTime: nextTime, duration: nextDuration, source: loadedSource });
        if (nextTime - lastProgressRef.current >= 5) {
          lastProgressRef.current = nextTime;
          persistProgress(nextTime);
          const payload = { currentTime: nextTime, duration: nextDuration, source: loadedSource };
          onProgress?.(payload);
        }
      }}
      onEnded={() => {
        setIsPlaying(false);
        persistProgress(duration, true);
        recordEvent("complete", duration);
        const payload = eventPayload();
        if (payload) onEnded?.(payload);
      }}
      onError={() => {
        setIsLoading(false);
        setError("Audio could not be loaded.");
        recordEvent("error", currentTime, { reason: "media_error" });
      }}
    />
  ) : null;

  if (!loadedSource) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground", className)} role="status">
        {tracksQuery.isLoading ? "Loading audio..." : error ?? "No playable audio track is available."}
      </div>
    );
  }

  const viewProps = {
    source: loadedSource,
    title: title ?? loadedSource.title,
    subtitle: subtitle ?? loadedSource.subtitle,
    isPlaying,
    isLoading,
    error,
    currentTime,
    duration,
    speed,
    volume,
    muted,
    disabled,
    className,
    audioElement,
    onTogglePlayback: togglePlayback,
    onSeek: seekTo,
    onSkip: skipBy,
    onSpeedChange: changeSpeed,
    onVolumeChange: changeVolume,
    onToggleMute: () => setMuted((value) => !value),
    onKeyDown: handleKeyDown,
  };

  if (variant === "mini") return <MiniAudioPlayer {...viewProps} />;
  return <ExpandedAudioPlayer {...viewProps} />;
}
