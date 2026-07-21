from __future__ import annotations

import importlib
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..corpus import BenchmarkChapter
from ..models import ModelSpec, Transcript, WordTiming
from .base import SpeechModelAdapter


FASTER_WHISPER_MODELS = {
    "tiny": "Systran/faster-whisper-tiny",
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large-v3": "Systran/faster-whisper-large-v3",
}

SEED_AUDIO_ROOT = Path("supabase/seed/bible/audio1/open bible/extracted")
CHAPTER_AUDIO_PATHS = {
    "GEN_001": SEED_AUDIO_ROOT / "GEN" / "GEN_001.mp3",
    "MAT_005": SEED_AUDIO_ROOT / "MAT" / "MAT_005.mp3",
    "PSA_023": SEED_AUDIO_ROOT / "PSA" / "PSA_023.mp3",
    "ROM_008": SEED_AUDIO_ROOT / "ROM" / "ROM_008.mp3",
}


class FasterWhisperProviderError(RuntimeError):
    """Raised when Faster-Whisper cannot be used by the isolated evaluation lab."""


@dataclass(frozen=True)
class FasterWhisperRuntime:
    model_name: str
    resolved_model_name: str
    device: str
    compute_type: str
    language: str
    cached: bool


class FasterWhisperProvider(SpeechModelAdapter):
    """Runnable Faster-Whisper adapter for isolated benchmark transcript capture."""

    def __init__(
        self,
        spec: ModelSpec | None = None,
        *,
        model_name: str = "small",
        device: str | None = None,
        compute_type: str | None = None,
        language: str = "sw",
        transcription_options: dict[str, Any] | None = None,
    ) -> None:
        resolved_model_name = resolve_model_name(model_name)
        selected_device = device or detect_device()
        selected_compute_type = compute_type or default_compute_type(selected_device)
        super().__init__(
            spec
            or ModelSpec(
                id=f"faster-whisper-{model_name}",
                name=f"Faster Whisper {model_name.title()}",
                provider="faster-whisper",
            )
        )
        self.runtime = FasterWhisperRuntime(
            model_name=model_name,
            resolved_model_name=resolved_model_name,
            device=selected_device,
            compute_type=selected_compute_type,
            language=language,
            cached=is_model_cached(resolved_model_name),
        )
        self._model: Any | None = None
        self.transcription_options = dict(transcription_options or {})

    def transcribe(self, chapter: BenchmarkChapter, audio_path: Path | None) -> Transcript:
        selected_audio = resolve_audio_path(chapter.id, audio_path)
        started_at = time.perf_counter()
        options = {
            "language": self.runtime.language,
            "word_timestamps": True,
            **self.transcription_options,
        }
        segments, info = self._whisper_model().transcribe(
            str(selected_audio),
            **options,
        )
        segment_payloads: list[dict[str, Any]] = []
        words: list[WordTiming] = []
        text_parts: list[str] = []
        for segment in segments:
            segment_payloads.append(
                {
                    "id": getattr(segment, "id", None),
                    "start_ms": _seconds_to_ms(segment.start),
                    "end_ms": _seconds_to_ms(segment.end),
                    "text": segment.text.strip(),
                    "avg_logprob": getattr(segment, "avg_logprob", None),
                    "no_speech_prob": getattr(segment, "no_speech_prob", None),
                }
            )
            if segment.text:
                text_parts.append(segment.text.strip())
            for word in segment.words or []:
                words.append(
                    WordTiming(
                        word=str(word.word).strip(),
                        start_ms=_seconds_to_ms(word.start),
                        end_ms=_seconds_to_ms(word.end),
                        confidence=getattr(word, "probability", None),
                        verse=None,
                    )
                )
        runtime_seconds = time.perf_counter() - started_at
        return Transcript(
            chapter_id=chapter.id,
            text=" ".join(part for part in text_parts if part),
            words=words,
            verse_boundaries=[],
            metadata={
                "provider": "faster-whisper",
                "model_name": self.runtime.model_name,
                "resolved_model_name": self.runtime.resolved_model_name,
                "device": self.runtime.device,
                "compute_type": self.runtime.compute_type,
                "language": self.runtime.language,
                "model_cached_before_run": self.runtime.cached,
                "audio_path": str(selected_audio),
                "transcription_runtime_seconds": runtime_seconds,
                "detected_language": getattr(info, "language", None),
                "detected_language_probability": getattr(info, "language_probability", None),
                "duration_seconds": getattr(info, "duration", None),
                "segments": segment_payloads,
                "transcription_options": self.transcription_options,
            },
        )

    def _whisper_model(self):
        if self._model is not None:
            return self._model
        try:
            faster_whisper = importlib.import_module("faster_whisper")
        except ImportError as exc:
            raise FasterWhisperProviderError(
                "faster-whisper is required for the runnable Faster-Whisper provider. "
                "Install the evaluation environment dependencies before transcribing."
            ) from exc
        self._model = faster_whisper.WhisperModel(
            self.runtime.resolved_model_name,
            device=self.runtime.device,
            compute_type=self.runtime.compute_type,
        )
        return self._model


def resolve_model_name(model_name: str) -> str:
    return FASTER_WHISPER_MODELS.get(model_name, model_name)


def detect_device() -> str:
    try:
        torch = importlib.import_module("torch")
    except ImportError:
        return "cpu"
    return "cuda" if bool(torch.cuda.is_available()) else "cpu"


def default_compute_type(device: str) -> str:
    return "float16" if device == "cuda" else "int8"


def is_model_cached(model_name: str) -> bool:
    try:
        huggingface_hub = importlib.import_module("huggingface_hub")
    except ImportError:
        return False
    try:
        return bool(huggingface_hub.try_to_load_from_cache(model_name, "config.json"))
    except Exception:
        return False


def resolve_audio_path(chapter_id: str, audio_path: str | Path | None = None) -> Path:
    if audio_path is not None:
        path = Path(audio_path)
    else:
        try:
            path = CHAPTER_AUDIO_PATHS[chapter_id]
        except KeyError as exc:
            raise FileNotFoundError(f"No automatic audio mapping is configured for {chapter_id}") from exc
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found for {chapter_id}: {path}")
    return path


def _seconds_to_ms(value: float | None) -> int | None:
    if value is None:
        return None
    return round(float(value) * 1000)
