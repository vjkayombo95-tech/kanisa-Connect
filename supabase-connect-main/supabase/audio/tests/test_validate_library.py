"""Tests for library validation command helpers."""

from __future__ import annotations

import validate_library
from lib.discovery import SourceIssue


def test_validate_library_combines_source_and_pipeline_issues(monkeypatch) -> None:
    """Validation should include discovery and pipeline verifier issues."""

    monkeypatch.setattr(
        validate_library,
        "discover_issues",
        lambda _content: [SourceIssue("bible", "Genesis", 1, "Missing audio")],
    )
    monkeypatch.setattr(validate_library, "verify_pipeline", lambda: ["Missing manifest"])

    issues = validate_library.validate_library("bible")

    assert "bible/Genesis 1: Missing audio" in issues
    assert "Missing manifest" in issues
