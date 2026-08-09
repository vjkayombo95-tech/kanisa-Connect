"""Typed data models exchanged by audio pipeline stages."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class AudioMetadata:
    """Technical metadata collected from an audio file."""

    path: Path
    duration_seconds: float
    bitrate_bps: int | None
    sample_rate_hz: int
    channels: int
    codec_name: str | None
    format_name: str | None

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        data = asdict(self)
        data["path"] = str(self.path)
        return data


@dataclass(frozen=True)
class TranscriptionResult:
    """Result produced by the transcription stage."""

    audio_path: Path
    transcript_path: Path
    language: str
    text: str
    segments: list[dict[str, Any]] = field(default_factory=list)
    engine: str = "whisperx"

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        data = asdict(self)
        data["audio_path"] = str(self.audio_path)
        data["transcript_path"] = str(self.transcript_path)
        return data


@dataclass(frozen=True)
class VerseTiming:
    """Timing data for a single verse-sized text unit."""

    verse_id: str
    start_seconds: float
    end_seconds: float
    text: str
    confidence: float = 0.0
    duration: float = 0.0
    word_count: int = 0

    def __post_init__(self) -> None:
        """Populate derived verse QA fields when callers omit them."""

        if self.confidence is None:
            object.__setattr__(self, "confidence", 0.0)
        if self.duration == 0.0:
            object.__setattr__(
                self,
                "duration",
                max(0.0, self.end_seconds - self.start_seconds),
            )
        if self.word_count == 0 and self.text:
            object.__setattr__(self, "word_count", len(self.text.split()))

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        return asdict(self)


@dataclass(frozen=True)
class AlignmentResult:
    """Result produced by the alignment stage."""

    audio_path: Path
    transcript_path: Path
    alignment_path: Path
    timings: list[VerseTiming] = field(default_factory=list)
    engine: str = "whisperx-forced-aligner"

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        data = asdict(self)
        data["audio_path"] = str(self.audio_path)
        data["transcript_path"] = str(self.transcript_path)
        data["alignment_path"] = str(self.alignment_path)
        data["timings"] = [timing.to_dict() for timing in self.timings]
        return data


@dataclass(frozen=True)
class VerseIndex:
    """Search/import index for verse-level audio playback."""

    audio_path: Path
    index_path: Path
    verses: list[VerseTiming] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        data = asdict(self)
        data["audio_path"] = str(self.audio_path)
        data["index_path"] = str(self.index_path)
        data["verses"] = [verse.to_dict() for verse in self.verses]
        return data


@dataclass(frozen=True)
class ChapterStatistics:
    """QA statistics for a processed chapter."""

    book: str
    chapter: int
    audio_duration: float
    processing_duration: float
    verse_count: int
    word_count: int
    average_confidence: float
    minimum_confidence: float
    maximum_confidence: float
    missing_verses: int
    overlapping_verses: int
    alignment_errors: int
    status: str

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""

        return asdict(self)


@dataclass
class PipelineContext:
    """Mutable state passed through every chapter-processing stage."""

    book: str
    chapter: int
    content_type: str
    audio_path: Path
    metadata: AudioMetadata | None = None
    transcription: TranscriptionResult | None = None
    alignment: AlignmentResult | None = None
    verse_index: VerseIndex | None = None
    manifest: dict[str, Any] = field(default_factory=dict)
    report: dict[str, Any] = field(default_factory=dict)
    processing_started: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    processing_finished: datetime | None = None
    processing_time_seconds: float | None = None
    status: str = "initialized"
    error: str | None = None

    def mark_finished(self, status: str, error: str | None = None) -> None:
        """Record completion metadata on the context."""

        self.processing_finished = datetime.now(timezone.utc)
        self.processing_time_seconds = (
            self.processing_finished - self.processing_started
        ).total_seconds()
        self.status = status
        self.error = error

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation of context state."""

        return {
            "book": self.book,
            "chapter": self.chapter,
            "content_type": self.content_type,
            "audio_path": str(self.audio_path),
            "metadata": self.metadata.to_dict() if self.metadata else None,
            "transcription": (
                self.transcription.to_dict() if self.transcription else None
            ),
            "alignment": self.alignment.to_dict() if self.alignment else None,
            "verse_index": self.verse_index.to_dict() if self.verse_index else None,
            "manifest": self.manifest,
            "report": self.report,
            "processing_started": self.processing_started.isoformat(),
            "processing_finished": (
                self.processing_finished.isoformat()
                if self.processing_finished
                else None
            ),
            "processing_time_seconds": self.processing_time_seconds,
            "status": self.status,
            "error": self.error,
        }
