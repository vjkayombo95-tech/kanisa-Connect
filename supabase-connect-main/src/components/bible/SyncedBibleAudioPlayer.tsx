import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadCloud, Loader2, Pause, Play, Volume2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { findVerseAtTime, getVerseStartTime, type ApprovedChapterAudio } from "@/lib/member-audio";

type SyncedBibleAudioPlayerProps = {
  audio: ApprovedChapterAudio;
  book: string;
  chapter: number;
  seekRequest: { verse: number; nonce: number } | null;
  onActiveVerseChange: (verse: number | null) => void;
};

const SPEEDS = ["0.75", "1", "1.25", "1.5", "2"];
const SLEEP_TIMERS = ["off", "15", "30", "45", "60"];

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function progressKey(book: string, chapter: number) {
  return `kanisa:bible-audio-progress:${book}:${chapter}`;
}

export function SyncedBibleAudioPlayer({ audio, book, chapter, seekRequest, onActiveVerseChange }: SyncedBibleAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState("1");
  const [volume, setVolume] = useState(1);
  const [sleepTimer, setSleepTimer] = useState("off");
  const [lastSeekNonce, setLastSeekNonce] = useState(0);

  const activeVerse = useMemo(() => findVerseAtTime(audio.verses, currentTime), [audio.verses, currentTime]);

  useEffect(() => {
    onActiveVerseChange(activeVerse);
  }, [activeVerse, onActiveVerseChange]);

  useEffect(() => {
    const saved = window.localStorage.getItem(progressKey(book, chapter));
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { currentTime?: number };
      if (typeof parsed.currentTime === "number" && audioRef.current) {
        audioRef.current.currentTime = parsed.currentTime;
        setCurrentTime(parsed.currentTime);
      }
    } catch {
      window.localStorage.removeItem(progressKey(book, chapter));
    }
  }, [book, chapter, audio.audioUrl]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      window.localStorage.setItem(
        progressKey(book, chapter),
        JSON.stringify({ book, chapter, currentTime, lastVerse: activeVerse, updatedAt: new Date().toISOString() }),
      );
    }, 3000);

    return () => window.clearInterval(interval);
  }, [activeVerse, book, chapter, currentTime]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = Number(speed);
  }, [speed]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!seekRequest || seekRequest.nonce === lastSeekNonce) return;
    const start = getVerseStartTime(audio.verses, seekRequest.verse);
    if (start === null || !audioRef.current) return;
    audioRef.current.currentTime = start;
    setCurrentTime(start);
    setLastSeekNonce(seekRequest.nonce);
    void audioRef.current.play();
  }, [audio.verses, lastSeekNonce, seekRequest]);

  useEffect(() => {
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    if (sleepTimer === "off") return undefined;

    sleepTimerRef.current = window.setTimeout(() => {
      audioRef.current?.pause();
      setSleepTimer("off");
    }, Number(sleepTimer) * 60 * 1000);

    return () => {
      if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    };
  }, [sleepTimer]);

  const togglePlayback = async () => {
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
    <Card className="mx-auto max-w-3xl rounded-lg border-primary/20 bg-card/95 shadow-sm" data-testid="approved-bible-audio-player">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Play Audio</p>
            <p className="text-xs text-muted-foreground">Approved version {audio.versionNumber} with synchronized verse timing.</p>
          </div>
          <Badge variant="outline" className="w-fit border-border bg-muted text-muted-foreground">
            <DownloadCloud className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {audio.downloaded ? "Downloaded" : "Not Downloaded"}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" className="h-12 min-w-32 rounded-lg" onClick={() => void togglePlayback()} disabled={loading} aria-label={playing ? "Pause audio" : "Play audio"}>
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> : playing ? <Pause className="mr-2 h-5 w-5" aria-hidden="true" /> : <Play className="mr-2 h-5 w-5" aria-hidden="true" />}
            {playing ? "Pause" : "Play Audio"}
          </Button>
          <div className="min-w-0 flex-1 space-y-2">
            <Slider value={[currentTime]} max={duration || 1} step={0.25} onValueChange={seekTo} aria-label="Seek audio" />
            <div className="flex justify-between text-xs tabular-nums text-muted-foreground" aria-live="polite">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="audio-speed">Playback Speed</Label>
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger id="audio-speed" className="h-11 rounded-lg" aria-label="Playback speed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEEDS.map((value) => <SelectItem key={value} value={value}>{value}x</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audio-sleep">Sleep Timer</Label>
            <Select value={sleepTimer} onValueChange={setSleepTimer}>
              <SelectTrigger id="audio-sleep" className="h-11 rounded-lg" aria-label="Sleep timer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                {SLEEP_TIMERS.filter((value) => value !== "off").map((value) => <SelectItem key={value} value={value}>{value} minutes</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Volume2 className="h-4 w-4" aria-hidden="true" /> Volume</Label>
            <Slider value={[volume]} min={0} max={1} step={0.05} onValueChange={(value) => setVolume(value[0] ?? 1)} aria-label="Volume" className="h-11" />
          </div>
        </div>

        <audio
          ref={audioRef}
          src={audio.audioUrl}
          preload="metadata"
          onCanPlay={() => setLoading(false)}
          onLoadStart={() => setLoading(true)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0);
            setLoading(false);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
        />
      </CardContent>
    </Card>
  );
}
