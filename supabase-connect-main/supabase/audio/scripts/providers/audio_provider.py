"""Audio source providers for chapter processing."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from lib.bible_books import book_by_code, display_name, resolve_book_code
from lib.config import CONFIG
from lib.exceptions import AudioPipelineError
from lib.logger import get_logger

AUDIO_EXTENSIONS = (".mp3", ".wav", ".m4a", ".flac", ".ogg")
LOGGER = get_logger("open_bible_audio_provider")


@dataclass(frozen=True)
class AudioSource:
    """Resolved audio source metadata."""

    book: str
    chapter: int
    path: Path


class AudioProvider(Protocol):
    """Resolve chapter audio files from a backing source."""

    def resolve(self, book: str, chapter: int, content_type: str = "bible") -> AudioSource:
        """Return the audio file for a book/chapter."""


class FileAudioProvider:
    """Legacy source directory provider."""

    def __init__(self, source_dir: Path | None = None) -> None:
        self.source_dir = source_dir or CONFIG.source_dir

    def resolve(self, book: str, chapter: int, content_type: str = "bible") -> AudioSource:
        display_book = display_name(book)
        slug = _slug(book)
        book_dir = self.source_dir / content_type / slug
        candidates = [
            book_dir / f"{chapter}.mp3",
            book_dir / f"{slug}_{chapter}.mp3",
            book_dir / f"{slug}-{chapter}.mp3",
        ]
        for path in candidates:
            if path.exists():
                return AudioSource(display_book, chapter, path.resolve())
        for path in book_dir.glob("*") if book_dir.exists() else []:
            if path.suffix.lower() in AUDIO_EXTENSIONS and _chapter_from_stem(path.stem) == chapter:
                return AudioSource(display_book, chapter, path.resolve())
        raise AudioPipelineError(f"Audio file not found for {display_book} {chapter}")


class OpenBibleAudioProvider:
    """Discover Open Bible audio book folders and chapter MP3 files."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = _resolve_provider_base_dir(base_dir or CONFIG.audio_provider_base_dir)
        LOGGER.info("Open Bible audio base directory resolved to: %s", self.base_dir)
        if not self.base_dir.exists():
            raise AudioPipelineError(f"Open Bible audio directory does not exist: {self.base_dir}")
        if not self.base_dir.is_dir():
            raise AudioPipelineError(f"Open Bible audio base path is not a directory: {self.base_dir}")

    def resolve(self, book: str, chapter: int, content_type: str = "bible") -> AudioSource:
        del content_type
        requested_code = resolve_book_code(book)
        chapter_files = self._chapter_files()
        if requested_code:
            direct_path = self.base_dir / requested_code / f"{requested_code}_{chapter:03d}.mp3"
            if direct_path.exists():
                parsed = self.parse_audio_path(direct_path)
                if parsed:
                    return AudioSource(parsed.book, parsed.chapter, direct_path.resolve())
        for path in chapter_files:
            parsed = self.parse_audio_path(path)
            if parsed and resolve_book_code(parsed.book) == requested_code and parsed.chapter == chapter:
                return AudioSource(parsed.book, parsed.chapter, path.resolve())
        expected_filename = _expected_filename(book, chapter)
        matching_files = _matching_files(chapter_files, book, chapter)
        LOGGER.warning(
            "Open Bible audio not found for %s %s. searched_directory=%s expected_filename=%s discovered_matching_files=%s",
            display_name(book),
            chapter,
            self.base_dir,
            expected_filename,
            [str(path) for path in matching_files],
        )
        raise AudioPipelineError(
            "Open Bible audio not found for "
            f"{display_name(book)} {chapter}. "
            f"Searched directory: {self.base_dir}. "
            f"Expected filename: {expected_filename}. "
            f"Discovered matching files: {_format_matching_files(matching_files)}"
        )

    def discover(self) -> list[AudioSource]:
        """Return all discoverable chapter MP3s."""

        sources = [source for path in self._chapter_files() if (source := self.parse_audio_path(path))]
        return sorted(sources, key=lambda item: (resolve_book_code(item.book) or item.book, item.chapter))

    def parse_audio_path(self, path: Path) -> AudioSource | None:
        """Parse names like JHN_001.mp3 into John chapter 1."""

        return _parse_open_bible_audio_path(path)

    def _chapter_files(self) -> list[Path]:
        if not self.base_dir.exists():
            return []
        return sorted(
            (path for path in self.base_dir.rglob("*") if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS),
            key=lambda path: str(path).lower(),
        )


def get_audio_provider() -> AudioProvider:
    """Build the configured audio provider."""

    if CONFIG.audio_provider in {"open_bible", "openbible"}:
        return OpenBibleAudioProvider()
    return FileAudioProvider()


def _project_root() -> Path:
    """Return the repository root from the audio package root."""

    return CONFIG.root_dir.parents[1]


def _resolve_provider_base_dir(base_dir: Path) -> Path:
    """Resolve absolute paths directly and relative paths from the project root."""

    expanded = Path(base_dir).expanduser()
    if expanded.is_absolute():
        return expanded.resolve()
    return (_project_root() / expanded).resolve()


def _expected_filename(book: str, chapter: int) -> str:
    """Return the canonical Open Bible chapter filename for diagnostics."""

    code = resolve_book_code(book)
    return f"{code}_{chapter:03d}.mp3" if code else f"{_slug(book).upper()}_{chapter:03d}.mp3"


def _matching_files(paths: list[Path], book: str, chapter: int) -> list[Path]:
    """Return files matching the requested book or chapter for diagnostics."""

    requested_code = resolve_book_code(book)
    matches: list[Path] = []
    for path in paths:
        parsed = _parse_open_bible_audio_path(path)
        if parsed and (resolve_book_code(parsed.book) == requested_code or parsed.chapter == chapter):
            matches.append(path)
    return matches[:25]


def _format_matching_files(paths: list[Path]) -> str:
    """Format matching files for a clear exception message."""

    if not paths:
        return "none"
    return ", ".join(str(path) for path in paths)


def _chapter_from_stem(stem: str) -> int | None:
    matches = re.findall(r"\d+", stem)
    return int(matches[-1]) if matches else None


def _parse_open_bible_audio_path(path: Path) -> AudioSource | None:
    """Parse names like JHN_001.mp3 into John chapter 1."""

    if path.suffix.lower() not in AUDIO_EXTENSIONS:
        return None
    match = re.match(r"^([1-3]?[A-Za-z]{2,4})[_-](\d{1,3})$", path.stem)
    if not match:
        return None
    code = match.group(1).upper()
    book = book_by_code(code)
    if not book:
        return None
    return AudioSource(book.english_name, int(match.group(2)), path)


def _slug(book: str) -> str:
    return book.replace(" ", "_").strip().lower()
