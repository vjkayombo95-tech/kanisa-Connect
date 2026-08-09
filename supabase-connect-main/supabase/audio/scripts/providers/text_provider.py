"""Bible text providers for verse indexing."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import requests

from lib.bible_books import resolve_book_code
from lib.config import CONFIG
from lib.exceptions import ConfigurationError, IndexBuildError


@dataclass(frozen=True)
class BibleVerse:
    """One ordered Bible verse."""

    verse: int
    text: str


class TextProvider(Protocol):
    """Load ordered Bible verses for a chapter."""

    def get_chapter(self, book: str, chapter: int, translation: str | None = None) -> list[BibleVerse]:
        """Return ordered chapter verses."""


class FileTextProvider:
    """Legacy txt/json provider under the source directory."""

    def __init__(self, source_dir: Path | None = None) -> None:
        self.source_dir = source_dir or CONFIG.source_dir

    def get_chapter(self, book: str, chapter: int, translation: str | None = None) -> list[BibleVerse]:
        del translation
        book_dir = self.source_dir / "bible" / _slug(book)
        candidates = [
            book_dir / f"{chapter}.txt",
            book_dir / f"{_slug(book)}_{chapter}.txt",
            book_dir / f"{chapter}.json",
            book_dir / f"{_slug(book)}_{chapter}.json",
        ]
        for path in candidates:
            if path.exists():
                return parse_chapter_text(path)
        raise IndexBuildError(
            "Official chapter text not found. Expected one of: "
            + ", ".join(str(path) for path in candidates)
        )


class JsonBibleProvider(FileTextProvider):
    """Explicit JSON provider kept for backwards-compatible local fixtures."""

    def get_chapter(self, book: str, chapter: int, translation: str | None = None) -> list[BibleVerse]:
        del translation
        book_dir = self.source_dir / "bible" / _slug(book)
        candidates = [
            book_dir / f"{chapter}.json",
            book_dir / f"{_slug(book)}_{chapter}.json",
        ]
        for path in candidates:
            if path.exists():
                return parse_chapter_text(path)
        raise IndexBuildError(
            "Official chapter JSON not found. Expected one of: "
            + ", ".join(str(path) for path in candidates)
        )


class SupabaseBibleProvider:
    """Read Bible text from Supabase normalized Bible tables."""

    def __init__(
        self,
        *,
        url: str | None = None,
        key: str | None = None,
        session: requests.Session | None = None,
        timeout_seconds: float = 20.0,
    ) -> None:
        self.url = (url or CONFIG.supabase_url or os.getenv("SUPABASE_URL") or "").rstrip("/")
        self.key = key or CONFIG.supabase_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        self.session = session or requests.Session()
        self.timeout_seconds = timeout_seconds
        self._translation_cache: dict[str, dict[str, Any]] = {}
        self._book_cache: dict[tuple[str, str], dict[str, Any]] = {}
        self._chapter_cache: dict[tuple[str, str, int], dict[str, Any]] = {}

    def get_chapter(self, book: str, chapter: int, translation: str | None = None) -> list[BibleVerse]:
        if not self.url or not self.key:
            raise IndexBuildError("Supabase Bible provider requires SUPABASE_URL and a Supabase API key")

        translation_row = self._translation(translation or CONFIG.text_provider_translation)
        book_row = self._book(translation_row["id"], book)
        chapter_row = self._chapter(translation_row["id"], book_row["id"], chapter)
        rows = self._get(
            "bible_verses",
            {
                "select": "verse_number,verse_text",
                "translation_id": f"eq.{translation_row['id']}",
                "book_id": f"eq.{book_row['id']}",
                "chapter_id": f"eq.{chapter_row['id']}",
                "order": "verse_number.asc",
            },
        )
        verses = [
            BibleVerse(int(row["verse_number"]), str(row["verse_text"]))
            for row in rows
            if row.get("verse_number") is not None and row.get("verse_text") is not None
        ]
        if not verses:
            raise IndexBuildError(f"No Supabase Bible verses found for {book} {chapter}")
        return verses

    def validate_translation_exists(self, translation: str) -> None:
        """Raise a helpful configuration error when a translation code is unavailable."""

        if not self.url or not self.key:
            raise ConfigurationError("Supabase Bible provider requires SUPABASE_URL and a Supabase API key")
        try:
            self._translation(translation)
        except IndexBuildError as exc:
            raise ConfigurationError(str(exc)) from exc

    def _translation(self, translation: str) -> dict[str, Any]:
        if translation in self._translation_cache:
            return self._translation_cache[translation]
        rows = self._get(
            "bible_translations",
            {
                "select": "id,code,name",
                "code": f"eq.{translation}",
                "limit": "1",
            },
        )
        if not rows:
            raise IndexBuildError(_translation_not_found_message(translation, self.available_translations()))
        self._translation_cache[translation] = rows[0]
        return rows[0]

    def available_translations(self) -> list[dict[str, Any]]:
        """Return available Supabase Bible translation codes and names."""

        return self._get(
            "bible_translations",
            {
                "select": "code,name",
                "order": "code.asc",
            },
        )

    def chapter_numbers(self, book: str, translation: str | None = None) -> list[int]:
        """Return available chapter numbers for a book."""

        translation_row = self._translation(translation or CONFIG.text_provider_translation)
        book_row = self._book(translation_row["id"], book)
        rows = self._get(
            "bible_chapters",
            {
                "select": "chapter_number",
                "translation_id": f"eq.{translation_row['id']}",
                "book_id": f"eq.{book_row['id']}",
                "order": "chapter_number.asc",
            },
        )
        return [
            int(row["chapter_number"])
            for row in rows
            if row.get("chapter_number") is not None
        ]

    def verse_count(self, book: str, chapter: int, translation: str | None = None) -> int:
        """Return expected verse count for a book/chapter."""

        return len(self.get_chapter(book, chapter, translation))

    def _book(self, translation_id: str, book: str) -> dict[str, Any]:
        requested_code = resolve_book_code(book)
        cache_key = (translation_id, requested_code or book)
        if cache_key in self._book_cache:
            return self._book_cache[cache_key]
        rows = self._get(
            "bible_books",
            {
                "select": "id,name,abbreviation",
                "translation_id": f"eq.{translation_id}",
            },
        )
        for row in rows:
            row_code = _book_row_code(row)
            if row_code and row_code == requested_code:
                self._book_cache[cache_key] = row
                return row
        raise IndexBuildError(f"Bible book not found in Supabase: {book}")

    def _chapter(self, translation_id: str, book_id: str, chapter: int) -> dict[str, Any]:
        cache_key = (translation_id, book_id, chapter)
        if cache_key in self._chapter_cache:
            return self._chapter_cache[cache_key]
        rows = self._get(
            "bible_chapters",
            {
                "select": "id,chapter_number",
                "translation_id": f"eq.{translation_id}",
                "book_id": f"eq.{book_id}",
                "chapter_number": f"eq.{chapter}",
                "limit": "1",
            },
        )
        if not rows:
            raise IndexBuildError(f"Bible chapter not found in Supabase: {book_id} {chapter}")
        self._chapter_cache[cache_key] = rows[0]
        return rows[0]

    def _get(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        response = self.session.get(
            f"{self.url}/rest/v1/{table}",
            headers={
                "apikey": self.key or "",
                "Authorization": f"Bearer {self.key}",
                "Accept": "application/json",
            },
            params=params,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, list):
            raise IndexBuildError(f"Unexpected Supabase response for {table}")
        return [row for row in data if isinstance(row, dict)]


def get_text_provider() -> TextProvider:
    """Build the configured text provider."""

    if CONFIG.text_provider == "supabase":
        return _shared_supabase_provider()
    if CONFIG.text_provider == "json":
        return JsonBibleProvider()
    return FileTextProvider()


_SUPABASE_PROVIDER: SupabaseBibleProvider | None = None


def _shared_supabase_provider() -> SupabaseBibleProvider:
    global _SUPABASE_PROVIDER
    if _SUPABASE_PROVIDER is None:
        _SUPABASE_PROVIDER = SupabaseBibleProvider()
    return _SUPABASE_PROVIDER


def validate_configured_text_provider() -> None:
    """Validate startup configuration for the active text provider."""

    if CONFIG.text_provider != "supabase":
        return
    _shared_supabase_provider().validate_translation_exists(CONFIG.text_provider_translation)


def parse_chapter_text(path: Path) -> list[BibleVerse]:
    """Parse verse text from a supported chapter text file."""

    if path.suffix.lower() == ".json":
        return _parse_chapter_json(path)

    verses: list[BibleVerse] = []
    pattern = re.compile(r"^\s*(?:[1-3]?\s?[A-Za-z]+\s+\d+:)?(\d+)\s+(.+?)\s*$")
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        match = pattern.match(line)
        if not match:
            raise IndexBuildError(f"Unable to parse verse line in {path}: {line}")
        verses.append(BibleVerse(int(match.group(1)), match.group(2).strip()))
    if not verses:
        raise IndexBuildError(f"Official chapter text has no verses: {path}")
    return verses


def _parse_chapter_json(path: Path) -> list[BibleVerse]:
    data = json.loads(path.read_text(encoding="utf-8"))
    raw_verses = data.get("verses") if isinstance(data, dict) else data
    if not isinstance(raw_verses, list):
        raise IndexBuildError(f"Chapter JSON must contain a verses list: {path}")
    verses: list[BibleVerse] = []
    for item in raw_verses:
        if not isinstance(item, dict):
            raise IndexBuildError(f"Invalid verse object in {path}")
        verse_number = item.get("verse", item.get("number"))
        text = item.get("text")
        if verse_number is None or text is None:
            raise IndexBuildError(f"Verse object missing verse/text in {path}")
        verses.append(BibleVerse(int(verse_number), str(text)))
    if not verses:
        raise IndexBuildError(f"Chapter JSON has no verses: {path}")
    return verses


def _slug(book: str) -> str:
    return book.replace(" ", "_").strip().lower()


def _book_row_code(row: dict[str, Any]) -> str | None:
    for key in ("canonical_code", "code", "abbreviation", "name"):
        value = row.get(key)
        if value:
            code = resolve_book_code(str(value))
            if code:
                return code
    return None


def _translation_not_found_message(translation: str, available: list[dict[str, Any]]) -> str:
    lines = [
        f"Bible translation '{translation}' was not found.",
        "",
        "Available translations:",
    ]
    if not available:
        lines.append("- none")
    else:
        for row in available:
            code = str(row.get("code", "")).strip()
            name = str(row.get("name", "")).strip()
            if code and name:
                lines.append(f"- {code} ({name})")
            elif code:
                lines.append(f"- {code}")
    return "\n".join(lines)
