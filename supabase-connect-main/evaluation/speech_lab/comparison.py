from __future__ import annotations

import json
from pathlib import Path

from .corpus import BENCHMARK_CORPUS, chapter_by_id
from .golden import GoldenReferenceManager
from .metrics import MetricCalculators
from .models import EvaluationResult, ModelSpec, ResourceUsage, Transcript
from .supabase_store import EvaluationSupabaseStore


class GoldenReferenceComparator:
    """Compare captured model transcripts against manually corrected golden references."""

    def __init__(
        self,
        *,
        golden: GoldenReferenceManager | None = None,
        store: EvaluationSupabaseStore | None = None,
        metrics: MetricCalculators | None = None,
    ) -> None:
        self.golden = golden or GoldenReferenceManager()
        self.store = store
        self.metrics = metrics or MetricCalculators()

    def compare_transcripts(
        self,
        transcripts: list[Transcript],
        model: ModelSpec,
        resources: dict[str, ResourceUsage] | None = None,
    ) -> list[EvaluationResult]:
        results: list[EvaluationResult] = []
        for transcript in transcripts:
            chapter_by_id(transcript.chapter_id)
            golden = self._load_golden(transcript.chapter_id)
            metrics = self.metrics.calculate(golden, transcript)
            notes = _acceptance_notes(metrics)
            results.append(
                EvaluationResult(
                    model_id=model.id,
                    model_name=model.name,
                    chapter_id=transcript.chapter_id,
                    metrics=metrics,
                    resources=(resources or {}).get(transcript.chapter_id, ResourceUsage(processing_time_seconds=0)),
                    accepted=not notes,
                    notes=notes,
                )
            )
        return results

    def compare_output_file(self, path: str | Path, model: ModelSpec) -> list[EvaluationResult]:
        return self.compare_transcripts(load_transcripts(path), model)

    def _load_golden(self, chapter_id: str) -> Transcript:
        if self.store is not None:
            return self.store.load_golden_reference(chapter_id)
        return self.golden.load(chapter_id)


def load_transcripts(path: str | Path) -> list[Transcript]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(payload, dict) and "transcripts" in payload:
        items = payload["transcripts"]
    elif isinstance(payload, dict) and "chapter_id" in payload:
        items = [payload]
    elif isinstance(payload, list):
        items = payload
    else:
        raise ValueError("Model output file must contain a transcript, a transcript list, or {'transcripts': [...]}.")
    return [Transcript.from_dict(item) for item in items]


def missing_golden_chapters(golden: GoldenReferenceManager) -> list[str]:
    return [chapter.id for chapter in golden.missing_references(BENCHMARK_CORPUS)]


def _acceptance_notes(metrics) -> list[str]:
    notes: list[str] = []
    if metrics.wer >= 0.05:
        notes.append(f"WER target missed: {metrics.wer:.4f} >= 0.0500")
    if metrics.boundary_accuracy <= 0.99:
        notes.append(f"Boundary target missed: {metrics.boundary_accuracy:.4f} <= 0.9900")
    if metrics.verse_confidence is None:
        notes.append("Verse confidence not reported")
    elif metrics.verse_confidence <= 0.95:
        notes.append(f"Verse confidence target missed: {metrics.verse_confidence:.4f}")
    return notes
