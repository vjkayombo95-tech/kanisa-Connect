import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookMarked,
  LucideIcon,
  Maximize2,
  MessageSquare,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useTypewriterAdvanced } from "@/hooks/use-typewriter-advanced";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { supabase } from "@/integrations/supabase/client";
import type { PortalFeatureKey } from "@/lib/portal-features";

type VerseLanguage = "sw" | "en";

type BibleVerse = {
  id: string;
  verse_text: string;
  reference: string;
  language: VerseLanguage;
};

const LANGUAGE_STORAGE_KEY = "ecclesia-verse-language";
const SOUND_STORAGE_KEY = "ecclesia-verse-sound";

function AnimatedBibleIcon() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 bible-icon-shell">
      <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-xl bible-icon-aura" />
      <svg
        aria-hidden="true"
        className="relative z-10 h-8 w-8 text-primary"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bible-spine" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <path
          d="M18 12C13.5817 12 10 15.5817 10 20V46C10 50.4183 13.5817 54 18 54H48C50.2091 54 52 52.2091 52 50V18C52 14.6863 49.3137 12 46 12H18Z"
          fill="url(#bible-spine)"
          opacity="0.16"
        />
        <path
          d="M20 14H46C48.2091 14 50 15.7909 50 18V48C50 50.2091 48.2091 52 46 52H20C16.6863 52 14 49.3137 14 46V20C14 16.6863 16.6863 14 20 14Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M20 14V52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M26 22H40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <path d="M33 19V33" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <path d="M26 40H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        <path d="M26 45H37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      </svg>
    </div>
  );
}

function LanguageToggle({
  selectedLanguage,
  onChange,
}: {
  selectedLanguage: VerseLanguage;
  onChange: (language: VerseLanguage) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-primary/20 bg-background/40 p-1 backdrop-blur-sm">
      {(["sw", "en"] as VerseLanguage[]).map((language) => (
        <button
          key={language}
          type="button"
          onClick={() => onChange(language)}
          className={[
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200",
            selectedLanguage === language
              ? "bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(245,158,11,0.18)]"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
          aria-pressed={selectedLanguage === language}
        >
          {language}
        </button>
      ))}
    </div>
  );
}

function TypewriterVerseText({
  text,
  isVisible,
  resetKey,
  startDelay = 200,
  slower,
  onCharacterTyped,
}: {
  text: string;
  isVisible: boolean;
  resetKey: string;
  startDelay?: number;
  slower?: boolean;
  onCharacterTyped?: (payload: { char: string; index: number }) => void;
}) {
  const safeText = text ?? "";
  const hasText = Boolean(safeText.trim());

  const { displayedText, currentWordIndex, isTyping } = useTypewriterAdvanced(safeText, {
    enabled: isVisible && hasText,
    startDelay,
    resetKey,
    onCharacterTyped,
    timing: slower
      ? {
          early: 48,
          middle: 42,
          late: 46,
          space: 82,
          comma: 340,
          punctuation: 540,
          strongPunctuation: 460,
          punctuationBump: 10,
        }
      : undefined,
  });

  const words = useMemo(() => safeText.match(/[A-Za-z0-9'-]+/g) ?? [], [safeText]);
  const typedWordCount = useMemo(() => displayedText.match(/[A-Za-z0-9'-]+/g)?.length ?? 0, [displayedText]);
  const activeWord = currentWordIndex >= 0 ? words[currentWordIndex] : null;
  const completedWordCount = isTyping && activeWord && !displayedText.endsWith(activeWord)
    ? Math.max(typedWordCount - 1, 0)
    : typedWordCount;

  const segments = useMemo(() => {
    const tokenPattern = /([A-Za-z0-9'-]+|\s+|[^A-Za-z0-9'\s-]+)/g;
    return safeText.match(tokenPattern) ?? [];
  }, [safeText]);

  let traversedCharacters = 0;
  let traversedWordIndex = -1;

  return (
    <span className="typewriter-verse">
      <span className="typewriter-quote">"</span>
      {segments.map((segment, segmentIndex) => {
        const isWord = /^[A-Za-z0-9'-]+$/.test(segment);

        if (!isWord) {
          const nextTraversedCharacters = traversedCharacters + segment.length;
          const visiblePart = displayedText.slice(traversedCharacters, nextTraversedCharacters);
          traversedCharacters = nextTraversedCharacters;

          if (!visiblePart) {
            return null;
          }

          return (
            <span key={`${segment}-${segmentIndex}`} className="typewriter-char-flicker">
              {visiblePart}
            </span>
          );
        }

        traversedWordIndex += 1;
        const nextTraversedCharacters = traversedCharacters + segment.length;
        const visibleWord = displayedText.slice(traversedCharacters, nextTraversedCharacters);
        traversedCharacters = nextTraversedCharacters;

        if (!visibleWord) {
          return null;
        }

        const isActive = isTyping && traversedWordIndex === currentWordIndex;
        const isCompleted = traversedWordIndex < completedWordCount || (!isTyping && traversedWordIndex < typedWordCount);

        return (
          <span
            key={`${segment}-${segmentIndex}`}
            className={[
              "transition-all duration-200",
              isCompleted ? "text-foreground/95" : "",
              isActive ? "typewriter-word-active" : "",
            ].join(" ")}
          >
            {visibleWord}
          </span>
        );
      })}
      <span className="typewriter-quote">"</span>
      <span
        aria-hidden="true"
        className={[
          "typewriter-cursor",
          isTyping ? "typewriter-cursor-typing" : "typewriter-cursor-idle",
        ].join(" ")}
      >
        |
      </span>
    </span>
  );
}

function VerseFocusMode({
  isOpen,
  verse,
  language,
  soundEnabled,
  onClose,
  onCharacterTyped,
}: {
  isOpen: boolean;
  verse: BibleVerse | null;
  language: VerseLanguage;
  soundEnabled: boolean;
  onClose: () => void;
  onCharacterTyped?: (payload: { char: string; index: number }) => void;
}) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !verse?.verse_text) {
      setDisplayed("");
      return;
    }

    let index = 0;
    setDisplayed("");

    const text = verse.verse_text;
    const interval = window.setInterval(() => {
      index += 1;
      const nextSlice = text.slice(0, index);

      setDisplayed(nextSlice);
      onCharacterTyped?.({ char: text[index - 1] ?? "", index: index - 1 });

      if (index >= text.length) {
        window.clearInterval(interval);
      }
    }, 40);

    return () => window.clearInterval(interval);
  }, [isOpen, onCharacterTyped, verse?.id, verse?.verse_text]);

  if (!isOpen || !verse) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verse-focus-title"
    >
      <div
        className="verse-focus-panel relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-primary/20 bg-background/85 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] md:p-10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="verse-ambient verse-ambient-one" />
          <div className="verse-ambient verse-ambient-two" />
        </div>

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p id="verse-focus-title" className="text-xs font-medium uppercase tracking-[0.3em] text-primary">
              {language === "sw" ? "Neno la Leo" : "Verse of the Day"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {soundEnabled ? "Immersive reading with soft typing ambience" : "Immersive reading mode"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-primary/20 bg-background/50 p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close focus mode"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-10 space-y-6 text-center">
          <p className="mx-auto max-w-3xl text-2xl italic leading-relaxed text-foreground md:text-4xl md:leading-[1.7]">
            "{displayed}"
          </p>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/85 md:text-base">
            {verse.reference}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PortalHome() {
  const { churchId } = useAuth();
  const { isFeatureEnabled } = useFeatureAccess();
  const [selectedLanguage, setSelectedLanguage] = useState<VerseLanguage>(() => {
    if (typeof window === "undefined") {
      return "sw";
    }

    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "sw";
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SOUND_STORAGE_KEY) === "true";
  });
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const [isVerseVisible, setIsVerseVisible] = useState(false);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const charsSinceSoundRef = useRef(0);
  const nextSoundThresholdRef = useRef(2);
  const pendingRevealRef = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    window.localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => () => {
    if (pendingRevealRef.current) {
      window.clearTimeout(pendingRevealRef.current);
    }

    void audioContextRef.current?.close();
  }, []);

  const { data: verseRecords = [] } = useQuery({
    queryKey: ["portal-bible-verses", selectedLanguage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bible_verses")
        .select("id, text, reference")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return ((data ?? []) as Array<{ id: string; text: string; reference: string }>).map((verse) => ({
        id: verse.id,
        verse_text: verse.text,
        reference: verse.reference,
        language: selectedLanguage,
      }));
    },
    enabled: !!churchId && isFeatureEnabled("bible_verses"),
  });

  useEffect(() => {
    setIsVerseVisible(false);
    setIsFocusModeOpen(false);
    charsSinceSoundRef.current = 0;
  }, [selectedLanguage]);

  useEffect(() => {
    if (pendingRevealRef.current) {
      window.clearTimeout(pendingRevealRef.current);
      pendingRevealRef.current = null;
    }

    if (!verseRecords.length) {
      setVerses([]);
      setVerseIndex(0);
      pendingRevealRef.current = window.setTimeout(() => {
        setIsVerseVisible(true);
      }, 220);
      return;
    }

    setVerses(verseRecords);
    setVerseIndex(Math.floor(Math.random() * verseRecords.length));
    pendingRevealRef.current = window.setTimeout(() => {
      setIsVerseVisible(true);
    }, 220);

    return () => {
      if (pendingRevealRef.current) {
        window.clearTimeout(pendingRevealRef.current);
        pendingRevealRef.current = null;
      }
    };
  }, [verseRecords]);

  useEffect(() => {
    if (verses.length < 2 || isFocusModeOpen) {
      return;
    }

    let swapTimer: ReturnType<typeof setTimeout> | null = null;
    const cycleTimer = window.setInterval(() => {
      setIsVerseVisible(false);
      charsSinceSoundRef.current = 0;
      swapTimer = window.setTimeout(() => {
        setVerseIndex((current) => (current + 1) % verses.length);
        setIsVerseVisible(true);
      }, 220);
    }, 12000);

    return () => {
      window.clearInterval(cycleTimer);
      if (swapTimer) {
        window.clearTimeout(swapTimer);
      }
    };
  }, [isFocusModeOpen, verses]);

  const activeVerse = useMemo(() => verses[verseIndex] ?? null, [verseIndex, verses]);

  const playTypingSound = useCallback(async () => {
    if (!soundEnabled) {
      return;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;
    if (context.state === "suspended") {
      await context.resume();
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(1860, now);
    oscillator.frequency.exponentialRampToValueAtTime(1240, now + 0.045);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.02, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.07);
  }, [soundEnabled]);

  const handleCharacterTyped = useCallback((payload: { char: string; index: number }) => {
    if (!soundEnabled || !/\S/.test(payload.char)) {
      return;
    }

    charsSinceSoundRef.current += 1;
    if (charsSinceSoundRef.current < nextSoundThresholdRef.current) {
      return;
    }

    charsSinceSoundRef.current = 0;
    nextSoundThresholdRef.current = payload.index % 2 === 0 ? 2 : 3;
    void playTypingSound();
  }, [playTypingSound, soundEnabled]);

  const handleLanguageChange = useCallback((language: VerseLanguage) => {
    if (language === selectedLanguage) {
      return;
    }

    setIsVerseVisible(false);
    setSelectedLanguage(language);
  }, [selectedLanguage]);

  return (
    <>
      <div className="animate-fade-in px-4 py-8 md:px-6 lg:px-8">
        <section className="mx-auto max-w-5xl">
          <Card className="glass-card relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/8 via-background/90 to-transparent">
            <div className="pointer-events-none absolute inset-0">
              <div className="verse-ambient verse-ambient-one" />
              <div className="verse-ambient verse-ambient-two" />
              <span className="verse-particle verse-particle-one" />
              <span className="verse-particle verse-particle-two" />
              <span className="verse-particle verse-particle-three" />
            </div>

            <CardContent className="relative flex items-start gap-4 p-6 md:items-center md:gap-5">
              <AnimatedBibleIcon />

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">
                      {selectedLanguage === "sw" ? "Neno la Leo" : "Verse of the Day"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedLanguage === "sw" ? "Soma kwa utulivu na tafakari." : "Read slowly and reflect."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="space-y-1">
                      <LanguageToggle selectedLanguage={selectedLanguage} onChange={handleLanguageChange} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundEnabled((current) => !current)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-background/40 text-muted-foreground transition-all duration-200 hover:border-primary/35 hover:text-foreground"
                      aria-pressed={soundEnabled}
                      aria-label={soundEnabled ? "Mute typing sound" : "Enable typing sound"}
                    >
                      {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => activeVerse && setIsFocusModeOpen(true)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-background/40 text-muted-foreground transition-all duration-200 hover:border-primary/35 hover:text-foreground"
                      aria-label="Open focus mode"
                      disabled={!activeVerse}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {false && (
                  <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Advanced verse tools are LOCKED 🔒</span>
                    {" "}Upgrade to Intermediate or higher to unlock Focus Mode, typewriter sound, and premium verse interactions.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => activeVerse && setIsFocusModeOpen(true)}
                  className="block w-full rounded-2xl text-left transition-colors duration-200 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div className={isVerseVisible ? "verse-copy verse-copy-enter" : "verse-copy verse-copy-exit"} aria-live="polite">
                    {activeVerse ? (
                      <>
                        <p className="max-w-3xl text-sm italic leading-relaxed text-foreground md:text-base">
                          <TypewriterVerseText
                            text={activeVerse.verse_text}
                            isVisible={isVerseVisible && !isFocusModeOpen && Boolean(activeVerse?.verse_text?.trim())}
                            resetKey={`${selectedLanguage}-${activeVerse.id}-standard-${String(isFocusModeOpen)}`}
                            startDelay={200}
                            onCharacterTyped={handleCharacterTyped}
                          />
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {activeVerse.reference}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No verses available</p>
                    )}
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <VerseFocusMode
        isOpen={isFocusModeOpen}
        verse={activeVerse}
        language={selectedLanguage}
        soundEnabled={soundEnabled}
        onClose={() => setIsFocusModeOpen(false)}
        onCharacterTyped={handleCharacterTyped}
      />
    </>
  );
}
