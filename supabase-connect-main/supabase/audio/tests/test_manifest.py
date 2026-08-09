"""Tests for manifest persistence."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from lib.filesystem import read_json
from lib.models import AudioMetadata, PipelineContext
from lib import manifest


def test_manifest_writer_records_latest_successful_stage(tmp_path: Path, monkeypatch) -> None:
    """write_manifest should persist boolean stage progress flags."""

    monkeypatch.setattr(manifest, "CONFIG", SimpleNamespace(reports_dir=tmp_path))
    context = PipelineContext(
        book="Genesis",
        chapter=1,
        content_type="bible",
        audio_path=tmp_path / "genesis_1.mp3",
        metadata=AudioMetadata(
            path=tmp_path / "genesis_1.mp3",
            duration_seconds=1.0,
            bitrate_bps=128000,
            sample_rate_hz=44100,
            channels=2,
            codec_name="mp3",
            format_name="mp3",
        ),
        status="validated",
    )

    manifest.write_manifest(context)
    data = read_json(tmp_path / "manifests" / "Genesis_1.json")

    assert data["book"] == "Genesis"
    assert data["chapter"] == 1
    assert data["status"] == "validated"
    assert data["metadata"] is True
    assert data["transcription"] is False
    assert data["imported"] is False
