"""Tests for audio QA statistics and report generation."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from lib.filesystem import read_json
from lib.models import AudioMetadata, PipelineContext, VerseIndex, VerseTiming
from lib import qa


def _config(tmp_path: Path) -> SimpleNamespace:
    """Return a minimal QA config double."""

    return SimpleNamespace(
        reports_dir=tmp_path,
        qa_minimum_confidence=0.90,
        qa_warning_confidence=0.95,
        qa_flag_low_confidence=True,
    )


def _context(tmp_path: Path) -> PipelineContext:
    """Create a small QA-ready pipeline context."""

    audio_path = tmp_path / "genesis_1.mp3"
    transcript_path = tmp_path / "genesis_1.transcript.json"
    alignment_path = tmp_path / "Genesis" / "1.alignment.json"
    index_path = tmp_path / "Genesis" / "1.json"
    audio_path.write_bytes(b"audio")
    transcript_path.write_text("{}", encoding="utf-8")
    alignment_path.parent.mkdir(parents=True)
    alignment_path.write_text("{}", encoding="utf-8")
    index_path.write_text("{}", encoding="utf-8")

    context = PipelineContext(
        book="Genesis",
        chapter=1,
        content_type="bible",
        audio_path=audio_path,
        metadata=AudioMetadata(
            path=audio_path,
            duration_seconds=12.5,
            bitrate_bps=128000,
            sample_rate_hz=44100,
            channels=2,
            codec_name="mp3",
            format_name="mp3",
        ),
        verse_index=VerseIndex(
            audio_path=audio_path,
            index_path=index_path,
            verses=[
                VerseTiming("1", 0.0, 3.0, "In the beginning", 0.98, word_count=3),
                VerseTiming("2", 3.1, 8.0, "The earth was void", 0.94, word_count=4),
            ],
            metadata={
                "book": "Genesis",
                "chapter": 1,
                "verse_boundary_qa": [
                    {
                        "verse_number": 2,
                        "expected_opening_text": "the earth was",
                        "closest_aligned_text": "the earth was",
                        "similarity_score": 1.0,
                        "reason": "fuzzy",
                    }
                ],
            },
        ),
    )
    context.processing_time_seconds = 2.25
    context.transcription = SimpleNamespace(transcript_path=transcript_path)
    context.alignment = SimpleNamespace(alignment_path=alignment_path)
    return context


def test_chapter_statistics() -> None:
    """Chapter statistics should aggregate verse quality fields."""

    context = PipelineContext(
        book="Genesis",
        chapter=1,
        content_type="bible",
        audio_path=Path("audio.mp3"),
        verse_index=VerseIndex(
            audio_path=Path("audio.mp3"),
            index_path=Path("1.json"),
            verses=[
                VerseTiming("1", 0.0, 2.0, "one two", 0.98, word_count=2),
                VerseTiming("2", 2.0, 4.0, "three four", 0.96, word_count=2),
            ],
        ),
    )

    stats = qa.compute_chapter_statistics(context, [])

    assert stats.book == "Genesis"
    assert stats.verse_count == 2
    assert stats.word_count == 4
    assert stats.average_confidence == 0.97
    assert stats.status == "PASS"


def test_hash_generation(tmp_path: Path, monkeypatch) -> None:
    """Hash reports should include SHA256 values for available artifacts."""

    monkeypatch.setattr(qa, "CONFIG", _config(tmp_path))
    context = _context(tmp_path)

    path = qa.write_hash_report(context)
    data = read_json(path)

    assert data["audio"] == qa.sha256_file(context.audio_path)
    assert data["transcript"] == qa.sha256_file(context.transcription.transcript_path)
    assert data["alignment"] == qa.sha256_file(context.alignment.alignment_path)
    assert data["index"] == qa.sha256_file(context.verse_index.index_path)


def test_summary_report(tmp_path: Path, monkeypatch) -> None:
    """Summary reports should serialize ChapterStatistics fields."""

    monkeypatch.setattr(qa, "CONFIG", _config(tmp_path))
    context = _context(tmp_path)

    path = qa.write_summary_report(context, [])
    data = read_json(path)

    assert data["book"] == "Genesis"
    assert data["chapter"] == 1
    assert data["status"] == "WARN"
    assert data["verse_count"] == 2
    assert data["word_count"] == 7
    assert data["verse_boundary_qa"][0]["verse_number"] == 2


def test_dashboard_generation(tmp_path: Path, monkeypatch) -> None:
    """Dashboard should aggregate summary reports."""

    monkeypatch.setattr(qa, "CONFIG", _config(tmp_path))
    summary_dir = tmp_path / "summary"
    summary_dir.mkdir()
    (summary_dir / "Genesis_1.json").write_text(
        '{"book":"Genesis","status":"PASS","processing_duration":2.0,"average_confidence":0.9}',
        encoding="utf-8",
    )
    (summary_dir / "Exodus_1.json").write_text(
        '{"book":"Exodus","status":"FAIL","processing_duration":3.0,"average_confidence":0.8}',
        encoding="utf-8",
    )

    path = qa.write_dashboard()
    data = read_json(path)

    assert data["books_processed"] == 2
    assert data["chapters_processed"] == 2
    assert data["chapters_failed"] == 1
    assert data["total_processing_time"] == 5.0
    assert data["average_confidence"] == 0.85
