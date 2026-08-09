"""Tests for source discovery."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from lib import discovery


def test_discovery_returns_complete_chapters_only(tmp_path: Path, monkeypatch) -> None:
    """Discovery should pair audio and text and skip incomplete chapters."""

    source = tmp_path / "source"
    genesis = source / "bible" / "genesis"
    genesis.mkdir(parents=True)
    (genesis / "genesis_1.mp3").write_bytes(b"audio")
    (genesis / "1.txt").write_text("1 In the beginning", encoding="utf-8")
    (genesis / "genesis_2.mp3").write_bytes(b"audio")

    monkeypatch.setattr(discovery, "CONFIG", SimpleNamespace(source_dir=source))

    chapters = discovery.discover_book("bible", "genesis")
    issues = discovery.discover_issues("bible", "genesis")

    assert len(chapters) == 1
    assert chapters[0].book == "Genesis"
    assert chapters[0].chapter == 1
    assert chapters[0].audio_path.name == "genesis_1.mp3"
    assert chapters[0].text_path.name == "1.txt"
    assert any(issue.reason == "Missing chapter text" for issue in issues)


def test_available_books(tmp_path: Path, monkeypatch) -> None:
    """available_books should normalize book directory names."""

    source = tmp_path / "source"
    (source / "bible" / "song_of_songs").mkdir(parents=True)
    (source / "bible" / "genesis").mkdir()
    monkeypatch.setattr(discovery, "CONFIG", SimpleNamespace(source_dir=source))

    assert discovery.available_books("bible") == ["Genesis", "Song Of Songs"]
