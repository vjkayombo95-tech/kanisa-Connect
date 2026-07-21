"""Tests for production audio and Bible text providers."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from lib.bible_books import BIBLE_BOOKS, resolve_book_code
from lib.exceptions import AudioPipelineError, ConfigurationError, IndexBuildError
from providers.audio_provider import OpenBibleAudioProvider
from providers.text_provider import SupabaseBibleProvider, validate_configured_text_provider


class FakeResponse:
    """Minimal requests response for provider tests."""

    def __init__(self, payload: list[dict[str, Any]]) -> None:
        self.payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> list[dict[str, Any]]:
        return self.payload


class FakeSession:
    """Route Supabase REST requests to in-memory Bible rows."""

    def __init__(self, translations: list[dict[str, str]] | None = None) -> None:
        self.translations = translations or [
            {"id": "translation-cpdv", "code": "CPDV", "name": "CPDV"}
        ]
        self.books = [
            {"id": "book-gen", "name": "Mwanzo", "abbreviation": "Mwa"},
            {"id": "book-psa", "name": "Zaburi", "abbreviation": "Zab"},
            {"id": "book-jhn", "name": "Yohana", "abbreviation": "Yn"},
        ]
        self.chapters = [
            {"id": "chapter-gen-1", "book_id": "book-gen", "chapter_number": 1},
            {"id": "chapter-psa-23", "book_id": "book-psa", "chapter_number": 23},
            {"id": "chapter-jhn-3", "book_id": "book-jhn", "chapter_number": 3},
        ]
        self.verses = [
            {"chapter_id": "chapter-gen-1", "verse_number": 1, "verse_text": "In the beginning God created."},
            {"chapter_id": "chapter-gen-1", "verse_number": 2, "verse_text": "The earth was without form."},
            {"chapter_id": "chapter-psa-23", "verse_number": 1, "verse_text": "The Lord is my shepherd."},
            {"chapter_id": "chapter-jhn-3", "verse_number": 16, "verse_text": "For God so loved the world."},
        ]

    def get(self, url: str, **kwargs: Any) -> FakeResponse:
        params = kwargs["params"]
        table = url.rsplit("/", 1)[-1]
        if table == "bible_translations":
            code_filter = params.get("code")
            if code_filter:
                code = code_filter.removeprefix("eq.")
                return FakeResponse(
                    [row for row in self.translations if row.get("code") == code]
                )
            return FakeResponse(self.translations)
        if table == "bible_books":
            return FakeResponse(self.books)
        if table == "bible_chapters":
            book_id = params["book_id"].removeprefix("eq.")
            chapter = int(params["chapter_number"].removeprefix("eq."))
            return FakeResponse(
                [
                    {"id": row["id"], "chapter_number": row["chapter_number"]}
                    for row in self.chapters
                    if row["book_id"] == book_id and row["chapter_number"] == chapter
                ]
            )
        if table == "bible_verses":
            chapter_id = params["chapter_id"].removeprefix("eq.")
            return FakeResponse(
                [
                    {"verse_number": row["verse_number"], "verse_text": row["verse_text"]}
                    for row in sorted(self.verses, key=lambda item: int(item["verse_number"]))
                    if row["chapter_id"] == chapter_id
                ]
            )
        return FakeResponse([])


def test_open_bible_audio_provider_resolves_common_books(tmp_path: Path) -> None:
    """Open Bible filenames should map to canonical book/chapter pairs."""

    (tmp_path / "John").mkdir()
    (tmp_path / "Genesis").mkdir()
    (tmp_path / "Psalms").mkdir()
    john = tmp_path / "John" / "JHN_003.mp3"
    genesis = tmp_path / "Genesis" / "GEN_001.mp3"
    psalm = tmp_path / "Psalms" / "PSA_023.mp3"
    john.write_bytes(b"audio")
    genesis.write_bytes(b"audio")
    psalm.write_bytes(b"audio")

    provider = OpenBibleAudioProvider(tmp_path)

    assert provider.resolve("John", 3).path == john.resolve()
    assert provider.resolve("Genesis", 1).path == genesis.resolve()
    assert provider.resolve("Psalm", 23).path == psalm.resolve()


def test_all_66_books_have_canonical_resolvers() -> None:
    """Every configured Bible book should resolve by code, names, and abbreviations."""

    assert len(BIBLE_BOOKS) == 66
    for book in BIBLE_BOOKS:
        aliases = [
            book.canonical_code,
            book.canonical_code.lower(),
            book.english_name,
            book.english_name.lower(),
            book.swahili_name,
            book.standard_abbreviation,
            book.audio_folder_code,
            *book.abbreviations,
        ]
        for alias in aliases:
            assert resolve_book_code(alias) == book.canonical_code


def test_john_public_api_aliases_resolve_to_jhn() -> None:
    """The pipeline public API should accept English, Swahili, code, and abbreviations."""

    for alias in ["John", "john", "JHN", "Jn", "Jhn", "Yohana", "Yn"]:
        assert resolve_book_code(alias) == "JHN"


def test_open_bible_audio_provider_resolves_aliases_to_canonical_folder(tmp_path: Path) -> None:
    """Open Bible lookup should use canonical audio folder code and filename."""

    book_dir = tmp_path / "JHN"
    book_dir.mkdir()
    expected = book_dir / "JHN_003.mp3"
    expected.write_bytes(b"audio")
    provider = OpenBibleAudioProvider(tmp_path)

    for alias in ["John", "john", "JHN", "Jn", "Jhn", "Yohana", "Yn"]:
        assert provider.resolve(alias, 3).path == expected.resolve()


def test_open_bible_audio_provider_resolves_all_66_books(tmp_path: Path) -> None:
    """Every canonical book should resolve through its audio folder code."""

    for book in BIBLE_BOOKS:
        book_dir = tmp_path / book.audio_folder_code
        book_dir.mkdir()
        (book_dir / f"{book.audio_folder_code}_001.mp3").write_bytes(b"audio")
    provider = OpenBibleAudioProvider(tmp_path)

    for book in BIBLE_BOOKS:
        expected = tmp_path / book.audio_folder_code / f"{book.audio_folder_code}_001.mp3"
        assert provider.resolve(book.english_name, 1).path == expected.resolve()
        assert provider.resolve(book.swahili_name, 1).path == expected.resolve()
        assert provider.resolve(book.canonical_code, 1).path == expected.resolve()


def test_open_bible_audio_provider_resolves_relative_paths_from_project_root() -> None:
    """Configured relative paths should resolve from the repository root."""

    provider = OpenBibleAudioProvider(Path("supabase/seed/bible/audio1/open bible/extracted"))

    assert provider.resolve("John", 1).path.name == "JHN_001.mp3"


def test_open_bible_audio_provider_reports_missing_directory(tmp_path: Path) -> None:
    """Missing base directories should include the resolved path."""

    missing = tmp_path / "missing open bible"

    with pytest.raises(AudioPipelineError, match="Open Bible audio directory does not exist") as exc:
        OpenBibleAudioProvider(missing)

    assert str(missing.resolve()) in str(exc.value)


def test_open_bible_audio_provider_reports_not_found_diagnostics(tmp_path: Path, caplog) -> None:
    """Book/chapter misses should log searched path, expected file, and nearby files."""

    (tmp_path / "JHN").mkdir()
    (tmp_path / "JHN" / "JHN_001.mp3").write_bytes(b"audio")
    provider = OpenBibleAudioProvider(tmp_path)

    with pytest.raises(AudioPipelineError) as exc:
        provider.resolve("John", 3)

    message = str(exc.value)
    assert str(tmp_path.resolve()) in message
    assert "JHN_003.mp3" in message
    assert "JHN_001.mp3" in message
    assert "searched_directory" in caplog.text
    assert "expected_filename=JHN_003.mp3" in caplog.text


def test_supabase_bible_provider_returns_ordered_verses() -> None:
    """Supabase provider should resolve book/chapter text without local files."""

    provider = SupabaseBibleProvider(
        url="https://example.supabase.co",
        key="test-key",
        session=FakeSession(),
    )

    john = provider.get_chapter("John", 3, "CPDV")
    genesis = provider.get_chapter("Genesis", 1, "CPDV")
    psalm = provider.get_chapter("Psalm", 23, "CPDV")
    yohana = provider.get_chapter("Yohana", 3, "CPDV")
    yohana_abbrev = provider.get_chapter("Yn", 3, "CPDV")

    assert [(verse.verse, verse.text) for verse in john] == [(16, "For God so loved the world.")]
    assert [verse.verse for verse in genesis] == [1, 2]
    assert psalm[0].text == "The Lord is my shepherd."
    assert yohana == john
    assert yohana_abbrev == john


def test_supabase_bible_provider_matches_canonical_codes_not_locale_strings() -> None:
    """Supabase localized names and requested aliases should resolve through canonical codes."""

    provider = SupabaseBibleProvider(
        url="https://example.supabase.co",
        key="test-key",
        session=FakeSession(),
    )

    for alias in ["John", "john", "JHN", "Jn", "Jhn", "Yohana", "Yn"]:
        verses = provider.get_chapter(alias, 3, "CPDV")
        assert verses[0].verse == 16


def test_supabase_bible_provider_resolves_all_66_localized_rows() -> None:
    """Localized Supabase book rows should match requested books by canonical code."""

    session = FakeSession()
    session.books = [
        {
            "id": f"book-{book.canonical_code.lower()}",
            "name": book.swahili_name,
            "abbreviation": book.abbreviations[-1] if book.abbreviations else book.standard_abbreviation,
        }
        for book in BIBLE_BOOKS
    ]
    session.chapters = [
        {
            "id": f"chapter-{book.canonical_code.lower()}-1",
            "book_id": f"book-{book.canonical_code.lower()}",
            "chapter_number": 1,
        }
        for book in BIBLE_BOOKS
    ]
    session.verses = [
        {
            "chapter_id": f"chapter-{book.canonical_code.lower()}-1",
            "verse_number": 1,
            "verse_text": f"{book.english_name} verse",
        }
        for book in BIBLE_BOOKS
    ]
    provider = SupabaseBibleProvider(
        url="https://example.supabase.co",
        key="test-key",
        session=session,
    )

    for book in BIBLE_BOOKS:
        assert provider.get_chapter(book.english_name, 1, "CPDV")[0].text == f"{book.english_name} verse"
        assert provider.get_chapter(book.swahili_name, 1, "CPDV")[0].text == f"{book.english_name} verse"
        assert provider.get_chapter(book.canonical_code, 1, "CPDV")[0].text == f"{book.english_name} verse"


def test_supabase_bible_provider_validates_existing_translation() -> None:
    """Startup translation checks should pass for available translation codes."""

    provider = SupabaseBibleProvider(
        url="https://example.supabase.co",
        key="test-key",
        session=FakeSession(
            [{"id": "translation-sw", "code": "sw-biblica", "name": "Biblica Toleo Wazi Neno"}]
        ),
    )

    provider.validate_translation_exists("sw-biblica")


def test_supabase_bible_provider_reports_available_translations_when_missing() -> None:
    """Missing translations should include available Supabase translation rows."""

    provider = SupabaseBibleProvider(
        url="https://example.supabase.co",
        key="test-key",
        session=FakeSession(
            [{"id": "translation-sw", "code": "sw-biblica", "name": "Biblica Toleo Wazi Neno"}]
        ),
    )

    with pytest.raises(IndexBuildError) as exc:
        provider.get_chapter("John", 3, "CPDV")

    message = str(exc.value)
    assert "Bible translation 'CPDV' was not found." in message
    assert "Available translations:" in message
    assert "- sw-biblica (Biblica Toleo Wazi Neno)" in message


def test_configured_text_provider_startup_validation(monkeypatch) -> None:
    """Startup validation should fail fast with a configuration error."""

    import providers.text_provider as text_provider

    provider = SupabaseBibleProvider(
        url="https://example.supabase.co",
        key="test-key",
        session=FakeSession(
            [{"id": "translation-sw", "code": "sw-biblica", "name": "Biblica Toleo Wazi Neno"}]
        ),
    )
    monkeypatch.setattr(
        text_provider,
        "CONFIG",
        SimpleNamespace(text_provider="supabase", text_provider_translation="CPDV"),
    )
    monkeypatch.setattr(text_provider, "SupabaseBibleProvider", lambda: provider)

    with pytest.raises(ConfigurationError) as exc:
        validate_configured_text_provider()

    assert "Bible translation 'CPDV' was not found." in str(exc.value)
    assert "- sw-biblica (Biblica Toleo Wazi Neno)" in str(exc.value)
