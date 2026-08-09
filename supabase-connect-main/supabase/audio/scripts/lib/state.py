"""Global pipeline state persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import CONFIG
from .filesystem import read_json, write_json
from .models import PipelineContext


def pipeline_state_path() -> Path:
    """Return the global pipeline state path."""

    return CONFIG.reports_dir / "pipeline_state.json"


def load_pipeline_state() -> dict[str, Any]:
    """Load global pipeline state, returning defaults when absent."""

    path = pipeline_state_path()
    if not path.exists():
        return {
            "books_completed": 0,
            "chapters_completed": 0,
            "chapters_failed": 0,
            "last_processed": None,
            "last_run": None,
            "completed_books": [],
        }
    state = read_json(path)
    state.setdefault("books_completed", 0)
    state.setdefault("chapters_completed", 0)
    state.setdefault("chapters_failed", 0)
    state.setdefault("last_processed", None)
    state.setdefault("last_run", None)
    state.setdefault("completed_books", [])
    return state


def update_pipeline_state(context: PipelineContext) -> dict[str, Any]:
    """Update global pipeline state after a chapter attempt."""

    state = load_pipeline_state()
    completed_books = set(state.get("completed_books", []))
    state["last_processed"] = f"{context.book} {context.chapter}"
    state["last_run"] = datetime.now(timezone.utc).isoformat()

    if context.status == "imported":
        state["chapters_completed"] = int(state.get("chapters_completed", 0)) + 1
        completed_books.add(context.book)
        state["completed_books"] = sorted(completed_books)
        state["books_completed"] = len(completed_books)
    elif context.error:
        state["chapters_failed"] = int(state.get("chapters_failed", 0)) + 1
        state["completed_books"] = sorted(completed_books)

    write_json(pipeline_state_path(), state)
    return state
