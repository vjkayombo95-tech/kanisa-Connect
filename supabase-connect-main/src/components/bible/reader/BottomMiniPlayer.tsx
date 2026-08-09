import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";

import { MiniAudioPlayer } from "@/components/audio";
import type { UniversalAudioPlayerSource } from "@/components/audio/audio-player-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BottomMiniPlayerProps = {
  source: UniversalAudioPlayerSource | null;
  title: string;
  subtitle: string;
  visible: boolean;
  seekRequest?: { time: number; nonce: number; autoplay?: boolean } | null;
  onProgress: (progress: number) => void;
  onTimeUpdate?: (time: number, duration: number) => void;
  onPlayingChange?: (playing: boolean) => void;
};

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, value);
  return Math.min(Math.max(0, value), duration);
}

export function BottomMiniPlayer({ source, title, subtitle, visible, seekRequest, onProgress, onTimeUpdate, onPlayingChange }: BottomMiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(!!source);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(source?.durationSeconds ?? 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [lastSeekNonce, setLastSeekNonce] = useState(0);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(source?.durationSeconds ?? 0);
    setError(null);
    setIsLoading(!!source);
  }, [source]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    if (!seekRequest || seekRequest.nonce === lastSeekNonce || !audioRef.current) return;
    const nextTime = clampTime(seekRequest.time, duration);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    onTimeUpdate?.(nextTime, duration);
    setLastSeekNonce(seekRequest.nonce);
    if (seekRequest.autoplay !== false) {
      void audioRef.current.play().catch((playError) => {
        setError(playError instanceof Error ? playError.message : "Audio could not be played.");
      });
    }
  }, [duration, lastSeekNonce, onTimeUpdate, seekRequest]);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return undefined;
    }

    intervalRef.current = window.setInterval(() => {
      const nextTime = audioRef.current?.currentTime ?? currentTime;
      const nextDuration = audioRef.current?.duration || duration;
      setCurrentTime(nextTime);
      onTimeUpdate?.(nextTime, nextDuration);
      onProgress(nextDuration > 0 ? Math.min(100, (nextTime / nextDuration) * 100) : 0);
    }, 200);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [currentTime, duration, isPlaying, onProgress, onTimeUpdate]);

  const audioElement = useMemo(() => {
    if (!source) return null;
    return (
      <audio
        ref={audioRef}
        src={source.src}
        preload="metadata"
        onLoadStart={() => {
          setIsLoading(true);
          setError(null);
        }}
        onCanPlay={() => setIsLoading(false)}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration || source.durationSeconds || 0;
          setDuration(nextDuration);
          setIsLoading(false);
          onTimeUpdate?.(event.currentTarget.currentTime, nextDuration);
        }}
        onPlay={() => {
          setIsPlaying(true);
          onPlayingChange?.(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayingChange?.(false);
        }}
        onTimeUpdate={(event) => {
          const nextTime = event.currentTarget.currentTime;
          const nextDuration = event.currentTarget.duration || duration;
          setCurrentTime(nextTime);
          onTimeUpdate?.(nextTime, nextDuration);
          onProgress(nextDuration > 0 ? Math.min(100, (nextTime / nextDuration) * 100) : 0);
        }}
        onEnded={() => {
          setIsPlaying(false);
          onPlayingChange?.(false);
        }}
        onError={() => {
          setIsLoading(false);
          setError("Audio could not be loaded.");
        }}
      />
    );
  }, [duration, onPlayingChange, onProgress, onTimeUpdate, source]);

  if (!visible || !source) return null;

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      void audioRef.current.play().catch((playError) => {
        setError(playError instanceof Error ? playError.message : "Audio could not be played.");
      });
    } else {
      audioRef.current.pause();
    }
  };

  const seekTo = (value: number) => {
    if (!audioRef.current) return;
    const nextTime = clampTime(value, duration);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    onTimeUpdate?.(nextTime, duration);
  };

  return (
    <div className={cn("fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur")} data-testid="bottom-mini-player">
      <div className="mx-auto max-w-3xl">
        <MiniAudioPlayer
          source={source}
          title={title}
          subtitle={subtitle}
          isPlaying={isPlaying}
          isLoading={isLoading}
          error={error}
          currentTime={currentTime}
          duration={duration}
          speed={1}
          volume={volume}
          muted={muted}
          audioElement={audioElement}
          onTogglePlayback={togglePlayback}
          onSeek={seekTo}
          onSkip={(delta) => seekTo(currentTime + delta)}
          onSpeedChange={() => undefined}
          onVolumeChange={setVolume}
          onToggleMute={() => setMuted((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === " " || event.key.toLowerCase() === "k") {
              event.preventDefault();
              togglePlayback();
            }
          }}
        />
        <Button type="button" className="sr-only" onClick={togglePlayback} aria-label={isPlaying ? "Pause synchronized Bible audio" : "Play synchronized Bible audio"}>
          {isLoading ? <Loader2 aria-hidden="true" /> : isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
