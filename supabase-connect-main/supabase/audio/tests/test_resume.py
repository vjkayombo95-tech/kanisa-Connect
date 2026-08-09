"""Tests for manifest resume decisions."""

from __future__ import annotations

from pathlib import Path

from lib.models import PipelineContext
from process_chapter import _should_skip


def test_resume_skips_stages_completed_by_alignment_manifest(monkeypatch) -> None:
    """An aligned manifest should skip validation, transcription, and alignment."""

    context = PipelineContext(
        book="Genesis",
        chapter=1,
        content_type="bible",
        audio_path=Path("genesis_1.mp3"),
        manifest={
            "metadata": True,
            "transcription": True,
            "alignment": True,
            "verse_index": False,
            "imported": False,
        },
    )

    import process_chapter

    monkeypatch.setattr(process_chapter, "_existing_transcription_matches_language", lambda _context: True)
    monkeypatch.setattr(process_chapter, "_alignment_is_current", lambda _context: True)

    assert _should_skip("VALIDATE", context, force=False, resume=True)
    assert _should_skip("TRANSCRIBE", context, force=False, resume=True)
    assert _should_skip("ALIGN", context, force=False, resume=True)
    assert not _should_skip("BUILD_INDEX", context, force=False, resume=True)


def test_force_disables_resume_skip() -> None:
    """Force should run stages even when manifest flags are complete."""

    context = PipelineContext(
        book="Genesis",
        chapter=1,
        content_type="bible",
        audio_path=Path("genesis_1.mp3"),
        manifest={"alignment": True},
    )

    assert not _should_skip("ALIGN", context, force=True, resume=True)
