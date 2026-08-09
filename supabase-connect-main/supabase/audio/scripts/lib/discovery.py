"""Source discovery for batch audio processing."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .config import CONFIG
from .logger import get_logger

LOGGER = get_logger("discovery")

SUPPORTED_CONTENT_TYPES = ("bible", "readings", "saints", "catechism", "homilies")
AUDIO_EXTENSIONS = (".mp3", ".wav", ".m4a", ".flac", ".ogg")
TEXT_EXTENSIONS = (".txt", ".json")


@dataclass(frozen=True)
class SourceChapter:
    """A complete chapter source with audio and official text."""

    content_type: str
    book: str
    chapter: int
    audio_path: Path
    text_path: Optional[Path] = None


@dataclass(frozen=True)
class SourceIssue:
    """An incomplete discovered source item."""

    content_type: str
    book: str
    chapter: int
    reason: str
    path: Path | None = None


def discover_content(content_type: str) -> list[SourceChapter]:
    """Discover all complete chapters for a supported content type."""

    _validate_content_type(content_type)
    content_dir = CONFIG.source_dir / content_type
    if not content_dir.exists():
        LOGGER.warning("Missing content directory: %s", content_dir)
        return []

    chapters: list[SourceChapter] = []
    for book_dir in _book_dirs(content_dir):
        chapters.extend(discover_book(content_type, book_dir.name))
    return sorted(chapters, key=lambda item: (_book_sort_key(item.book), item.chapter))


def discover_book(content_type: str, book: str) -> list[SourceChapter]:
    """Discover complete chapters for one book."""

    _validate_content_type(content_type)
    book_dir = CONFIG.source_dir / content_type / _book_slug(book)
    if not book_dir.exists():
        LOGGER.warning("Missing book directory: %s", book_dir)
        return []

    complete: list[SourceChapter] = []
    issues = discover_issues(content_type, book)
    issue_keys = {(issue.book.lower(), issue.chapter) for issue in issues}

    for chapter in sorted(_chapter_numbers(book_dir)):
        if (_display_book(book).lower(), chapter) in issue_keys:
            continue
        audio_path = _find_audio(book_dir, book, chapter)
        text_path = _find_text(book_dir, book, chapter)
        if audio_path and (text_path or not _requires_text_file()):
            complete.append(
                SourceChapter(
                    content_type=content_type,
                    book=_display_book(book),
                    chapter=chapter,
                    audio_path=audio_path,
                    text_path=text_path,
                )
            )
    return complete


def discover_issues(content_type: str, book: str | None = None) -> list[SourceIssue]:
    """Return incomplete source items and log missing paired files."""

    _validate_content_type(content_type)
    content_dir = CONFIG.source_dir / content_type
    if not content_dir.exists():
        issue = SourceIssue(content_type, book or "", 0, "Missing content directory", content_dir)
        LOGGER.warning("%s: %s", issue.reason, issue.path)
        return [issue]

    issues: list[SourceIssue] = []
    dirs = [content_dir / _book_slug(book)] if book else _book_dirs(content_dir)
    for book_dir in dirs:
        if not book_dir.exists():
            issue = SourceIssue(content_type, _display_book(book_dir.name), 0, "Missing book directory", book_dir)
            LOGGER.warning("%s: %s", issue.reason, issue.path)
            issues.append(issue)
            continue
        for chapter in sorted(_chapter_numbers(book_dir)):
            audio_path = _find_audio(book_dir, book_dir.name, chapter)
            text_path = _find_text(book_dir, book_dir.name, chapter)
            display_book = _display_book(book_dir.name)
            if audio_path is None:
                issue = SourceIssue(content_type, display_book, chapter, "Missing audio", book_dir)
                LOGGER.warning("%s for %s %s", issue.reason, display_book, chapter)
                issues.append(issue)
            if text_path is None and _requires_text_file():
                issue = SourceIssue(content_type, display_book, chapter, "Missing chapter text", book_dir)
                LOGGER.warning("%s for %s %s", issue.reason, display_book, chapter)
                issues.append(issue)
    return issues


def available_books(content_type: str) -> list[str]:
    """Return available book names for a content type."""

    _validate_content_type(content_type)
    content_dir = CONFIG.source_dir / content_type
    if not content_dir.exists():
        return []
    return sorted((_display_book(path.name) for path in _book_dirs(content_dir)), key=_book_sort_key)


def _book_dirs(content_dir: Path) -> list[Path]:
    """Return immediate book directories below a content directory."""

    return sorted((path for path in content_dir.iterdir() if path.is_dir()), key=lambda path: path.name.lower())


def _chapter_numbers(book_dir: Path) -> set[int]:
    """Return all chapter numbers mentioned by audio or text files."""

    chapters: set[int] = set()
    for path in book_dir.iterdir():
        if path.suffix.lower() in AUDIO_EXTENSIONS + TEXT_EXTENSIONS:
            chapter = _chapter_from_stem(path.stem)
            if chapter is not None:
                chapters.add(chapter)
    return chapters


def _find_audio(book_dir: Path, book: str, chapter: int) -> Path | None:
    """Find the audio file for a chapter."""

    return _find_by_candidates(book_dir, book, chapter, AUDIO_EXTENSIONS)


def _find_text(book_dir: Path, book: str, chapter: int) -> Path | None:
    """Find the official text file for a chapter."""

    return _find_by_candidates(book_dir, book, chapter, TEXT_EXTENSIONS)


def _requires_text_file() -> bool:
    """Return whether discovery should require paired chapter text files."""

    return getattr(CONFIG, "text_provider", "file") in {"file", "json", "text"}


def _find_by_candidates(
    book_dir: Path,
    book: str,
    chapter: int,
    extensions: tuple[str, ...],
) -> Path | None:
    """Find a chapter file using conventional names or numeric stems."""

    slug = _book_slug(book)
    stems = (str(chapter), f"{slug}_{chapter}", f"{slug}-{chapter}")
    for stem in stems:
        for extension in extensions:
            path = book_dir / f"{stem}{extension}"
            if path.exists():
                return path
    for path in book_dir.iterdir():
        if path.suffix.lower() in extensions and _chapter_from_stem(path.stem) == chapter:
            return path
    return None


def _chapter_from_stem(stem: str) -> int | None:
    """Extract a chapter number from a filename stem."""

    matches = re.findall(r"\d+", stem)
    return int(matches[-1]) if matches else None


def _book_slug(book: str | None) -> str:
    """Normalize a book name to source directory style."""

    return (book or "").replace(" ", "_").strip().lower()


def _display_book(book: str) -> str:
    """Normalize a source directory name for manifests and reports."""

    return book.replace("_", " ").strip().title()


def _book_sort_key(book: str) -> str:
    """Return a stable case-insensitive book sort key."""

    return book.lower()


def _validate_content_type(content_type: str) -> None:
    """Validate supported content type."""

    if content_type not in SUPPORTED_CONTENT_TYPES:
        supported = ", ".join(SUPPORTED_CONTENT_TYPES)
        raise ValueError(f"Unsupported content type '{content_type}'. Expected one of: {supported}")
