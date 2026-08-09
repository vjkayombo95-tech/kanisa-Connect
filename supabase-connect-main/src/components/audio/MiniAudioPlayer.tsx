import { Loader2, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatAudioTime, type AudioPlayerViewProps } from "./audio-player-types";

export function MiniAudioPlayer({
  title,
  subtitle,
  isPlaying,
  isLoading,
  error,
  currentTime,
  duration,
  volume,
  muted,
  disabled,
  className,
  audioElement,
  onTogglePlayback,
  onSeek,
  onSkip,
  onVolumeChange,
  onToggleMute,
  onKeyDown,
}: AudioPlayerViewProps) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-card p-3 shadow-sm", className)}
      aria-label="Audio player"
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-testid="universal-audio-mini-player"
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-lg"
          onClick={onTogglePlayback}
          disabled={disabled || isLoading || !!error}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : isPlaying ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          {error ? <p className="text-xs font-medium text-destructive" role="alert">{error}</p> : null}
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => onSkip(-10)} disabled={disabled || !!error} aria-label="Skip back 10 seconds">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => onSkip(10)} disabled={disabled || !!error} aria-label="Skip forward 10 seconds">
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <Button type="button" variant="ghost" size="icon" className="hidden h-9 w-9 rounded-lg sm:inline-flex" onClick={onToggleMute} aria-label={muted ? "Unmute audio" : "Mute audio"}>
          {muted || volume === 0 ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs tabular-nums text-muted-foreground">
        <span aria-label="Current time">{formatAudioTime(currentTime)}</span>
        <Slider value={[currentTime]} min={0} max={duration || 1} step={0.25} onValueChange={(value) => onSeek(value[0] ?? 0)} aria-label="Seek audio" disabled={disabled || !!error} />
        <span aria-label="Duration">{formatAudioTime(duration)}</span>
      </div>

      <div className="sr-only">
        <label>
          Volume
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(event) => onVolumeChange(Number(event.currentTarget.value))} />
        </label>
      </div>
      {audioElement}
    </section>
  );
}
