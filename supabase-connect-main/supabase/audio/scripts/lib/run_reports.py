"""Run-level reports and progress helpers for batch processing."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from time import perf_counter
from typing import Any

from .config import CONFIG
from .filesystem import ensure_directory, read_json, write_json
from .logger import get_logger

LOGGER = get_logger("run_reports")


@dataclass
class ChapterFailure:
    """Failure details for one chapter."""

    book: str
    chapter: int
    reason: str


@dataclass
class RunTracker:
    """Mutable counters and timings for a batch run."""

    started: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_monotonic: float = field(default_factory=perf_counter)
    books_processed: set[str] = field(default_factory=set)
    chapters_processed: int = 0
    completed: int = 0
    failed: int = 0
    skipped: int = 0
    failures: list[ChapterFailure] = field(default_factory=list)

    def record_completed(self, book: str) -> None:
        """Record a completed chapter."""

        self.books_processed.add(book)
        self.chapters_processed += 1
        self.completed += 1

    def record_failed(self, book: str, chapter: int, reason: str) -> None:
        """Record a failed chapter."""

        self.books_processed.add(book)
        self.chapters_processed += 1
        self.failed += 1
        self.failures.append(ChapterFailure(book, chapter, reason))

    def record_skipped(self, book: str) -> None:
        """Record a skipped chapter."""

        self.books_processed.add(book)
        self.chapters_processed += 1
        self.skipped += 1


def is_manifest_complete(manifest: dict[str, Any]) -> bool:
    """Return whether a manifest marks a chapter as complete."""

    status = str(manifest.get("status", "")).lower()
    return bool(manifest.get("imported")) or status in {"complete", "completed", "imported"}


def write_run_reports(tracker: RunTracker) -> tuple[Path, Path, Path]:
    """Write run summary JSON, run summary HTML, and failure report."""

    finished = datetime.now(timezone.utc)
    processing_time = perf_counter() - tracker.started_monotonic
    payload = {
        "started": tracker.started.isoformat(),
        "finished": finished.isoformat(),
        "processing_time": round(processing_time, 3),
        "books_processed": len(tracker.books_processed),
        "chapters_processed": tracker.chapters_processed,
        "completed": tracker.completed,
        "failed": tracker.failed,
        "skipped": tracker.skipped,
        "average_confidence": _average_confidence(),
    }
    summary_json = write_json(CONFIG.reports_dir / "run_summary.json", payload)
    summary_html = CONFIG.reports_dir / "run_summary.html"
    summary_html.write_text(_run_summary_html(payload), encoding="utf-8")
    failures_json = CONFIG.reports_dir / "failures.json"
    ensure_directory(failures_json.parent)
    failures_json.write_text(
        json.dumps([asdict(failure) for failure in tracker.failures], indent=2) + "\n",
        encoding="utf-8",
    )
    LOGGER.info("Run reports written: %s %s %s", summary_json, summary_html, failures_json)
    return summary_json, summary_html, failures_json


class ProgressDisplay:
    """Progress display with optional tqdm support."""

    def __init__(self, label: str, total: int) -> None:
        self.label = label
        self.total = total
        self.current = 0
        self.completed = 0
        self.failed = 0
        self.skipped = 0
        self._started = perf_counter()
        self._bar = self._create_tqdm(label, total)

    def update(self, chapter_label: str, status: str) -> None:
        """Advance progress by one chapter."""

        self.current += 1
        if status == "completed":
            self.completed += 1
        elif status == "failed":
            self.failed += 1
        elif status == "skipped":
            self.skipped += 1

        if self._bar is not None:
            self._bar.set_description(chapter_label)
            self._bar.update(1)
            return

        percent = int((self.current / self.total) * 100) if self.total else 100
        filled = int(percent / 5)
        remaining = self._estimated_remaining()
        bar = "#" * filled + "." * (20 - filled)
        print(self.label)
        print(f"[{bar}]")
        print(f"{self.current} / {self.total} chapters")
        print(f"{percent}%")
        print(f"Current chapter: {chapter_label}")
        print(f"Estimated remaining time: {remaining:.1f}s")
        print(f"Completed: {self.completed} Failed: {self.failed} Skipped: {self.skipped}")

    def close(self) -> None:
        """Close any active tqdm progress bar."""

        if self._bar is not None:
            self._bar.close()

    def _estimated_remaining(self) -> float:
        """Estimate remaining time in seconds."""

        if self.current == 0:
            return 0.0
        elapsed = perf_counter() - self._started
        per_item = elapsed / self.current
        return max(0.0, (self.total - self.current) * per_item)

    @staticmethod
    def _create_tqdm(label: str, total: int) -> object | None:
        """Create a tqdm progress bar when available."""

        try:
            from tqdm import tqdm

            return tqdm(total=total, desc=label, unit="chapter")
        except Exception:
            return None


def _average_confidence() -> float:
    """Return average confidence from chapter summary reports."""

    summary_dir = CONFIG.reports_dir / "summary"
    if not summary_dir.exists():
        return 0.0
    values: list[float] = []
    for path in summary_dir.glob("*.json"):
        try:
            value = read_json(path).get("average_confidence")
        except Exception:
            continue
        if value is not None:
            values.append(float(value))
    return round(sum(values) / len(values), 6) if values else 0.0


def _run_summary_html(payload: dict[str, Any]) -> str:
    """Render a simple run summary HTML report."""

    rows = "\n".join(
        f"<tr><th>{escape(str(key))}</th><td>{escape(str(value))}</td></tr>"
        for key, value in payload.items()
    )
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\">"
        "<title>Kanisa Connect Run Summary</title>"
        "<style>body{font-family:Arial,sans-serif;margin:32px}"
        "table{border-collapse:collapse}th,td{border:1px solid #d7dde5;padding:8px}</style>"
        "</head><body><h1>Run Summary</h1><table>"
        f"{rows}"
        "</table></body></html>"
    )
