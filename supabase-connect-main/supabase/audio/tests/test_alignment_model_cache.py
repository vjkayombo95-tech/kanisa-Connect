"""Regression tests for alignment model cache selection."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

from speech import whisperx_engine


class FakeWhisperX:
    """Capture alignment model loader arguments."""

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def load_align_model(self, **kwargs: object) -> tuple[object, dict[str, object]]:
        self.calls.append(kwargs)
        return object(), {"language": kwargs.get("language_code")}


def test_cached_torchaudio_alignment_model_uses_default_cache(monkeypatch, caplog) -> None:
    """An existing torchaudio cache should be reused without a custom model_dir."""

    fake_whisperx = FakeWhisperX()
    monkeypatch.setitem(sys.modules, "whisperx", fake_whisperx)
    monkeypatch.setattr(
        whisperx_engine,
        "_torchaudio_alignment_cache_has_model",
        lambda: True,
    )
    engine = whisperx_engine.WhisperXSpeechEngine(
        SimpleNamespace(alignment_model_dir=None)
    )

    engine._load_alignment_model("en")

    assert fake_whisperx.calls == [{"language_code": "en", "device": "cpu"}]
    assert "Using cached torchaudio alignment model." in caplog.text


def test_explicit_alignment_model_dir_is_preserved(monkeypatch, tmp_path: Path) -> None:
    """Custom alignment model directories should still be honored when configured."""

    fake_whisperx = FakeWhisperX()
    custom_dir = tmp_path / "alignment models"
    monkeypatch.setitem(sys.modules, "whisperx", fake_whisperx)
    monkeypatch.setattr(
        whisperx_engine,
        "_torchaudio_alignment_cache_has_model",
        lambda: True,
    )
    engine = whisperx_engine.WhisperXSpeechEngine(
        SimpleNamespace(alignment_model_dir=custom_dir)
    )

    engine._load_alignment_model("en")

    assert fake_whisperx.calls == [
        {"language_code": "en", "device": "cpu", "model_dir": str(custom_dir)}
    ]
    assert custom_dir.exists()
