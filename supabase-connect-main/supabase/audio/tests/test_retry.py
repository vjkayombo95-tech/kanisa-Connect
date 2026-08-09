"""Tests for transient retry policy."""

from __future__ import annotations

from lib.exceptions import AudioValidationError
from lib.retry import retry_transient


def test_retry_transient_eventually_succeeds(monkeypatch) -> None:
    """retry_transient should retry ordinary exceptions with backoff."""

    monkeypatch.setattr("lib.retry.time.sleep", lambda _seconds: None)
    attempts = {"count": 0}

    def operation() -> str:
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise RuntimeError("temporary")
        return "ok"

    assert retry_transient(operation, retries=3, backoff_seconds=0) == "ok"
    assert attempts["count"] == 3


def test_retry_transient_never_retries_validation_errors(monkeypatch) -> None:
    """Validation failures should pass through without retry."""

    monkeypatch.setattr("lib.retry.time.sleep", lambda _seconds: None)
    attempts = {"count": 0}

    def operation() -> str:
        attempts["count"] += 1
        raise AudioValidationError("invalid input")

    try:
        retry_transient(operation, retries=3, backoff_seconds=0)
    except AudioValidationError:
        pass

    assert attempts["count"] == 1
