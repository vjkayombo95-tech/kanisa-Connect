"""Regression tests for robust verse boundary matching."""

from __future__ import annotations

from pathlib import Path

import pytest

from build_index import (
    _build_verse_timings,
    _map_words_to_verses,
    _normalize_verse_boundaries,
    _validate_generated_boundaries,
)
from lib.models import VerseTiming
from providers.text_provider import BibleVerse


def test_boundary_matching_handles_punctuation_and_capitalization() -> None:
    """Punctuation and casing differences should not block verse boundaries."""

    verses = [
        BibleVerse(1, "In the beginning, God created the heavens."),
        BibleVerse(2, "The earth was without form."),
    ]
    words = _words("IN the beginning God created the heavens THE earth was without form")

    timings = _map_words_to_verses(verses, words)

    assert timings[0].start_seconds == 0.0
    assert timings[0].end_seconds == timings[1].start_seconds
    assert timings[1].start_seconds == 6.75
    assert timings[1].confidence > 0.9


def test_boundary_matching_handles_minor_spelling_differences() -> None:
    """Fuzzy matching should tolerate small spelling differences."""

    verses = [
        BibleVerse(1, "In the beginning God created."),
        BibleVerse(2, "The earth was without form."),
    ]
    words = _words("in the beginning god created teh earth was without form")

    result = _build_verse_timings(verses, words)

    assert result.timings[1].start_seconds == 5.0
    assert result.timings[1].confidence > 0.6
    assert result.qa[0]["verse_number"] == 2
    assert result.qa[0]["reason"] == "fuzzy"
    assert result.qa[0]["similarity_score"] > 0.7


def test_boundary_matching_handles_extra_filler_words() -> None:
    """Extra filler words in alignment should not prevent later verse matches."""

    verses = [
        BibleVerse(1, "In the beginning God created."),
        BibleVerse(2, "The earth was without form."),
    ]
    words = _words("um in the beginning god created ah the earth was without form")

    timings = _map_words_to_verses(verses, words)

    assert timings[0].start_seconds == 1.0
    assert timings[0].end_seconds == timings[1].start_seconds
    assert timings[1].start_seconds == 6.75


def test_boundary_matching_handles_missing_punctuation() -> None:
    """Missing quotation marks and apostrophe variants should normalize cleanly."""

    verses = [
        BibleVerse(1, '"Do not fear," said John.'),
        BibleVerse(2, "It's the Lord's day."),
    ]
    words = _words("do not fear said john it's the lord's day")

    timings = _map_words_to_verses(verses, words)

    assert timings[0].start_seconds == 0.0
    assert timings[0].end_seconds == timings[1].start_seconds
    assert timings[1].start_seconds == 4.75


def test_boundary_matching_flags_unmatched_verse_and_continues() -> None:
    """One missing verse boundary should be flagged without aborting the chapter."""

    verses = [
        BibleVerse(1, "In the beginning God created."),
        BibleVerse(2, "Completely absent opening words."),
        BibleVerse(3, "Let there be light."),
    ]
    words = _words("in the beginning god created let there be light")

    result = _build_verse_timings(verses, words)

    assert [timing.verse_id for timing in result.timings] == ["1", "2", "3"]
    assert result.timings[1].confidence == 0.0
    assert result.timings[2].start_seconds == 5.0
    assert result.qa[0]["verse_number"] == 2
    assert result.qa[0]["reason"] == "boundary_not_found"
    assert result.qa[0]["expected_opening_text"] == "completely absent opening words"
    assert result.qa[0]["closest_aligned_text"]


def test_rolling_window_never_matches_before_previous_boundary() -> None:
    """Repeated phrases behind the cursor must not create non-monotonic starts."""

    verses = [
        BibleVerse(1, "Alpha opening words."),
        BibleVerse(2, "Beta opening words."),
        BibleVerse(3, "Alpha opening words repeated later."),
    ]
    words = _words("alpha opening words beta opening words filler filler alpha opening words repeated later")

    timings = _map_words_to_verses(verses, words)

    _assert_monotonic(timings)
    assert timings[2].start_seconds >= timings[1].end_seconds


def test_boundary_qa_is_written_to_index_metadata(tmp_path: Path) -> None:
    """Boundary QA entries should be serializable in index metadata."""

    verses = [BibleVerse(1, "Missing words entirely.")]
    result = _build_verse_timings(verses, _words("different aligned text"))

    assert result.qa == [
        {
            "verse_number": 1,
            "expected_opening_text": "missing words entirely",
            "closest_aligned_text": "different aligned text",
            "similarity_score": result.qa[0]["similarity_score"],
            "reason": "boundary_not_found",
        }
    ]


def test_normalization_repairs_single_overlap() -> None:
    timings = _normalize_verse_boundaries(
        [
            VerseTiming("1", 0.0, 5.0, "one", 0.99),
            VerseTiming("2", 4.0, 8.0, "two", 0.99),
        ]
    ).timings

    assert timings[0].end_seconds == 4.5
    assert timings[1].start_seconds == 4.5
    _validate_generated_boundaries(timings)


def test_normalization_repairs_multiple_overlaps() -> None:
    result = _normalize_verse_boundaries(
        [
            VerseTiming("1", 0.0, 5.0, "one", 0.99),
            VerseTiming("2", 4.0, 9.0, "two", 0.99),
            VerseTiming("3", 8.0, 12.0, "three", 0.99),
        ]
    )

    assert len(result.qa) == 2
    _assert_monotonic(result.timings)


def test_normalization_repairs_cascading_overlaps() -> None:
    result = _normalize_verse_boundaries(
        [
            VerseTiming("1", 0.0, 10.0, "one", 0.99),
            VerseTiming("2", 2.0, 11.0, "two", 0.99),
            VerseTiming("3", 3.0, 12.0, "three", 0.99),
            VerseTiming("4", 4.0, 13.0, "four", 0.99),
        ]
    )

    _assert_monotonic(result.timings)
    assert result.timings[0].end_seconds == result.timings[1].start_seconds
    assert result.timings[1].end_seconds == result.timings[2].start_seconds
    assert result.timings[2].end_seconds == result.timings[3].start_seconds


def test_normalization_repairs_floating_point_precision_overlap() -> None:
    timings = _normalize_verse_boundaries(
        [
            VerseTiming("1", 0.0, 1.0000004, "one", 0.99),
            VerseTiming("2", 1.0000001, 2.0, "two", 0.99),
        ]
    ).timings

    _assert_monotonic(timings)


def test_normalization_protects_minimum_duration(monkeypatch) -> None:
    import build_index

    monkeypatch.setattr(
        build_index,
        "CONFIG",
        type("Config", (), {"minimum_verse_duration_seconds": 1.0})(),
    )

    timings = _normalize_verse_boundaries(
        [
            VerseTiming("1", 0.0, 4.0, "one", 0.99),
            VerseTiming("2", 1.0, 3.0, "two", 0.99),
        ]
    ).timings

    assert timings[0].duration >= 1.0
    assert timings[1].duration >= 1.0
    _assert_monotonic(timings)


def test_normalization_preserves_no_gap_boundaries() -> None:
    timings = _normalize_verse_boundaries(
        [
            VerseTiming("1", 0.0, 2.0, "one", 0.99),
            VerseTiming("2", 4.0, 6.0, "two", 0.99),
        ]
    ).timings

    assert timings[0].end_seconds == timings[1].start_seconds
    assert timings[0].end_seconds == 3.0
    _assert_monotonic(timings)


def test_internal_validation_rejects_non_monotonic_output() -> None:
    with pytest.raises(Exception, match="Generated verse boundaries failed internal validation"):
        _validate_generated_boundaries(
            [
                VerseTiming("1", 0.0, 5.0, "one", 0.99),
                VerseTiming("2", 4.0, 8.0, "two", 0.99),
            ]
        )


def _words(text: str) -> list[dict[str, float | str]]:
    return [
        {
            "word": word,
            "start": float(index),
            "end": float(index) + 0.5,
            "score": 0.98,
        }
        for index, word in enumerate(text.split())
    ]


def _assert_monotonic(timings: list[VerseTiming]) -> None:
    for current, next_timing in zip(timings, timings[1:]):
        assert current.start_seconds < current.end_seconds
        assert current.end_seconds == next_timing.start_seconds
        assert current.end_seconds <= next_timing.end_seconds
    assert timings[-1].start_seconds < timings[-1].end_seconds
    _validate_generated_boundaries(timings)
