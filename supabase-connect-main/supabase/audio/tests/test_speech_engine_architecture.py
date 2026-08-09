"""Tests for provider-neutral speech engine architecture."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from lib.exceptions import ConfigurationError
from speech.factory import create_speech_engine
from speech.placeholders import FasterWhisperSpeechEngine
from speech.types import StandardTranscript, TranscriptSegment, WordTimestamp
from speech.whisperx_engine import WhisperXSpeechEngine


def _config(provider: str) -> SimpleNamespace:
    """Return a minimal speech-engine config for factory tests."""

    return SimpleNamespace(
        speech_engine_provider=provider,
        speech_transcription_model="base",
        speech_alignment_model=None,
        speech_language="sw",
        alignment_language="en",
        whisper_compute_type="float32",
        alignment_model_dir=None,
        models_dir=Path("models"),
        cache_dir=Path("cache"),
    )


def test_standard_transcript_schema_is_provider_neutral() -> None:
    """The indexer-facing transcript schema should not expose backend APIs."""

    transcript = StandardTranscript(
        language="sw",
        text="Hapo mwanzo",
        segments=[TranscriptSegment(start=1.0, end=2.0, text="Hapo mwanzo")],
        words=[WordTimestamp(text="Hapo", start=1.0, end=1.2, confidence=0.9)],
        metadata={"provider": "test"},
    )

    assert transcript.segment_dicts() == [
        {"start": 1.0, "end": 2.0, "text": "Hapo mwanzo"}
    ]
    assert transcript.word_dicts() == [
        {"word": "Hapo", "start": 1.0, "end": 1.2, "score": 0.9}
    ]
    assert transcript.to_dict()["words"][0]["text"] == "Hapo"
    assert transcript.to_dict()["words"][0]["confidence"] == 0.9


def test_factory_returns_whisperx_adapter_for_default_provider() -> None:
    """WhisperX should remain the concrete production provider."""

    engine = create_speech_engine(_config("whisperx"))

    assert isinstance(engine, WhisperXSpeechEngine)
    assert engine.model_info()["transcription_engine"] == "whisperx-base"
    assert engine.model_info()["alignment_engine"] == "whisperx-forced-aligner"


def test_future_provider_is_interface_placeholder() -> None:
    """Future providers should exist without silently running unsupported models."""

    engine = create_speech_engine(_config("faster_whisper"))

    assert isinstance(engine, FasterWhisperSpeechEngine)
    assert engine.health_check()["available"] is False
    with pytest.raises(ConfigurationError):
        engine.process(Path("chapter.mp3"))


def test_no_whisperx_imports_outside_adapter() -> None:
    """Only the WhisperX adapter should import the WhisperX framework."""

    scripts_dir = Path(__file__).resolve().parents[1] / "scripts"
    offenders: list[Path] = []
    for path in scripts_dir.rglob("*.py"):
        if path.name == "whisperx_engine.py":
            continue
        text = path.read_text(encoding="utf-8")
        if "import whisperx" in text or "from whisperx" in text:
            offenders.append(path.relative_to(scripts_dir))

    assert offenders == []
