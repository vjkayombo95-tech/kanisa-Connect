"""Opt-in integration test for Genesis Chapter 1 audio processing."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest

from process_chapter import process_chapter


SAMPLE_MP3 = (
    Path(__file__).resolve().parents[1]
    / "source"
    / "bible"
    / "genesis"
    / "genesis_1.mp3"
)
OFFICIAL_TEXT = SAMPLE_MP3.with_name("1.txt")


@pytest.mark.integration
def test_genesis_1_pipeline_integration() -> None:
    """Run the full pipeline against the single Genesis 1 sample MP3."""

    if os.environ.get("KANISA_RUN_AUDIO_INTEGRATION") != "1":
        pytest.skip("Set KANISA_RUN_AUDIO_INTEGRATION=1 to run audio integration tests")
    if not SAMPLE_MP3.exists():
        pytest.skip(f"Genesis 1 sample MP3 not found: {SAMPLE_MP3}")
    if not OFFICIAL_TEXT.exists():
        pytest.skip(f"Genesis 1 official text not found: {OFFICIAL_TEXT}")
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        pytest.skip("ffmpeg and ffprobe are required for the integration test")

    result = process_chapter(
        SAMPLE_MP3,
        book="genesis",
        chapter=1,
        content_type="bible",
        force=True,
        resume=False,
    )

    index = result["verse_index"]
    assert isinstance(index, dict)
    index_path = Path(str(index["index_path"]))
    assert index_path.exists()
    assert index_path.parts[-3:] == ("indexes", "Genesis", "1.json")
