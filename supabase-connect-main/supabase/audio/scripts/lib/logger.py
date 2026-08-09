"""Logging setup for pipeline scripts."""

from __future__ import annotations

import logging
from time import perf_counter
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Protocol

from .config import CONFIG

LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"
MAX_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 5


def get_logger(name: str, log_file: str | None = None) -> logging.Logger:
    """Return a logger writing to ``reports/logs`` with rotation enabled."""

    CONFIG.logs_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False

    target = CONFIG.logs_dir / (log_file or f"{name}.log")
    if not _has_file_handler(logger, target):
        formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
        handler = RotatingFileHandler(
            target,
            maxBytes=MAX_BYTES,
            backupCount=BACKUP_COUNT,
            encoding="utf-8",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    if not _has_stream_handler(logger):
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
        logger.addHandler(stream_handler)

    return logger


class LogContext(Protocol):
    """Protocol for objects that carry chapter logging fields."""

    book: str
    chapter: int


def stage_prefix(context: LogContext, stage: str, duration_seconds: float) -> str:
    """Build the required contextual log prefix."""

    return f"[{context.book} {context.chapter}][{stage.upper()}][{duration_seconds:.2f}s]"


def log_stage(
    logger: logging.Logger,
    context: LogContext,
    stage: str,
    message: str,
    duration_seconds: float = 0.0,
    level: int = logging.INFO,
) -> None:
    """Write a pipeline log line with chapter, stage, and duration."""

    logger.log(level, "%s %s", stage_prefix(context, stage, duration_seconds), message)


def now_seconds() -> float:
    """Return a monotonic timestamp for stage duration measurement."""

    return perf_counter()


def _has_file_handler(logger: logging.Logger, target: Path) -> bool:
    """Return whether ``logger`` already writes to ``target``."""

    resolved_target = target.resolve()
    for handler in logger.handlers:
        if isinstance(handler, RotatingFileHandler):
            existing = Path(handler.baseFilename).resolve()
            if existing == resolved_target:
                return True
    return False


def _has_stream_handler(logger: logging.Logger) -> bool:
    """Return whether ``logger`` already has a console stream handler."""

    return any(
        isinstance(handler, logging.StreamHandler)
        and not isinstance(handler, RotatingFileHandler)
        for handler in logger.handlers
    )
