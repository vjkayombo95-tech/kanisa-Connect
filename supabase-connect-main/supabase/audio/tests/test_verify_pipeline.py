"""Tests for the pipeline verification command."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import verify_pipeline
from lib.filesystem import write_json
from lib import qa


def test_verify_pipeline_reports_missing_manifests(tmp_path: Path, monkeypatch) -> None:
    """Verifier should fail when no manifests exist."""

    config = SimpleNamespace(
        reports_dir=tmp_path,
        transcripts_dir=tmp_path / "transcripts",
        alignments_dir=tmp_path / "alignments",
        indexes_dir=tmp_path / "indexes",
    )
    monkeypatch.setattr(verify_pipeline, "CONFIG", config)
    monkeypatch.setattr(qa, "CONFIG", config)

    issues = verify_pipeline.verify_pipeline()

    assert issues
    assert "Missing manifests directory" in issues[0]


def test_verify_pipeline_passes_complete_artifacts(tmp_path: Path, monkeypatch) -> None:
    """Verifier should pass a complete chapter artifact set."""

    config = SimpleNamespace(
        reports_dir=tmp_path / "reports",
        transcripts_dir=tmp_path / "transcripts",
        alignments_dir=tmp_path / "alignments",
        indexes_dir=tmp_path / "indexes",
    )
    monkeypatch.setattr(verify_pipeline, "CONFIG", config)
    monkeypatch.setattr(qa, "CONFIG", config)

    audio = tmp_path / "genesis_1.mp3"
    transcript = config.transcripts_dir / "genesis_1.transcript.json"
    alignment = config.alignments_dir / "Genesis" / "1.json"
    index = config.indexes_dir / "Genesis" / "1.json"
    for path, content in [
        (audio, b"audio"),
        (transcript, b"{}"),
        (alignment, b"{}"),
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    write_json(
        index,
        {
            "book": "Genesis",
            "chapter": 1,
            "audio_path": str(audio),
            "verses": [
                {
                    "verse": 1,
                    "start": 0.0,
                    "end": 1.0,
                    "confidence": 0.99,
                    "duration": 1.0,
                    "word_count": 2,
                    "text": "hello world",
                }
            ],
        },
    )
    write_json(
        config.reports_dir / "manifests" / "Genesis_1.json",
        {"book": "Genesis", "chapter": 1, "audio_path": str(audio)},
    )
    hashes = {
        "audio": qa.sha256_file(audio),
        "transcript": qa.sha256_file(transcript),
        "alignment": qa.sha256_file(alignment),
        "index": qa.sha256_file(index),
    }
    write_json(config.reports_dir / "hashes" / "Genesis_1.json", hashes)
    write_json(
        config.reports_dir / "summary" / "Genesis_1.json",
        {"book": "Genesis", "status": "PASS", "processing_duration": 1.0, "average_confidence": 0.99},
    )
    html = config.reports_dir / "html" / "Genesis_1.html"
    html.parent.mkdir(parents=True)
    html.write_text("<html></html>", encoding="utf-8")

    assert verify_pipeline.verify_pipeline() == []
