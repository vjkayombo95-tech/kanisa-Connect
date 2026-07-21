"""Tests for SpeechEngine benchmark runner."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import benchmark_speech_engines as benchmark
from providers.text_provider import BibleVerse
from speech.types import StandardTranscript, TranscriptSegment, WordTimestamp


class FakeSpeechEngine:
    """Deterministic benchmark provider for tests."""

    def health_check(self) -> dict[str, object]:
        return {"provider": "fake", "available": True}

    def model_info(self) -> dict[str, object]:
        return {"provider": "fake"}

    def supported_languages(self) -> list[str]:
        return ["sw"]

    def process(self, audio_path: Path) -> StandardTranscript:
        return StandardTranscript(
            language="sw",
            text="Hapo mwanzo Mungu akasema",
            segments=[
                TranscriptSegment(
                    start=0.0,
                    end=2.0,
                    text="Hapo mwanzo Mungu akasema",
                )
            ],
            words=[
                WordTimestamp(text="Hapo", start=0.0, end=0.4, confidence=0.9),
                WordTimestamp(text="mwanzo", start=0.4, end=0.8, confidence=0.9),
                WordTimestamp(text="Mungu", start=1.0, end=1.4, confidence=0.95),
                WordTimestamp(text="akasema", start=1.4, end=1.8, confidence=0.95),
            ],
            metadata={"provider": "fake"},
        )


def test_benchmark_runner_writes_all_report_formats(monkeypatch, tmp_path: Path) -> None:
    """Benchmark execution should write JSON, Markdown, HTML, and CSV reports."""

    monkeypatch.setattr(
        benchmark,
        "create_speech_engine",
        lambda _config: FakeSpeechEngine(),
    )
    monkeypatch.setattr(
        benchmark,
        "get_audio_provider",
        lambda: SimpleNamespace(
            resolve=lambda book, chapter: SimpleNamespace(
                book=book,
                chapter=chapter,
                path=tmp_path / f"{book}_{chapter}.mp3",
            )
        ),
    )
    monkeypatch.setattr(
        benchmark,
        "get_text_provider",
        lambda: SimpleNamespace(
            get_chapter=lambda book, chapter: [
                BibleVerse(1, "Hapo mwanzo"),
                BibleVerse(2, "Mungu akasema"),
            ]
        ),
    )

    report = benchmark.run_benchmarks(
        providers=["fake"],
        corpus=(("Genesis", 1),),
        output_dir=tmp_path,
    )

    result = report["results"][0]
    assert result.provider == "fake"
    assert result.status == "completed"
    assert result.word_count == 4
    assert result.boundary_success_rate == 1.0
    assert result.import_success is True
    assert result.weighted_score > 0
    assert (tmp_path / "speech_engine_benchmark.json").exists()
    assert (tmp_path / "speech_engine_benchmark.md").exists()
    assert (tmp_path / "speech_engine_benchmark.html").exists()
    assert (tmp_path / "speech_engine_benchmark.csv").exists()


def test_scoring_formula_is_documented() -> None:
    """The scorecard should expose the benchmark scoring methodology."""

    formula = benchmark._scoring_formula()

    assert "accuracy" in formula
    assert "alignment_quality" in formula
    assert "reliability" in formula
