from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from ..corpus import BenchmarkChapter
from ..models import ModelSpec, Transcript


class SpeechModelAdapter(ABC):
    """Adapter boundary for speech engines under evaluation."""

    def __init__(self, spec: ModelSpec) -> None:
        self.spec = spec

    @abstractmethod
    def transcribe(self, chapter: BenchmarkChapter, audio_path: Path | None) -> Transcript:
        raise NotImplementedError
