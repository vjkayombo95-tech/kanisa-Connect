import { AlertCircle, Loader2, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatAudioTime, PLAYBACK_SPEEDS, type AudioPlayerViewProps } from "./audio-player-types";

export function ExpandedAudioPlayer({
  title,
  subtitle,
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
  onTogglePlayback,
  onSeek,
  onSkip,
  onSpeedChange,
  onVolumeChange,
  onToggleMute,
  onKeyDown,
}: AudioPlayerViewProps) {
  return (
    <Card
      className={cn("rounded-lg border-border bg-card shadow-sm", className)}
      aria-label="Audio player"
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-testid="universal-audio-expanded-player"
    >
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{title}</p>
            {subtitle ? <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
            <span aria-label="Current time">{formatAudioTime(currentTime)}</span>
            <span aria-hidden="true"> / </span>
            <span aria-label="Duration">{formatAudioTime(duration)}</span>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" className="rounded-lg" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Audio unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Slider value={[currentTime]} min={0} max={duration || 1} step={0.25} onValueChange={(value) => onSeek(value[0] ?? 0)} aria-label="Seek audio" disabled={disabled || !!error} />
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-lg" onClick={() => onSkip(-10)} disabled={disabled || !!error} aria-label="Skip back 10 seconds">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button type="button" className="h-12 min-w-32 rounded-lg" onClick={onTogglePlayback} disabled={disabled || isLoading || !!error} aria-label={isPlaying ? "Pause audio" : "Play audio"}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> : isPlaying ? <Pause className="mr-2 h-5 w-5" aria-hidden="true" /> : <Play className="mr-2 h-5 w-5" aria-hidden="true" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-lg" onClick={() => onSkip(10)} disabled={disabled || !!error} aria-label="Skip forward 10 seconds">
              <RotateCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="universal-audio-speed">Playback speed</Label>
              <select
                id="universal-audio-speed"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={String(speed)}
                onChange={(event) => onSpeedChange(Number(event.currentTarget.value))}
                aria-label="Playback speed"
              >
                {PLAYBACK_SPEEDS.map((value) => (
                  <option key={value} value={value}>
                    {value}x
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="universal-audio-volume">Volume</Label>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onToggleMute} aria-label={muted ? "Unmute audio" : "Mute audio"}>
                  {muted || volume === 0 ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
              <Slider id="universal-audio-volume" value={[muted ? 0 : volume]} min={0} max={1} step={0.05} onValueChange={(value) => onVolumeChange(value[0] ?? 1)} aria-label="Volume" disabled={disabled} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="sr-only">Keyboard shortcuts: </span>
            Space/K play or pause, arrows skip, M mute.
          </p>
        </div>

        {audioElement}
      </CardContent>
    </Card>
  );
}
