"""Tests for run summary and failure reports."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from lib import run_reports
from lib.filesystem import read_json


def test_run_summary_and_failure_report(tmp_path: Path, monkeypatch) -> None:
    """Run reports should write JSON, HTML, and top-level failure array."""

    monkeypatch.setattr(run_reports, "CONFIG", SimpleNamespace(reports_dir=tmp_path))
    tracker = run_reports.RunTracker()
    tracker.record_completed("Genesis")
    tracker.record_failed("Genesis", 2, "Missing official chapter text")
    tracker.record_skipped("Genesis")

    summary_json, summary_html, failures_json = run_reports.write_run_reports(tracker)

    summary = read_json(summary_json)
    failures = json.loads(failures_json.read_text(encoding="utf-8"))

    assert summary["books_processed"] == 1
    assert summary["chapters_processed"] == 3
    assert summary["completed"] == 1
    assert summary["failed"] == 1
    assert summary["skipped"] == 1
    assert summary_html.exists()
    assert failures == [
        {
            "book": "Genesis",
            "chapter": 2,
            "reason": "Missing official chapter text",
        }
    ]
