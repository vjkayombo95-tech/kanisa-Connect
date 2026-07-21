"""Speech engine factory."""

from __future__ import annotations

from functools import lru_cache

from lib.config import CONFIG, PipelineConfig
from lib.exceptions import ConfigurationError

from .base import SpeechEngine
from .placeholders import (
    CustomAlignmentSpeechEngine,
    FasterWhisperSpeechEngine,
    MMSSpeechEngine,
    ParakeetSpeechEngine,
)
from .whisperx_engine import WhisperXSpeechEngine

PROVIDER_REGISTRY = {
    "whisperx": WhisperXSpeechEngine,
    "faster_whisper": FasterWhisperSpeechEngine,
    "parakeet": ParakeetSpeechEngine,
    "mms": MMSSpeechEngine,
    "mms_alignment": MMSSpeechEngine,
    "custom_alignment": CustomAlignmentSpeechEngine,
}


@lru_cache(maxsize=1)
def get_speech_engine() -> SpeechEngine:
    """Return the configured speech engine."""

    return create_speech_engine(CONFIG)


def create_speech_engine(config: PipelineConfig) -> SpeechEngine:
    """Instantiate a speech engine from pipeline configuration."""

    provider = config.speech_engine_provider
    provider_class = PROVIDER_REGISTRY.get(provider)
    if provider_class is not None:
        return provider_class(config)
    raise ConfigurationError(f"Unsupported speech engine provider: {provider}")


def registered_provider_names(*, include_aliases: bool = False) -> list[str]:
    """Return registered speech engine provider names."""

    names = sorted(PROVIDER_REGISTRY)
    if include_aliases:
        return names
    return [name for name in names if name != "mms_alignment"]
