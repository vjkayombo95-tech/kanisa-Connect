"""Standard transcript schema shared by speech providers."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class TranscriptSegment:
    """A contiguous transcript segment emitted by a speech backend."""

    start: float
    end: float
    text: str
    confidence: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-safe segment payload."""

        data = asdict(self)
        if self.confidence is None:
            data.pop("confidence")
        if not self.metadata:
            data.pop("metadata")
        return data


@dataclass(frozen=True)
class WordTimestamp:
    """A normalized word-level timestamp with optional confidence."""

    text: str
    start: float
    end: float
    confidence: float | None = None
    speaker: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a provider-neutral JSON-safe word payload."""

        data: dict[str, Any] = {
            "text": self.text,
            "start": self.start,
            "end": self.end,
            "confidence": self.confidence,
        }
        if self.speaker is not None:
            data["speaker"] = self.speaker
        if self.metadata:
            data["metadata"] = self.metadata
        return data

    def to_legacy_word_segment(self) -> dict[str, Any]:
        """Return the existing alignment artifact word segment shape."""

        data: dict[str, Any] = {
            "word": self.text,
            "start": self.start,
            "end": self.end,
            "score": self.confidence,
        }
        if self.speaker is not None:
            data["speaker"] = self.speaker
        if self.metadata:
            data["metadata"] = self.metadata
        return data


@dataclass(frozen=True)
class StandardTranscript:
    """Provider-neutral transcript consumed by indexing and QA stages."""

    language: str
    text: str
    segments: list[TranscriptSegment] = field(default_factory=list)
    words: list[WordTimestamp] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-safe transcript payload."""

        return {
            "language": self.language,
            "text": self.text,
            "segments": [segment.to_dict() for segment in self.segments],
            "words": [word.to_dict() for word in self.words],
            "metadata": self.metadata,
        }

    def segment_dicts(self) -> list[dict[str, Any]]:
        """Return legacy-compatible segment dictionaries."""

        return [segment.to_dict() for segment in self.segments]

    def word_dicts(self) -> list[dict[str, Any]]:
        """Return legacy-compatible word timestamp dictionaries."""

        return [word.to_legacy_word_segment() for word in self.words]
