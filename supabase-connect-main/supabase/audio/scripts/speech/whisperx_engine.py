"""WhisperX speech engine adapter."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from lib.config import PipelineConfig
from lib.exceptions import AlignmentError, TranscriptionError
from lib.logger import get_logger

from .base import SpeechEngine
from .types import StandardTranscript, TranscriptSegment, WordTimestamp

LOGGER = get_logger("speech.whisperx")


class WhisperXSpeechEngine(SpeechEngine):
    """Speech engine adapter that preserves the existing WhisperX behavior."""

    def __init__(self, config: PipelineConfig) -> None:
        self.config = config
        self._transcription_model: Any | None = None
        self._alignment_models: dict[str, tuple[Any, dict[str, Any]]] = {}

    def process(self, audio_path: Path) -> StandardTranscript:
        """Run WhisperX transcription and alignment as one provider operation."""

        transcript = self._transcribe(audio_path)
        return self._align(audio_path, transcript)

    def _transcribe(self, audio_path: Path) -> StandardTranscript:
        """Transcribe an audio file with WhisperX on CPU."""

        try:
            model = self._load_transcription_model()
            payload = model.transcribe(
                str(audio_path),
                batch_size=self.config.whisper_batch_size,
                language=self.config.speech_language,
            )
        except Exception as exc:
            raise TranscriptionError(
                f"Transcription failed for {audio_path}: {exc}"
            ) from exc
        return self._transcript_from_whisperx(payload)

    def _align(self, audio_path: Path, transcript: StandardTranscript) -> StandardTranscript:
        """Align a transcript with WhisperX forced alignment."""

        if not transcript.segments:
            raise AlignmentError("Cannot align an empty transcription")
        try:
            self._prepare_runtime_cache()
            import whisperx

            language = self.config.alignment_language or transcript.language
            model, metadata = self._load_alignment_model(language)
            aligned = whisperx.align(
                transcript.segment_dicts(),
                model,
                metadata,
                str(audio_path),
                device="cpu",
                return_char_alignments=False,
            )
        except Exception as exc:
            raise AlignmentError(f"WhisperX forced alignment failed: {exc}") from exc
        if not isinstance(aligned, dict):
            raise AlignmentError("WhisperX returned an invalid alignment payload")
        return self._aligned_transcript_from_whisperx(aligned, transcript)

    def supported_languages(self) -> list[str]:
        """Return configured language support for this adapter."""

        languages = {self.config.speech_language}
        if self.config.alignment_language:
            languages.add(self.config.alignment_language)
        return sorted(languages)

    def model_info(self) -> dict[str, Any]:
        """Return non-secret model information."""

        return {
            "provider": "whisperx",
            "transcription_engine": f"whisperx-{self.config.speech_transcription_model}",
            "alignment_engine": "whisperx-forced-aligner",
            "transcription_model": self.config.speech_transcription_model,
            "alignment_model": self.config.speech_alignment_model,
            "language": self.config.speech_language,
            "alignment_language": self.config.alignment_language,
            "compute_type": self.config.whisper_compute_type,
        }

    def health_check(self) -> dict[str, Any]:
        """Return a lightweight adapter health payload without loading models."""

        return {
            "provider": "whisperx",
            "available": True,
            "models_dir": str(self.config.models_dir),
            "cache_dir": str(self.config.cache_dir),
        }

    def _load_transcription_model(self) -> Any:
        """Load and cache the WhisperX ASR model for CPU inference."""

        if self._transcription_model is not None:
            return self._transcription_model

        try:
            self._prepare_runtime_cache()
            import whisperx

            self.config.models_dir.mkdir(parents=True, exist_ok=True)
            self._transcription_model = whisperx.load_model(
                self.config.speech_transcription_model,
                device="cpu",
                compute_type=self.config.whisper_compute_type,
                language=self.config.speech_language,
                download_root=str(self.config.models_dir),
            )
        except Exception as exc:
            raise TranscriptionError(
                "Unable to load WhisperX model "
                f"'{self.config.speech_transcription_model}' on CPU: {exc}"
            ) from exc

        return self._transcription_model

    def _load_alignment_model(self, language: str) -> tuple[Any, dict[str, Any]]:
        """Load and cache the WhisperX alignment model for a language."""

        language_code = language or "en"
        if language_code in self._alignment_models:
            return self._alignment_models[language_code]

        try:
            import whisperx

            kwargs: dict[str, Any] = {}
            if self.config.alignment_model_dir is not None:
                self.config.alignment_model_dir.mkdir(parents=True, exist_ok=True)
                kwargs["model_dir"] = str(self.config.alignment_model_dir)
            elif _torchaudio_alignment_cache_has_model():
                LOGGER.info("Using cached torchaudio alignment model.")

            model, metadata = whisperx.load_align_model(
                language_code=language_code,
                device="cpu",
                **kwargs,
            )
        except Exception as exc:
            raise AlignmentError(
                f"Unable to load WhisperX alignment model for '{language_code}': {exc}"
            ) from exc

        self._alignment_models[language_code] = (model, metadata)
        return model, metadata

    def _prepare_runtime_cache(self) -> None:
        """Point ML library caches at writable project directories."""

        matplotlib_cache = self.config.cache_dir / "matplotlib"
        matplotlib_cache.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("MPLCONFIGDIR", str(matplotlib_cache))

    def _transcript_from_whisperx(self, payload: dict[str, Any]) -> StandardTranscript:
        """Normalize WhisperX transcription output."""

        raw_segments = payload.get("segments", [])
        if not isinstance(raw_segments, list):
            raise TranscriptionError("WhisperX returned an invalid segments payload")

        segments: list[TranscriptSegment] = []
        for segment in raw_segments:
            if not isinstance(segment, dict):
                continue
            segments.append(
                TranscriptSegment(
                    start=float(segment.get("start", 0.0)),
                    end=float(segment.get("end", 0.0)),
                    text=str(segment.get("text", "")),
                    confidence=(
                        float(segment["avg_logprob"])
                        if segment.get("avg_logprob") is not None
                        else None
                    ),
                )
            )
        if not segments:
            raise TranscriptionError("WhisperX did not produce any transcription segments")

        text = " ".join(segment.text.strip() for segment in segments)
        text = " ".join(text.split())
        return StandardTranscript(
            language=str(payload.get("language") or self.config.speech_language),
            text=text,
            segments=segments,
            metadata={"provider": "whisperx"},
        )

    def _aligned_transcript_from_whisperx(
        self,
        payload: dict[str, Any],
        transcript: StandardTranscript,
    ) -> StandardTranscript:
        """Normalize WhisperX alignment output."""

        return StandardTranscript(
            language=transcript.language,
            text=transcript.text,
            segments=_segments_from_aligned_payload(payload, transcript.segments),
            words=_word_timestamps_from_payload(payload),
            metadata={
                **transcript.metadata,
                "alignment_provider": "whisperx",
            },
        )


def _segments_from_aligned_payload(
    payload: dict[str, Any],
    fallback: list[TranscriptSegment],
) -> list[TranscriptSegment]:
    """Extract normalized segments from an aligned payload."""

    raw_segments = payload.get("segments", [])
    if not isinstance(raw_segments, list) or not raw_segments:
        return fallback

    segments: list[TranscriptSegment] = []
    for segment in raw_segments:
        if not isinstance(segment, dict):
            continue
        segments.append(
            TranscriptSegment(
                start=float(segment.get("start", 0.0)),
                end=float(segment.get("end", 0.0)),
                text=str(segment.get("text", "")),
                confidence=(
                    float(segment["avg_logprob"])
                    if segment.get("avg_logprob") is not None
                    else None
                ),
            )
        )
    return segments or fallback


def _word_timestamps_from_payload(payload: dict[str, Any]) -> list[WordTimestamp]:
    """Extract provider-neutral word timestamps from WhisperX output."""

    raw_words = payload.get("word_segments", [])
    words = _word_timestamps_from_raw_words(raw_words)
    if words:
        return words

    segment_words: list[dict[str, Any]] = []
    for segment in payload.get("segments", []):
        if not isinstance(segment, dict):
            continue
        raw_segment_words = segment.get("words", [])
        if isinstance(raw_segment_words, list):
            segment_words.extend(raw_segment_words)
    words = _word_timestamps_from_raw_words(segment_words)
    if not words:
        raise AlignmentError("WhisperX did not produce word-level timestamps")
    return words


def _word_timestamps_from_raw_words(raw_words: object) -> list[WordTimestamp]:
    """Convert raw word dicts into normalized word timestamps."""

    words: list[WordTimestamp] = []
    if not isinstance(raw_words, list):
        return words
    for word in raw_words:
        if not isinstance(word, dict):
            continue
        if "start" not in word or "end" not in word:
            continue
        words.append(
            WordTimestamp(
                text=str(word.get("word", "")).strip(),
                start=float(word["start"]),
                end=float(word["end"]),
                confidence=(
                    float(word["score"]) if word.get("score") is not None else None
                ),
            )
        )
    return words


def _torchaudio_alignment_cache_has_model() -> bool:
    """Return whether the default torch hub torchaudio model cache is populated."""

    cache_dir = _torchaudio_alignment_cache_dir()
    return cache_dir.exists() and any(path.is_file() for path in cache_dir.rglob("*"))


def _torchaudio_alignment_cache_dir() -> Path:
    """Return torchaudio's default alignment model cache directory."""

    try:
        import torch

        return Path(torch.hub.get_dir()) / "torchaudio" / "models"
    except Exception:
        return Path.home() / ".cache" / "torch" / "hub" / "torchaudio" / "models"
