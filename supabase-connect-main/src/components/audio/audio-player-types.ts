import type React from "react";
import type { UniversalAudioTrack } from "@/types/universal-audio";

export type AudioPlayerVariant = "mini" | "expanded" | "full";

export type UniversalAudioPlayerSource = {
  id?: string | null;
  title: string;
  subtitle?: string | null;
  src: string;
  durationSeconds?: number | null;
  mimeType?: string | null;
};

export type UniversalAudioPlayerPersistence = {
  userId: string;
  churchId: string;
  contentId: string;
  trackId?: string | null;
};

export type UniversalAudioPlayerEvent = {
  currentTime: number;
  duration: number;
  source: UniversalAudioPlayerSource;
};

export type UniversalAudioPlayerProps = {
  source?: UniversalAudioPlayerSource | null;
  contentId?: string | null;
  title?: string;
  subtitle?: string | null;
  variant?: AudioPlayerVariant;
  persistence?: UniversalAudioPlayerPersistence | null;
  className?: string;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto";
  disabled?: boolean;
  onPlay?: (event: UniversalAudioPlayerEvent) => void;
  onPause?: (event: UniversalAudioPlayerEvent) => void;
  onSeek?: (event: UniversalAudioPlayerEvent) => void;
  onProgress?: (event: UniversalAudioPlayerEvent) => void;
  onTimeUpdate?: (event: UniversalAudioPlayerEvent) => void;
  onEnded?: (event: UniversalAudioPlayerEvent) => void;
  onSpeedChanged?: (speed: number) => void;
};

export type AudioPlayerViewProps = {
  source: UniversalAudioPlayerSource;
  title: string;
  subtitle?: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  speed: number;
  volume: number;
  muted: boolean;
  disabled?: boolean;
  className?: string;
  audioElement: React.ReactNode;
  onTogglePlayback: () => void;
  onSeek: (value: number) => void;
  onSkip: (deltaSeconds: number) => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
};

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds}`;
  return `${minutes}:${seconds}`;
}

export function sourceFromTrack(track: UniversalAudioTrack): UniversalAudioPlayerSource | null {
  if (!track.stream_url) return null;
  return {
    id: track.id,
    title: track.title,
    subtitle: track.subtitle,
    src: track.stream_url,
    durationSeconds: track.duration_seconds,
    mimeType: track.mime_type,
  };
}
