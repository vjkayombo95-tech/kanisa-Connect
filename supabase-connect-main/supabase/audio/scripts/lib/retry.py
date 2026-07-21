"""Retry helpers for transient pipeline operations."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import TypeVar

from .config import CONFIG
from .exceptions import AudioValidationError

T = TypeVar("T")


def retry_transient(
    operation: Callable[[], T],
    *,
    retries: int | None = None,
    backoff_seconds: float | None = None,
    logger: logging.Logger | None = None,
    operation_name: str = "operation",
) -> T:
    """Retry a transient operation with exponential backoff.

    Validation failures are never retried because they represent deterministic
    input/configuration problems.
    """

    max_retries = CONFIG.retries if retries is None else retries
    delay = CONFIG.backoff_seconds if backoff_seconds is None else backoff_seconds
    attempt = 0

    while True:
        try:
            return operation()
        except AudioValidationError:
            raise
        except Exception:
            attempt += 1
            if attempt > max_retries:
                raise
            if logger:
                logger.warning(
                    "Transient %s failure; retry %s/%s in %.2fs",
                    operation_name,
                    attempt,
                    max_retries,
                    delay,
                )
            time.sleep(delay)
            delay *= 2
