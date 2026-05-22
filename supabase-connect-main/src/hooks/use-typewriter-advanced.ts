import { useEffect, useMemo, useRef, useState } from "react";

type TypewriterTiming = {
  early: number;
  middle: number;
  late: number;
  space: number;
  comma: number;
  punctuation: number;
  strongPunctuation: number;
  punctuationBump: number;
};

type UseTypewriterAdvancedOptions = {
  enabled?: boolean;
  startDelay?: number;
  resetKey?: string | number;
  timing?: Partial<TypewriterTiming>;
  onCharacterTyped?: (payload: { char: string; index: number }) => void;
};

type UseTypewriterAdvancedResult = {
  displayedText: string;
  currentWordIndex: number;
  isTyping: boolean;
};

const WORD_REGEX = /[A-Za-z0-9'-]+/g;

const DEFAULT_TIMING: TypewriterTiming = {
  early: 32,
  middle: 25,
  late: 29,
  space: 64,
  comma: 300,
  punctuation: 500,
  strongPunctuation: 420,
  punctuationBump: 8,
};

function countStartedWords(text: string) {
  const matches = text.match(WORD_REGEX);
  return matches ? matches.length : 0;
}

function isWordCharacter(character: string) {
  return /[A-Za-z0-9'-]/.test(character);
}

function getDelay(
  currentChar: string,
  nextChar: string | undefined,
  progress: number,
  timing: TypewriterTiming,
) {
  let delay = timing.early;

  if (currentChar === " ") {
    delay = timing.space;
  } else if (currentChar === ",") {
    delay = timing.comma;
  } else if (currentChar === "." || currentChar === ":" || currentChar === ";") {
    delay = timing.punctuation;
  } else if (currentChar === "!" || currentChar === "?") {
    delay = timing.strongPunctuation;
  } else {
    if (progress > 0.28 && progress < 0.78) {
      delay = timing.middle;
    } else if (progress >= 0.78) {
      delay = timing.late;
    }

    if (nextChar && !isWordCharacter(nextChar)) {
      delay += timing.punctuationBump;
    }
  }

  return delay;
}

export function useTypewriterAdvanced(
  text: string,
  options: UseTypewriterAdvancedOptions = {},
): UseTypewriterAdvancedResult {
  const {
    enabled = true,
    startDelay = 200,
    resetKey,
    timing,
    onCharacterTyped,
  } = options;
  const [displayedText, setDisplayedText] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const normalizedText = useMemo(() => text ?? "", [text]);
  const mergedTiming = useMemo(() => ({ ...DEFAULT_TIMING, ...timing }), [timing]);

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!enabled || !normalizedText.trim()) {
      setDisplayedText("");
      setCurrentWordIndex(-1);
      setIsTyping(false);
      return;
    }

    let cancelled = false;
    let currentIndex = 0;

    setDisplayedText("");
    setCurrentWordIndex(-1);
    setIsTyping(true);

    const typeNextCharacter = () => {
      if (cancelled) {
        return;
      }

      if (currentIndex >= normalizedText.length) {
        setIsTyping(false);
        return;
      }

      currentIndex += 1;
      const nextDisplayedText = normalizedText.slice(0, currentIndex);
      const startedWords = countStartedWords(nextDisplayedText);
      const currentChar = normalizedText[currentIndex - 1];
      const nextChar = normalizedText[currentIndex];
      const progress = currentIndex / normalizedText.length;

      setDisplayedText(nextDisplayedText);
      setCurrentWordIndex(startedWords > 0 ? startedWords - 1 : -1);
      onCharacterTyped?.({ char: currentChar, index: currentIndex - 1 });

      const delay = getDelay(currentChar, nextChar, progress, mergedTiming);
      timeoutRef.current = window.setTimeout(typeNextCharacter, delay);
    };

    timeoutRef.current = window.setTimeout(typeNextCharacter, startDelay);

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, text, normalizedText, startDelay, resetKey, mergedTiming, onCharacterTyped]);

  return { displayedText, currentWordIndex, isTyping };
}
