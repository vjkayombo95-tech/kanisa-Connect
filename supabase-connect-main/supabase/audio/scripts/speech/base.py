"""Abstract speech engine contract."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from .types import StandardTranscript


class SpeechEngine(ABC):
    """Provider-neutral speech recognition and alignment interface."""

    @abstractmethod
    def process(self, audio_path: Path) -> StandardTranscript:
        """Return a complete standardized transcript for an audio file."""

    @abstractmethod
    def supported_languages(self) -> list[str]:
        """Return language codes supported by this engine configuration."""

    @abstractmethod
    def model_info(self) -> dict[str, Any]:
        """Return non-secret model and provider metadata."""

    @abstractmethod
    def health_check(self) -> dict[str, Any]:
        """Return a lightweight provider health payload."""
