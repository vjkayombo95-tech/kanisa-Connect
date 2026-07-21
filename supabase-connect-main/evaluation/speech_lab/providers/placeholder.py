from __future__ import annotations

from pathlib import Path

from ..corpus import BenchmarkChapter
from ..models import Transcript
from .base import SpeechModelAdapter


class PlaceholderProvider(SpeechModelAdapter):
    """Explicit non-production adapter for speech engines not wired into the lab yet."""

    def transcribe(self, chapter: BenchmarkChapter, audio_path: Path | None) -> Transcript:
        raise NotImplementedError(
            f"{self.spec.name} is registered but not implemented in the isolated evaluation lab. "
            "Use ManifestProvider for captured outputs or add a new adapter under evaluation/speech_lab/providers."
        )
