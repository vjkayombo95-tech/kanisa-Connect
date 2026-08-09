"""Canonical Bible book metadata and lookup helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class BibleBook:
    """Canonical Bible book metadata shared by audio and text providers."""

    canonical_code: str
    english_name: str
    swahili_name: str
    standard_abbreviation: str
    audio_folder_code: str
    abbreviations: tuple[str, ...]


BIBLE_BOOKS: tuple[BibleBook, ...] = (
    BibleBook("GEN", "Genesis", "Mwanzo", "Gen", "GEN", ("Ge", "Gn", "Mwa")),
    BibleBook("EXO", "Exodus", "Kutoka", "Exod", "EXO", ("Ex", "Kut")),
    BibleBook("LEV", "Leviticus", "Mambo Ya Walawi", "Lev", "LEV", ("Le", "Law", "Wal")),
    BibleBook("NUM", "Numbers", "Hesabu", "Num", "NUM", ("Nu", "Nm", "Hes")),
    BibleBook("DEU", "Deuteronomy", "Kumbukumbu La Torati", "Deut", "DEU", ("Dt", "Kum")),
    BibleBook("JOS", "Joshua", "Yoshua", "Josh", "JOS", ("Jos", "Yos")),
    BibleBook("JDG", "Judges", "Waamuzi", "Judg", "JDG", ("Jdg", "Jg", "Waam")),
    BibleBook("RUT", "Ruth", "Ruthu", "Ruth", "RUT", ("Ru", "Rut")),
    BibleBook("1SA", "1 Samuel", "1 Samweli", "1 Sam", "1SA", ("1Sa", "1Sm", "1Samweli")),
    BibleBook("2SA", "2 Samuel", "2 Samweli", "2 Sam", "2SA", ("2Sa", "2Sm", "2Samweli")),
    BibleBook("1KI", "1 Kings", "1 Wafalme", "1 Kgs", "1KI", ("1Ki", "1K", "1Fal")),
    BibleBook("2KI", "2 Kings", "2 Wafalme", "2 Kgs", "2KI", ("2Ki", "2K", "2Fal")),
    BibleBook("1CH", "1 Chronicles", "1 Mambo Ya Nyakati", "1 Chr", "1CH", ("1Ch", "1Nya")),
    BibleBook("2CH", "2 Chronicles", "2 Mambo Ya Nyakati", "2 Chr", "2CH", ("2Ch", "2Nya")),
    BibleBook("EZR", "Ezra", "Ezra", "Ezra", "EZR", ("Ezr",)),
    BibleBook("NEH", "Nehemiah", "Nehemia", "Neh", "NEH", ("Ne",)),
    BibleBook("EST", "Esther", "Esta", "Esth", "EST", ("Est",)),
    BibleBook("JOB", "Job", "Ayubu", "Job", "JOB", ("Jb", "Ayu")),
    BibleBook("PSA", "Psalm", "Zaburi", "Ps", "PSA", ("Psa", "Psalms", "Psalm", "Zab")),
    BibleBook("PRO", "Proverbs", "Mithali", "Prov", "PRO", ("Pr", "Mit")),
    BibleBook("ECC", "Ecclesiastes", "Mhubiri", "Eccl", "ECC", ("Ecc", "Mhu")),
    BibleBook("SNG", "Song Of Songs", "Wimbo Ulio Bora", "Song", "SNG", ("Sos", "Wim")),
    BibleBook("ISA", "Isaiah", "Isaya", "Isa", "ISA", ("Is",)),
    BibleBook("JER", "Jeremiah", "Yeremia", "Jer", "JER", ("Je", "Yer")),
    BibleBook("LAM", "Lamentations", "Maombolezo", "Lam", "LAM", ("La", "Mao")),
    BibleBook("EZK", "Ezekiel", "Ezekieli", "Ezek", "EZK", ("Eze", "Ezk")),
    BibleBook("DAN", "Daniel", "Danieli", "Dan", "DAN", ("Da",)),
    BibleBook("HOS", "Hosea", "Hosea", "Hos", "HOS", ("Ho",)),
    BibleBook("JOL", "Joel", "Yoeli", "Joel", "JOL", ("Joe", "Yoe")),
    BibleBook("AMO", "Amos", "Amosi", "Amos", "AMO", ("Am",)),
    BibleBook("OBA", "Obadiah", "Obadia", "Obad", "OBA", ("Oba",)),
    BibleBook("JON", "Jonah", "Yona", "Jonah", "JON", ("Jon", "Yon")),
    BibleBook("MIC", "Micah", "Mika", "Mic", "MIC", ("Mi",)),
    BibleBook("NAM", "Nahum", "Nahumu", "Nah", "NAM", ("Na",)),
    BibleBook("HAB", "Habakkuk", "Habakuki", "Hab", "HAB", ("Habk",)),
    BibleBook("ZEP", "Zephaniah", "Sefania", "Zeph", "ZEP", ("Zep", "Sef")),
    BibleBook("HAG", "Haggai", "Hagai", "Hag", "HAG", ("Hg",)),
    BibleBook("ZEC", "Zechariah", "Zekaria", "Zech", "ZEC", ("Zec", "Zek")),
    BibleBook("MAL", "Malachi", "Malaki", "Mal", "MAL", ("Ml",)),
    BibleBook("MAT", "Matthew", "Mathayo", "Matt", "MAT", ("Mt", "Mat", "Math")),
    BibleBook("MRK", "Mark", "Marko", "Mark", "MRK", ("Mk", "Mrk")),
    BibleBook("LUK", "Luke", "Luka", "Luke", "LUK", ("Lk", "Lu")),
    BibleBook("JHN", "John", "Yohana", "John", "JHN", ("Jn", "Jhn", "Joh", "Yn", "Yoh")),
    BibleBook("ACT", "Acts", "Matendo", "Acts", "ACT", ("Ac", "Act", "Mdo", "Matendo Ya Mitume")),
    BibleBook("ROM", "Romans", "Warumi", "Rom", "ROM", ("Ro", "Rum")),
    BibleBook("1CO", "1 Corinthians", "1 Wakorintho", "1 Cor", "1CO", ("1Co", "1Kor")),
    BibleBook("2CO", "2 Corinthians", "2 Wakorintho", "2 Cor", "2CO", ("2Co", "2Kor")),
    BibleBook("GAL", "Galatians", "Wagalatia", "Gal", "GAL", ("Ga",)),
    BibleBook("EPH", "Ephesians", "Waefeso", "Eph", "EPH", ("Efe",)),
    BibleBook("PHP", "Philippians", "Wafilipi", "Phil", "PHP", ("Php", "Flp", "Fil")),
    BibleBook("COL", "Colossians", "Wakolosai", "Col", "COL", ("Co", "Kol")),
    BibleBook("1TH", "1 Thessalonians", "1 Wathesalonike", "1 Thess", "1TH", ("1Th", "1The", "1The")),
    BibleBook("2TH", "2 Thessalonians", "2 Wathesalonike", "2 Thess", "2TH", ("2Th", "2The")),
    BibleBook("1TI", "1 Timothy", "1 Timotheo", "1 Tim", "1TI", ("1Ti", "1Tim")),
    BibleBook("2TI", "2 Timothy", "2 Timotheo", "2 Tim", "2TI", ("2Ti", "2Tim")),
    BibleBook("TIT", "Titus", "Tito", "Titus", "TIT", ("Tit",)),
    BibleBook("PHM", "Philemon", "Filemoni", "Phlm", "PHM", ("Phm", "Flm")),
    BibleBook("HEB", "Hebrews", "Waebrania", "Heb", "HEB", ("Ebr",)),
    BibleBook("JAS", "James", "Yakobo", "Jas", "JAS", ("Jam", "Yak")),
    BibleBook("1PE", "1 Peter", "1 Petro", "1 Pet", "1PE", ("1Pe", "1Pet")),
    BibleBook("2PE", "2 Peter", "2 Petro", "2 Pet", "2PE", ("2Pe", "2Pet")),
    BibleBook("1JN", "1 John", "1 Yohana", "1 John", "1JN", ("1Jn", "1Jhn", "1Yoh", "1Yn")),
    BibleBook("2JN", "2 John", "2 Yohana", "2 John", "2JN", ("2Jn", "2Jhn", "2Yoh", "2Yn")),
    BibleBook("3JN", "3 John", "3 Yohana", "3 John", "3JN", ("3Jn", "3Jhn", "3Yoh", "3Yn")),
    BibleBook("JUD", "Jude", "Yuda", "Jude", "JUD", ("Jud",)),
    BibleBook("REV", "Revelation", "Ufunuo", "Rev", "REV", ("Re", "Ufu")),
)


def resolve_book_code(value: str) -> str | None:
    """Resolve a requested, database, or audio book label to canonical code."""

    return _ALIASES.get(_normalize_alias(value))


def require_book_code(value: str) -> str:
    """Resolve a book label or raise a clear error."""

    code = resolve_book_code(value)
    if not code:
        raise ValueError(f"Unknown Bible book: {value}")
    return code


def book_by_code(code: str) -> BibleBook | None:
    """Return metadata for a canonical book code."""

    return BOOKS_BY_CODE.get(code.upper())


def display_name(value: str) -> str:
    """Return the English display name for a book label when known."""

    code = resolve_book_code(value)
    book = book_by_code(code) if code else None
    return book.english_name if book else value.replace("_", " ").strip().title()


def _normalize_alias(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]", "", value.lower())
    if normalized == "psalms":
        return "psalm"
    return normalized


BOOKS_BY_CODE = {book.canonical_code: book for book in BIBLE_BOOKS}
_ALIASES = {
    _normalize_alias(alias): book.canonical_code
    for book in BIBLE_BOOKS
    for alias in (
        book.canonical_code,
        book.english_name,
        book.swahili_name,
        book.standard_abbreviation,
        book.audio_folder_code,
        *book.abbreviations,
    )
}
