from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


MODEL_IDS = (
    "whisperx",
    "faster-whisper-large-v3",
    "whisper-large-v3",
    "whisper-turbo",
    "nvidia-parakeet",
    "meta-mms",
    "custom-wav2vec2-alignment",
    "speech-engine-future-provider",
)


@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    provider: str
    command: str | None = None
    enabled: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)


DEFAULT_MODEL_SPECS: tuple[ModelSpec, ...] = (
    ModelSpec(id="whisperx", name="WhisperX", provider="manifest"),
    ModelSpec(id="faster-whisper-large-v3", name="Faster-Whisper Large-v3", provider="manifest"),
    ModelSpec(id="whisper-large-v3", name="Whisper Large-v3", provider="manifest"),
    ModelSpec(id="whisper-turbo", name="Whisper Turbo", provider="manifest"),
    ModelSpec(id="nvidia-parakeet", name="NVIDIA Parakeet", provider="manifest"),
    ModelSpec(id="meta-mms", name="Meta MMS", provider="manifest"),
    ModelSpec(id="custom-wav2vec2-alignment", name="Custom wav2vec2 alignment", provider="manifest"),
    ModelSpec(id="speech-engine-future-provider", name="Future providers through SpeechEngine", provider="manifest"),
)


@dataclass
class WordTiming:
    word: str
    start_ms: int | None = None
    end_ms: int | None = None
    confidence: float | None = None
    verse: int | None = None


@dataclass
class VerseBoundary:
    verse: int
    start_ms: int
    end_ms: int
    confidence: float | None = None


@dataclass
class CandidateVerse:
    verse: int
    text: str
    canonical_verse_text: str | None = None
    spoken_reference_text: str | None = None
    text_reference_mode: str = "legacy_unknown"
    spoken_text_review_status: str = "pending"
    reviewer: str | None = None
    review_notes: str | None = None
    start_ms: int | None = None
    end_ms: int | None = None
    alignment_score: float | None = None
    matched_tokens: int = 0
    reference_tokens: int = 0
    status: str = "unresolved"
    failure_reason: str | None = None
    largest_internal_gap_ms: int | None = None


@dataclass
class Introduction:
    type: str
    text: str
    start_ms: int
    end_ms: int
    review_status: str = "pending"
    reviewer: str | None = None
    notes: str | None = None


@dataclass
class Transcript:
    chapter_id: str
    text: str
    words: list[WordTiming] = field(default_factory=list)
    verse_boundaries: list[VerseBoundary] = field(default_factory=list)
    verses: list[CandidateVerse] = field(default_factory=list)
    introductions: list[Introduction] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "Transcript":
        return cls(
            chapter_id=str(payload["chapter_id"]),
            text=str(payload.get("text", "")),
            words=[WordTiming(**item) for item in payload.get("words", [])],
            verse_boundaries=[VerseBoundary(**item) for item in payload.get("verse_boundaries", [])],
            verses=[CandidateVerse(**item) for item in payload.get("verses", [])],
            introductions=[Introduction(**item) for item in payload.get("introductions", [])],
            metadata=dict(payload.get("metadata", {})),
        )


@dataclass
class ResourceUsage:
    processing_time_seconds: float
    peak_ram_mb: float | None = None
    peak_vram_mb: float | None = None
    gpu_utilization_percent: float | None = None
    cpu_utilization_percent: float | None = None


@dataclass
class EvaluationMetrics:
    wer: float
    cer: float
    boundary_accuracy: float
    alignment_accuracy: float
    average_word_confidence: float | None
    verse_confidence: float | None
    output_stability: float | None = None
    canonical_text_wer: float | None = None
    canonical_text_cer: float | None = None
    spoken_reference_wer: float | None = None
    spoken_reference_cer: float | None = None
    canonical_token_similarity: float | None = None
    word_order_similarity: float | None = None
    semantic_similarity: str = "unavailable"
    text_reference_mode: str = "legacy_unknown"
    text_metric_warning: str | None = None
    alignment_accuracy_deprecated: bool = True
    alignment_accuracy_description: str = (
        "Deprecated: word-level timing accuracy against golden word timings. "
        "Golden chapter references currently do not contain word timings, so this is 0.0 by design."
    )
    verse_resolution_rate: float | None = None
    token_alignment_coverage: float | None = None
    high_confidence_alignment_rate: float | None = None
    combined_boundary_accuracy_1000ms: float | None = None
    combined_boundary_accuracy_2000ms: float | None = None
    boundary_accuracy_by_tolerance: dict[str, dict[str, float]] = field(default_factory=dict)
    mean_start_drift_ms: float | None = None
    median_start_drift_ms: float | None = None
    mean_end_drift_ms: float | None = None
    median_end_drift_ms: float | None = None
    per_verse_timing_differences: list[dict[str, float | int]] = field(default_factory=list)
    missing_verses: list[int] = field(default_factory=list)
    duplicated_verses: list[int] = field(default_factory=list)
    unresolved_verses: list[int] = field(default_factory=list)
    alignment_coverage: float | None = None
    per_verse_boundary_diagnostics: list[dict[str, object]] = field(default_factory=list)


@dataclass
class EvaluationResult:
    model_id: str
    model_name: str
    chapter_id: str
    metrics: EvaluationMetrics
    resources: ResourceUsage
    accepted: bool
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
