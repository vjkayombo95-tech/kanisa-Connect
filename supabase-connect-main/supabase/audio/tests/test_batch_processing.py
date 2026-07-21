"""Tests for book and library batch processors."""

from __future__ import annotations

from pathlib import Path

import process_book
import process_library
from lib.discovery import SourceChapter


class QuietProgress:
    """Progress test double."""

    def __init__(self, _label: str, _total: int) -> None:
        self.updates: list[tuple[str, str]] = []

    def update(self, chapter_label: str, status: str) -> None:
        """Record progress update."""

        self.updates.append((chapter_label, status))

    def close(self) -> None:
        """Close progress test double."""


def _chapter(chapter: int) -> SourceChapter:
    """Return a test source chapter."""

    return SourceChapter(
        content_type="bible",
        book="Genesis",
        chapter=chapter,
        audio_path=Path(f"genesis_{chapter}.mp3"),
        text_path=Path(f"{chapter}.txt"),
    )


def test_process_book_continues_after_failure(monkeypatch) -> None:
    """Book processing should continue when one chapter fails."""

    monkeypatch.setattr(process_book, "ProgressDisplay", QuietProgress)
    monkeypatch.setattr(process_book, "write_run_reports", lambda _tracker: None)
    monkeypatch.setattr(process_book, "discover_book", lambda _content, _book: [_chapter(1), _chapter(2)])

    def fake_process_chapter(*_args, **kwargs):
        if kwargs["chapter"] == 1:
            raise RuntimeError("boom")
        return {}

    monkeypatch.setattr(process_book, "process_chapter", fake_process_chapter)

    tracker = process_book.process_book("genesis")

    assert tracker.failed == 1
    assert tracker.completed == 1
    assert tracker.chapters_processed == 2
    assert tracker.failures[0].chapter == 1


def test_process_book_resume_skips_completed_manifest(monkeypatch) -> None:
    """Resume mode should skip completed manifests unless force is set."""

    monkeypatch.setattr(process_book, "ProgressDisplay", QuietProgress)
    monkeypatch.setattr(process_book, "write_run_reports", lambda _tracker: None)
    monkeypatch.setattr(process_book, "discover_book", lambda _content, _book: [_chapter(1)])
    monkeypatch.setattr(process_book, "load_manifest", lambda _book, _chapter: {"imported": True})
    monkeypatch.setattr(process_book, "can_skip_completed_chapter", lambda _book, _chapter: True)

    calls = {"count": 0}

    def fake_process_chapter(*_args, **_kwargs):
        calls["count"] += 1
        return {}

    monkeypatch.setattr(process_book, "process_chapter", fake_process_chapter)

    tracker = process_book.process_book("genesis", process_book.BookProcessingOptions(resume=True))

    assert tracker.skipped == 1
    assert calls["count"] == 0


def test_process_library_runs_available_books(monkeypatch) -> None:
    """Library processing should run each discovered book sequentially."""

    monkeypatch.setattr(process_library, "write_run_reports", lambda _tracker: None)
    monkeypatch.setattr(process_library, "available_books", lambda _content: ["Genesis", "Exodus"])

    def fake_process_book(book, _options):
        tracker = process_library.RunTracker()
        tracker.record_completed(book)
        return tracker

    monkeypatch.setattr(process_library, "process_book", fake_process_book)

    tracker = process_library.process_library("bible")

    assert tracker.books_processed == {"Genesis", "Exodus"}
    assert tracker.completed == 2
