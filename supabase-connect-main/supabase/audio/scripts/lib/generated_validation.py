"""Validation helpers for generated verse index artifacts."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean
from time import perf_counter
from typing import Any

from .config import CONFIG
from .filesystem import read_json, slug, write_json
from .models import VerseTiming


@dataclass
class GeneratedChapterValidation:
    """Validation result for one generated chapter."""

    book: str
    chapter: int
    index_path: Path
    verse_count: int = 0
    expected_verse_count: int | None = None
    average_confidence: float = 0.0
    processing_time: float = 0.0
    issues: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.issues

    def to_dict(self) -> dict[str, Any]:
        return {
            "book": self.book,
            "chapter": self.chapter,
            "index_path": str(self.index_path),
            "verse_count": self.verse_count,
            "expected_verse_count": self.expected_verse_count,
            "average_confidence": self.average_confidence,
            "processing_time": round(self.processing_time, 3),
            "status": "passed" if self.passed else "failed",
            "issues": self.issues,
            "warnings": self.warnings,
        }


def validate_generated_chapter(
    book: str,
    chapter: int,
    *,
    expected_verse_count: int | None = None,
    require_qa: bool = True,
    require_average_confidence: bool = False,
) -> GeneratedChapterValidation:
    """Validate one generated index and its QA artifacts."""

    started = perf_counter()
    index_path = CONFIG.indexes_dir / book.replace(" ", "_") / f"{chapter}.json"
    result = GeneratedChapterValidation(
        book=book,
        chapter=chapter,
        index_path=index_path,
        expected_verse_count=expected_verse_count,
    )
    if not index_path.exists():
        result.issues.append(f"Missing index: {index_path}")
        result.processing_time = perf_counter() - started
        return result

    try:
        payload = read_json(index_path)
        verses = _verses_from_payload(payload)
    except Exception as exc:
        result.issues.append(f"Unable to read index: {exc}")
        result.processing_time = perf_counter() - started
        return result

    result.verse_count = len(verses)
    confidences = [verse.confidence for verse in verses]
    result.average_confidence = round(mean(confidences), 6) if confidences else 0.0
    result.issues.extend(_verse_issues(verses, expected_verse_count))
    result.warnings.extend(_confidence_warnings(verses, require_average_confidence))
    if require_average_confidence and result.average_confidence < CONFIG.qa_minimum_confidence:
        result.issues.append(
            "Average confidence below configured threshold: "
            f"{result.average_confidence:.6f} < {CONFIG.qa_minimum_confidence:.6f}"
        )
    if require_qa:
        result.issues.extend(_qa_issues(book, chapter))
    result.processing_time = perf_counter() - started
    return result


def write_validation_summary(results: list[GeneratedChapterValidation], path: Path) -> Path:
    """Write a validation summary for generated chapters."""

    confidences = [result.average_confidence for result in results if result.verse_count]
    payload = {
        "total_books": len({result.book for result in results}),
        "total_chapters": len(results),
        "total_verses": sum(result.verse_count for result in results),
        "successful_chapters": sum(1 for result in results if result.passed),
        "failed_chapters": sum(1 for result in results if not result.passed),
        "warnings": sum(len(result.warnings) for result in results),
        "average_confidence": round(mean(confidences), 6) if confidences else 0.0,
        "processing_time": round(sum(result.processing_time for result in results), 3),
        "chapters": [result.to_dict() for result in results],
    }
    return write_json(path, payload)


def _verses_from_payload(payload: dict[str, Any]) -> list[VerseTiming]:
    raw_verses = payload.get("verses", [])
    if not isinstance(raw_verses, list):
        raise ValueError("Index verses must be a list")
    verses: list[VerseTiming] = []
    for item in raw_verses:
        if not isinstance(item, dict):
            raise ValueError("Invalid verse object")
        verses.append(
            VerseTiming(
                verse_id=str(item.get("verse", item.get("verse_id", ""))),
                start_seconds=float(item.get("start", item.get("start_seconds"))),
                end_seconds=float(item.get("end", item.get("end_seconds"))),
                text=str(item.get("text", "")),
                confidence=float(item.get("confidence", 0.0) or 0.0),
                word_count=int(item.get("word_count", 0) or 0),
            )
        )
    return verses


def _verse_issues(verses: list[VerseTiming], expected_count: int | None) -> list[str]:
    issues: list[str] = []
    if not verses:
        return ["Index contains no verses"]
    numbers = []
    for verse in verses:
        try:
            numbers.append(int(verse.verse_id))
        except ValueError:
            issues.append(f"Verse id is not numeric: {verse.verse_id}")
    duplicates = sorted({number for number in numbers if numbers.count(number) > 1})
    for number in duplicates:
        issues.append(f"Duplicate verse: {number}")
    if expected_count is not None and len(verses) != expected_count:
        issues.append(f"Verse count mismatch: expected {expected_count}, found {len(verses)}")
    expected_max = expected_count or (max(numbers) if numbers else 0)
    missing = sorted(set(range(1, expected_max + 1)).difference(numbers))
    for number in missing:
        issues.append(f"Missing verse: {number}")
    previous: VerseTiming | None = None
    for verse in verses:
        if verse.start_seconds < 0 or verse.end_seconds < 0:
            issues.append(f"Negative timestamp at verse {verse.verse_id}")
        if verse.end_seconds <= verse.start_seconds:
            issues.append(f"Non-positive duration at verse {verse.verse_id}")
        elif verse.duration < CONFIG.minimum_verse_duration_seconds:
            issues.append(
                f"Duration below configured minimum at verse {verse.verse_id}: "
                f"{verse.duration:.6f} < {CONFIG.minimum_verse_duration_seconds:.6f}"
            )
        if previous is not None:
            if verse.start_seconds <= previous.start_seconds:
                issues.append(f"Start timestamp is not strictly increasing at verse {verse.verse_id}")
            if verse.end_seconds <= previous.end_seconds:
                issues.append(f"End timestamp is not strictly increasing at verse {verse.verse_id}")
            if previous.end_seconds > verse.start_seconds:
                issues.append(
                    f"Overlap: verse {previous.verse_id} end {previous.end_seconds:.6f} "
                    f"> verse {verse.verse_id} start {verse.start_seconds:.6f}"
                )
        previous = verse
    return issues


def _confidence_warnings(
    verses: list[VerseTiming],
    require_average_confidence: bool,
) -> list[str]:
    warnings = []
    for verse in verses:
        if verse.confidence < 0.0 or verse.confidence > 1.0:
            warnings.append(f"Confidence outside 0..1 at verse {verse.verse_id}: {verse.confidence}")
        elif not require_average_confidence and verse.confidence < CONFIG.qa_minimum_confidence:
            warnings.append(f"Low confidence at verse {verse.verse_id}: {verse.confidence:.6f}")
    return warnings


def _qa_issues(book: str, chapter: int) -> list[str]:
    issues = []
    stem = f"{slug(book)}_{chapter}"
    summary_path = CONFIG.reports_dir / "summary" / f"{stem}.json"
    html_path = CONFIG.reports_dir / "html" / f"{stem}.html"
    if not summary_path.exists():
        issues.append(f"Missing QA summary: {summary_path}")
    else:
        try:
            summary = read_json(summary_path)
            critical = [item for item in summary.get("issues", []) if item]
            if critical:
                issues.append(f"QA summary contains critical issues: {'; '.join(map(str, critical))}")
        except Exception as exc:
            issues.append(f"Unable to read QA summary: {exc}")
    if not html_path.exists():
        issues.append(f"Missing QA HTML report: {html_path}")
    return issues
