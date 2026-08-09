"""Benchmark registered SpeechEngine providers against fixed Bible chapters."""

from __future__ import annotations

import argparse
import csv
import html
import json
import tracemalloc
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from time import perf_counter
from typing import Any

from build_index import _build_verse_timings, _normalize_verse_boundaries
from lib.config import CONFIG, PipelineConfig
from lib.filesystem import ensure_directory
from lib.models import VerseIndex
from providers.audio_provider import get_audio_provider
from providers.text_provider import get_text_provider
from speech.factory import create_speech_engine, registered_provider_names

BENCHMARK_CORPUS: tuple[tuple[str, int], ...] = (
    ("Genesis", 1),
    ("Psalm", 23),
    ("Matthew", 5),
    ("John", 3),
    ("Romans", 8),
)

REPORT_DIR = CONFIG.reports_dir / "benchmarks"


@dataclass(frozen=True)
class BenchmarkResult:
    """One provider/chapter benchmark result."""

    provider: str
    book: str
    chapter: int
    status: str
    processing_time_seconds: float
    peak_memory_mb: float
    transcript_language: str | None = None
    word_count: int = 0
    average_word_confidence: float = 0.0
    boundary_success_rate: float = 0.0
    boundary_failures: int = 0
    average_verse_confidence: float = 0.0
    qa_score: float = 0.0
    import_success: bool = False
    weighted_score: float = 0.0
    error: str | None = None


def run_benchmarks(
    *,
    providers: list[str] | None = None,
    corpus: tuple[tuple[str, int], ...] = BENCHMARK_CORPUS,
    output_dir: Path = REPORT_DIR,
) -> dict[str, Any]:
    """Run benchmark corpus against registered speech engine providers."""

    provider_names = providers or registered_provider_names()
    results: list[BenchmarkResult] = []
    for provider in provider_names:
        engine = create_speech_engine(_provider_config(provider))
        health = engine.health_check()
        if health.get("available") is False:
            for book, chapter in corpus:
                results.append(
                    BenchmarkResult(
                        provider=provider,
                        book=book,
                        chapter=chapter,
                        status="skipped",
                        processing_time_seconds=0.0,
                        peak_memory_mb=0.0,
                        error=str(health.get("reason", "Provider is not available")),
                    )
                )
            continue
        for book, chapter in corpus:
            results.append(_benchmark_chapter(provider, book, chapter))

    report = _build_report(results, corpus)
    write_reports(report, output_dir)
    return report


def write_reports(report: dict[str, Any], output_dir: Path = REPORT_DIR) -> None:
    """Write JSON, Markdown, HTML, and CSV benchmark reports."""

    ensure_directory(output_dir)
    (output_dir / "speech_engine_benchmark.json").write_text(
        json.dumps(_json_report(report), indent=2),
        encoding="utf-8",
    )
    (output_dir / "speech_engine_benchmark.md").write_text(
        _markdown_report(report),
        encoding="utf-8",
    )
    (output_dir / "speech_engine_benchmark.html").write_text(
        _html_report(report),
        encoding="utf-8",
    )
    with (output_dir / "speech_engine_benchmark.csv").open(
        "w",
        newline="",
        encoding="utf-8",
    ) as handle:
        fieldnames = list(asdict(report["results"][0]).keys()) if report["results"] else []
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if fieldnames:
            writer.writeheader()
            for result in report["results"]:
                writer.writerow(asdict(result))


def _benchmark_chapter(provider: str, book: str, chapter: int) -> BenchmarkResult:
    started = perf_counter()
    tracemalloc.start()
    try:
        audio = get_audio_provider().resolve(book, chapter)
        verses = get_text_provider().get_chapter(book, chapter)
        engine = create_speech_engine(_provider_config(provider))
        transcript = engine.process(audio.path)
        words = transcript.word_dicts()
        boundary_result = _build_verse_timings(verses, words)
        normalized_result = _normalize_verse_boundaries(boundary_result.timings)
        verse_index = VerseIndex(
            audio_path=audio.path,
            index_path=REPORT_DIR / "transient" / provider / book / f"{chapter}.json",
            verses=normalized_result.timings,
            metadata={
                "book": book,
                "chapter": chapter,
                "provider": provider,
                "benchmark": True,
                "verse_boundary_qa": boundary_result.qa,
            },
        )
        import_success = _validate_import_preconditions(verse_index)
        processing_time = perf_counter() - started
        _, peak = tracemalloc.get_traced_memory()
        word_confidence = _average_word_confidence(words)
        boundary_failures = sum(
            1 for item in boundary_result.qa if item.get("reason") == "boundary_not_found"
        )
        boundary_success_rate = (
            (len(verses) - boundary_failures) / len(verses) if verses else 0.0
        )
        verse_confidence = _average(
            [verse.confidence for verse in normalized_result.timings]
        )
        qa_score = _qa_score(
            boundary_success_rate=boundary_success_rate,
            average_verse_confidence=verse_confidence,
            import_success=import_success,
        )
        weighted_score = _weighted_score(
            average_word_confidence=word_confidence,
            boundary_success_rate=boundary_success_rate,
            average_verse_confidence=verse_confidence,
            processing_time_seconds=processing_time,
            peak_memory_mb=_bytes_to_mb(peak),
            import_success=import_success,
        )
        return BenchmarkResult(
            provider=provider,
            book=book,
            chapter=chapter,
            status="completed",
            processing_time_seconds=round(processing_time, 3),
            peak_memory_mb=round(_bytes_to_mb(peak), 3),
            transcript_language=transcript.language,
            word_count=len(words),
            average_word_confidence=word_confidence,
            boundary_success_rate=round(boundary_success_rate, 6),
            boundary_failures=boundary_failures,
            average_verse_confidence=verse_confidence,
            qa_score=qa_score,
            import_success=import_success,
            weighted_score=weighted_score,
        )
    except Exception as exc:
        processing_time = perf_counter() - started
        _, peak = tracemalloc.get_traced_memory()
        return BenchmarkResult(
            provider=provider,
            book=book,
            chapter=chapter,
            status="failed",
            processing_time_seconds=round(processing_time, 3),
            peak_memory_mb=round(_bytes_to_mb(peak), 3),
            error=str(exc),
        )
    finally:
        tracemalloc.stop()


def _provider_config(provider: str) -> PipelineConfig:
    """Return config with a provider override for isolated benchmarking."""

    return replace(CONFIG, speech_engine_provider=provider)


def _validate_import_preconditions(index: VerseIndex) -> bool:
    """Validate import readiness without writing production import artifacts."""

    if not index.verses:
        return False
    expected = 1
    previous_end: float | None = None
    for verse in index.verses:
        try:
            verse_number = int(verse.verse_id)
        except ValueError:
            return False
        if verse_number != expected:
            return False
        if verse.start_seconds < 0 or verse.end_seconds <= verse.start_seconds:
            return False
        if previous_end is not None and verse.start_seconds < previous_end:
            return False
        previous_end = verse.end_seconds
        expected += 1
    return True


def _build_report(
    results: list[BenchmarkResult],
    corpus: tuple[tuple[str, int], ...],
) -> dict[str, Any]:
    """Build aggregate benchmark report."""

    providers = sorted({result.provider for result in results})
    provider_summary = [_provider_summary(provider, results) for provider in providers]
    rankings = sorted(
        provider_summary,
        key=lambda item: item["average_weighted_score"],
        reverse=True,
    )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "corpus": [{"book": book, "chapter": chapter} for book, chapter in corpus],
        "scoring_formula": _scoring_formula(),
        "rankings": rankings,
        "provider_summary": provider_summary,
        "results": results,
    }


def _json_report(report: dict[str, Any]) -> dict[str, Any]:
    """Return a JSON-serializable copy of a benchmark report."""

    return {
        **report,
        "results": [asdict(result) for result in report["results"]],
    }


def _provider_summary(provider: str, results: list[BenchmarkResult]) -> dict[str, Any]:
    provider_results = [result for result in results if result.provider == provider]
    completed = [result for result in provider_results if result.status == "completed"]
    return {
        "provider": provider,
        "chapters_attempted": len(provider_results),
        "chapters_completed": len(completed),
        "average_weighted_score": round(
            _average([result.weighted_score for result in completed]),
            3,
        ),
        "average_processing_time_seconds": round(
            _average([result.processing_time_seconds for result in completed]),
            3,
        ),
        "average_peak_memory_mb": round(
            _average([result.peak_memory_mb for result in completed]),
            3,
        ),
        "average_verse_confidence": round(
            _average([result.average_verse_confidence for result in completed]),
            6,
        ),
        "import_success_rate": round(
            _average([1.0 if result.import_success else 0.0 for result in completed]),
            6,
        ),
    }


def _average_word_confidence(words: list[dict[str, Any]]) -> float:
    scores = [
        float(word.get("score", 0.0) or 0.0)
        for word in words
    ]
    return round(_average(scores), 6)


def _average(values: list[float]) -> float:
    return float(mean(values)) if values else 0.0


def _bytes_to_mb(value: int) -> float:
    return value / 1024 / 1024


def _qa_score(
    *,
    boundary_success_rate: float,
    average_verse_confidence: float,
    import_success: bool,
) -> float:
    score = (boundary_success_rate * 50.0) + (average_verse_confidence * 40.0)
    if import_success:
        score += 10.0
    return round(min(100.0, max(0.0, score)), 3)


def _weighted_score(
    *,
    average_word_confidence: float,
    boundary_success_rate: float,
    average_verse_confidence: float,
    processing_time_seconds: float,
    peak_memory_mb: float,
    import_success: bool,
) -> float:
    accuracy = average_word_confidence * 30.0
    alignment_quality = boundary_success_rate * 25.0
    verse_confidence = average_verse_confidence * 20.0
    speed = max(0.0, min(1.0, 1.0 - (processing_time_seconds / 600.0))) * 10.0
    memory = max(0.0, min(1.0, 1.0 - (peak_memory_mb / 4096.0))) * 5.0
    reliability = 10.0 if import_success else 0.0
    return round(
        accuracy + alignment_quality + verse_confidence + speed + memory + reliability,
        3,
    )


def _scoring_formula() -> dict[str, str]:
    return {
        "accuracy": "30 points: average word confidence",
        "alignment_quality": "25 points: boundary success rate",
        "verse_confidence": "20 points: average verse confidence",
        "processing_speed": "10 points: linear score, 10 at 0s and 0 at 600s or slower",
        "memory_usage": "5 points: linear score, 5 at 0 MB and 0 at 4096 MB or higher",
        "reliability": "10 points: import precondition validation success",
    }


def _markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# Speech Engine Benchmark",
        "",
        f"Generated: {report['generated_at']}",
        "",
        "## Ranking",
        "",
        "| Rank | Provider | Score | Completed | Avg Time | Avg Memory |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for index, item in enumerate(report["rankings"], start=1):
        lines.append(
            "| {rank} | {provider} | {score:.3f} | {completed}/{attempted} | {time:.3f}s | {memory:.3f} MB |".format(
                rank=index,
                provider=item["provider"],
                score=item["average_weighted_score"],
                completed=item["chapters_completed"],
                attempted=item["chapters_attempted"],
                time=item["average_processing_time_seconds"],
                memory=item["average_peak_memory_mb"],
            )
        )
    lines.extend(
        [
            "",
            "## Scoring Formula",
            "",
            "- Accuracy: 30 points from average word confidence.",
            "- Alignment quality: 25 points from boundary success rate.",
            "- Verse confidence: 20 points from average verse confidence.",
            "- Processing speed: 10 points, decreasing linearly to zero at 600 seconds.",
            "- Memory usage: 5 points, decreasing linearly to zero at 4096 MB.",
            "- Reliability: 10 points when import precondition validation succeeds.",
            "",
            "## Chapter Results",
            "",
            "| Provider | Chapter | Status | Score | QA | Boundary Success | Failures | Words | Error |",
            "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
        ]
    )
    for result in report["results"]:
        lines.append(
            "| {provider} | {book} {chapter} | {status} | {score:.3f} | {qa:.3f} | {boundary:.3f} | {failures} | {words} | {error} |".format(
                provider=result.provider,
                book=result.book,
                chapter=result.chapter,
                status=result.status,
                score=result.weighted_score,
                qa=result.qa_score,
                boundary=result.boundary_success_rate,
                failures=result.boundary_failures,
                words=result.word_count,
                error=result.error or "",
            )
        )
    return "\n".join(lines) + "\n"


def _html_report(report: dict[str, Any]) -> str:
    rows = "\n".join(
        "<tr><td>{provider}</td><td>{book} {chapter}</td><td>{status}</td><td>{score:.3f}</td><td>{qa:.3f}</td><td>{error}</td></tr>".format(
            provider=html.escape(result.provider),
            book=html.escape(result.book),
            chapter=result.chapter,
            status=html.escape(result.status),
            score=result.weighted_score,
            qa=result.qa_score,
            error=html.escape(result.error or ""),
        )
        for result in report["results"]
    )
    ranking_rows = "\n".join(
        "<tr><td>{rank}</td><td>{provider}</td><td>{score:.3f}</td><td>{completed}/{attempted}</td></tr>".format(
            rank=index,
            provider=html.escape(item["provider"]),
            score=item["average_weighted_score"],
            completed=item["chapters_completed"],
            attempted=item["chapters_attempted"],
        )
        for index, item in enumerate(report["rankings"], start=1)
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Speech Engine Benchmark</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 2rem; color: #1f2933; }}
    table {{ border-collapse: collapse; width: 100%; margin-bottom: 2rem; }}
    th, td {{ border: 1px solid #d9e2ec; padding: 0.5rem; text-align: left; }}
    th {{ background: #f0f4f8; }}
  </style>
</head>
<body>
  <h1>Speech Engine Benchmark</h1>
  <p>Generated: {html.escape(report['generated_at'])}</p>
  <h2>Ranking</h2>
  <table>
    <thead><tr><th>Rank</th><th>Provider</th><th>Score</th><th>Completed</th></tr></thead>
    <tbody>{ranking_rows}</tbody>
  </table>
  <h2>Chapter Results</h2>
  <table>
    <thead><tr><th>Provider</th><th>Chapter</th><th>Status</th><th>Score</th><th>QA</th><th>Error</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark registered speech engines.")
    parser.add_argument(
        "--provider",
        action="append",
        dest="providers",
        help="Provider to benchmark. Repeat to compare multiple providers.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPORT_DIR,
        help="Directory for benchmark reports.",
    )
    args = parser.parse_args()
    report = run_benchmarks(providers=args.providers, output_dir=args.output_dir)
    print(f"Benchmark reports written to: {args.output_dir}")
    print("Rankings:")
    for index, item in enumerate(report["rankings"], start=1):
        print(f"{index}. {item['provider']}: {item['average_weighted_score']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
