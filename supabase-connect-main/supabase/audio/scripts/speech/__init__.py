"""Provider-based speech engine interfaces for the audio pipeline."""

from .base import SpeechEngine
from .factory import get_speech_engine
from .types import StandardTranscript, TranscriptSegment, WordTimestamp

__all__ = [
    "SpeechEngine",
    "StandardTranscript",
    "TranscriptSegment",
    "WordTimestamp",
    "get_speech_engine",
]
