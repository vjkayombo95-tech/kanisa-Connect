"""Tests for generated index validation tools."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from lib import generated_validation
from lib.filesystem import write_json
from lib.generated_validation import validate_generated_chapter, write_validation_summary


def test_generated_chapter_validation_passes_clean_output(tmp_path: Path, monkeypatch) -> None:
    """A complete monotonic index with QA reports should pass."""

    monkeypatch.setattr(generated_validation, "CONFIG", _config(tmp_path))
    _write_index(tmp_path, "John", 3, [(1, 0.0, 1.0), (2, 1.0, 2.0), (3, 2.0, 3.0)])
    _write_qa(tmp_path, "John", 3, [])

    result = validate_generated_chapter("John", 3, expected_verse_count=3)

    assert result.passed
    assert result.verse_count == 3
    assert result.average_confidence == 0.95


def test_generated_chapter_validation_detects_missing_duplicate_and_overlap(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """Validator should catch missing, duplicate, and overlapping verse timings."""

    monkeypatch.setattr(generated_validation, "CONFIG", _config(tmp_path))
    _write_index(tmp_path, "John", 3, [(1, 0.0, 2.0), (1, 1.5, 3.0), (3, 3.0, 4.0)])
    _write_qa(tmp_path, "John", 3, [])

    result = validate_generated_chapter("John", 3, expected_verse_count=3)

    assert not result.passed
    assert any("Duplicate verse: 1" in issue for issue in result.issues)
    assert any("Missing verse: 2" in issue for issue in result.issues)
    assert any("Overlap:" in issue for issue in result.issues)


def test_generated_chapter_validation_requires_qa_reports(tmp_path: Path, monkeypatch) -> None:
    """Missing QA reports should fail production validation."""

    monkeypatch.setattr(generated_validation, "CONFIG", _config(tmp_path))
    _write_index(tmp_path, "John", 3, [(1, 0.0, 1.0)])

    result = validate_generated_chapter("John", 3, expected_verse_count=1)

    assert not result.passed
    assert any("Missing QA summary" in issue for issue in result.issues)
    assert any("Missing QA HTML report" in issue for issue in result.issues)


def test_validation_summary_writes_expected_totals(tmp_path: Path, monkeypatch) -> None:
    """Validation summaries should expose full-Bible rollup fields."""

    monkeypatch.setattr(generated_validation, "CONFIG", _config(tmp_path))
    _write_index(tmp_path, "John", 3, [(1, 0.0, 1.0)])
    _write_qa(tmp_path, "John", 3, [])
    result = validate_generated_chapter("John", 3, expected_verse_count=1)

    path = write_validation_summary([result], tmp_path / "summary.json")
    data = generated_validation.read_json(path)

    assert data["total_books"] == 1
    assert data["total_chapters"] == 1
    assert data["total_verses"] == 1
    assert data["successful_chapters"] == 1


def _config(tmp_path: Path) -> SimpleNamespace:
    return SimpleNamespace(
        indexes_dir=tmp_path / "indexes",
        reports_dir=tmp_path / "reports",
        qa_minimum_confidence=0.9,
        minimum_verse_duration_seconds=0.05,
    )


def _write_index(
    tmp_path: Path,
    book: str,
    chapter: int,
    timings: list[tuple[int, float, float]],
) -> None:
    path = tmp_path / "indexes" / book / f"{chapter}.json"
    write_json(
        path,
        {
            "book": book,
            "chapter": chapter,
            "verses": [
                {
                    "verse": verse,
                    "start": start,
                    "end": end,
                    "confidence": 0.95,
                    "text": f"Verse {verse}",
                }
                for verse, start, end in timings
            ],
        },
    )


def _write_qa(tmp_path: Path, book: str, chapter: int, issues: list[str]) -> None:
    stem = f"{book}_{chapter}"
    write_json(tmp_path / "reports" / "summary" / f"{stem}.json", {"issues": issues})
    html_path = tmp_path / "reports" / "html" / f"{stem}.html"
    html_path.parent.mkdir(parents=True, exist_ok=True)
    html_path.write_text("<html></html>", encoding="utf-8")
