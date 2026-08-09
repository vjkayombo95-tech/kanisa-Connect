"""Future speech engine provider placeholders."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from lib.config import PipelineConfig
from lib.exceptions import ConfigurationError

from .base import SpeechEngine
from .types import StandardTranscript


class _PlaceholderSpeechEngine(SpeechEngine):
    """Interface-only provider used until a backend is integrated."""

    provider_name = "placeholder"

    def __init__(self, config: PipelineConfig) -> None:
        self.config = config

    def process(self, audio_path: Path) -> StandardTranscript:
        """Run the provider when an implementation is added."""

        raise ConfigurationError(
            f"{self.provider_name} is defined but not implemented yet"
        )

    def supported_languages(self) -> list[str]:
        return []

    def model_info(self) -> dict[str, Any]:
        return {
            "provider": self.provider_name,
            "implemented": False,
        }

    def health_check(self) -> dict[str, Any]:
        return {
            "provider": self.provider_name,
            "available": False,
            "reason": "Provider interface placeholder only",
        }


class FasterWhisperSpeechEngine(_PlaceholderSpeechEngine):
    """Future Faster Whisper provider contract."""

    provider_name = "faster_whisper"


class ParakeetSpeechEngine(_PlaceholderSpeechEngine):
    """Future NVIDIA Parakeet provider contract."""

    provider_name = "parakeet"


class MMSSpeechEngine(_PlaceholderSpeechEngine):
    """Future MMS speech provider contract."""

    provider_name = "mms"


class CustomAlignmentSpeechEngine(_PlaceholderSpeechEngine):
    """Future custom alignment provider contract."""

    provider_name = "custom_alignment"
