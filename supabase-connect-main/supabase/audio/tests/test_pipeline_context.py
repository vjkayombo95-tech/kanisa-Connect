"""Tests for pipeline context data model behavior."""

from __future__ import annotations

from pathlib import Path

from lib.models import PipelineContext


def test_pipeline_context_defaults() -> None:
    """PipelineContext should initialize optional stage outputs as empty."""

    context = PipelineContext(
        book="Genesis",
        chapter=1,
        content_type="bible",
        audio_path=Path("chapter.mp3"),
    )

    assert context.metadata is None
    assert context.transcription is None
    assert context.alignment is None
    assert context.verse_index is None
    assert context.status == "initialized"
    assert context.error is None


def test_pipeline_context_mark_finished() -> None:
    """mark_finished should record completion status and duration."""

    context = PipelineContext(
        book="Genesis",
        chapter=1,
        content_type="bible",
        audio_path=Path("chapter.mp3"),
    )

    context.mark_finished("imported")

    assert context.status == "imported"
    assert context.processing_finished is not None
    assert context.processing_time_seconds is not None
