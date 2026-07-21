from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .corpus import BENCHMARK_CORPUS, BenchmarkChapter
from .golden import GoldenReferenceManager
from .metrics import MetricCalculators
from .models import DEFAULT_MODEL_SPECS, EvaluationResult, ModelSpec
from .providers import ProviderFactory
from .resources import ResourceMonitor


@dataclass
class EvaluationConfig:
    audio_root: Path = Path("evaluation/speech_lab/audio")
    report_root: Path = Path("evaluation/speech_lab/reports")
    corpus: tuple[BenchmarkChapter, ...] = BENCHMARK_CORPUS
    models: tuple[ModelSpec, ...] = DEFAULT_MODEL_SPECS
    wer_target: float = 0.05
    boundary_accuracy_target: float = 0.99
    verse_confidence_target: float = 0.95
    metadata: dict[str, str] = field(default_factory=dict)


class SpeechEvaluationRunner:
    def __init__(
        self,
        config: EvaluationConfig | None = None,
        golden: GoldenReferenceManager | None = None,
        metrics: MetricCalculators | None = None,
        providers: ProviderFactory | None = None,
    ) -> None:
        self.config = config or EvaluationConfig()
        self.golden = golden or GoldenReferenceManager()
        self.metrics = metrics or MetricCalculators()
        self.providers = providers or ProviderFactory()

    def audio_path_for(self, chapter: BenchmarkChapter) -> Path | None:
        for suffix in (".wav", ".mp3", ".m4a", ".flac"):
            candidate = self.config.audio_root / f"{chapter.id}{suffix}"
            if candidate.exists():
                return candidate
        return None

    def evaluate_model_chapter(self, model: ModelSpec, chapter: BenchmarkChapter) -> EvaluationResult:
        golden = self.golden.load(chapter)
        provider = self.providers.create(model)
        with ResourceMonitor() as monitor:
            candidate = provider.transcribe(chapter, self.audio_path_for(chapter))
        metrics = self.metrics.calculate(golden, candidate)
        notes: list[str] = []
        if metrics.wer >= self.config.wer_target:
            notes.append(f"WER target missed: {metrics.wer:.4f} >= {self.config.wer_target:.4f}")
        if metrics.boundary_accuracy <= self.config.boundary_accuracy_target:
            notes.append(
                f"Boundary target missed: {metrics.boundary_accuracy:.4f} <= {self.config.boundary_accuracy_target:.4f}"
            )
        if metrics.verse_confidence is None:
            notes.append("Verse confidence not reported")
        elif metrics.verse_confidence <= self.config.verse_confidence_target:
            notes.append(f"Verse confidence target missed: {metrics.verse_confidence:.4f}")

        return EvaluationResult(
            model_id=model.id,
            model_name=model.name,
            chapter_id=chapter.id,
            metrics=metrics,
            resources=monitor.usage(),
            accepted=not notes,
            notes=notes,
        )

    def run(self, model_ids: set[str] | None = None, chapter_ids: set[str] | None = None) -> list[EvaluationResult]:
        chapters = [chapter for chapter in self.config.corpus if chapter_ids is None or chapter.id in chapter_ids]
        missing = self.golden.missing_references(tuple(chapters))
        if missing:
            labels = ", ".join(chapter.label for chapter in missing)
            raise FileNotFoundError(f"Missing golden references for: {labels}. Run init-golden and correct them manually.")

        results: list[EvaluationResult] = []
        models = [model for model in self.config.models if model.enabled and (model_ids is None or model.id in model_ids)]
        for model in models:
            for chapter in chapters:
                results.append(self.evaluate_model_chapter(model, chapter))
        return results
