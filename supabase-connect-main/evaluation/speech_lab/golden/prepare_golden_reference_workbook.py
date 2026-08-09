from __future__ import annotations

import argparse
import json
import os
import re
import sys
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


REPO_ROOT = Path(__file__).resolve().parents[3]
SPEECH_LAB_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = SPEECH_LAB_ROOT / ".env.evaluation"
DEFAULT_OUTPUT = SPEECH_LAB_ROOT / "golden" / "golden_reference_bible_swahili_import_ready.xlsx"
DEFAULT_AUDIO_ROOT = REPO_ROOT / "supabase" / "seed" / "bible" / "audio1" / "open bible" / "extracted"

TEXT_PROVIDER_PATH = REPO_ROOT / "supabase" / "audio" / "scripts"
sys.path.insert(0, str(TEXT_PROVIDER_PATH))

from providers.text_provider import SupabaseBibleProvider  # noqa: E402


EXPECTED_CHAPTERS = {
    ("Genesis", 1): "GEN_001",
    ("Psalm", 23): "PSA_023",
    ("Matthew", 5): "MAT_005",
    ("Romans", 8): "ROM_008",
}

BOOK_NORMALIZATION = {
    "genesis": "Genesis",
    "psalm": "Psalm",
    "psalms": "Psalm",
    "mathew": "Matthew",
    "matthew": "Matthew",
    "romans": "Romans",
}

EXPECTED_COLUMNS = [
    "chapter_id",
    "book",
    "chapter",
    "verse",
    "verse_text",
    "verse_start_ms",
    "verse_end_ms",
    "verse_confidence",
    "reviewer",
]

TITLE_COLUMNS = [
    "chapter_id",
    "book",
    "chapter",
    "title",
    "title_start_ms",
    "title_end_ms",
    "reviewer",
]


@dataclass(frozen=True)
class VerseTiming:
    sheet: str
    source_row: int
    chapter_id: str
    book: str
    chapter: int
    verse: int
    start_ms: int
    reviewer: str


@dataclass(frozen=True)
class TitleTiming:
    sheet: str
    source_row: int
    chapter_id: str
    book: str
    chapter: int
    title: str
    start_ms: int
    end_ms: int
    reviewer: str


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare human-reviewed Swahili golden references for import.")
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("--audio-root", type=Path, default=DEFAULT_AUDIO_ROOT)
    args = parser.parse_args()

    env_values = load_env_file(args.env_file)
    url = env_values.get("SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = env_values.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print(
            "Missing evaluation credentials: "
            f"env_file={args.env_file.resolve()}; "
            f"env_file_exists={args.env_file.exists()}; "
            f"SUPABASE_URL_present={bool(url)}; "
            f"SUPABASE_SERVICE_ROLE_KEY_present={bool(key)}",
            file=sys.stderr,
        )
        return 2

    workbook = read_xlsx(args.workbook)
    verse_timings, title_timings, corrections, unresolved = parse_timing_workbook(workbook)

    provider = SupabaseBibleProvider(url=url, key=key)
    verse_texts = fetch_verse_texts(provider, verse_timings)
    audio_durations = audio_duration_ms(args.audio_root, {timing.chapter_id for timing in verse_timings})

    rows, unresolved_end_times = build_import_rows(verse_timings, verse_texts, audio_durations)
    unresolved.extend(unresolved_end_times)
    validation = validate_rows(rows, verse_texts)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_xlsx(
        args.output,
        {
            "golden_references": [EXPECTED_COLUMNS, *[[row.get(column, "") for column in EXPECTED_COLUMNS] for row in rows]],
            "chapter_titles": [TITLE_COLUMNS, *[[row.get(column, "") for column in TITLE_COLUMNS] for row in title_rows(title_timings)]],
        },
    )

    report = {
        "input": str(args.workbook.resolve()),
        "output": str(args.output.resolve()),
        "verse_rows": len(rows),
        "title_rows": len(title_timings),
        "corrections": corrections,
        "unresolved": unresolved,
        "validation": validation,
        "audio_durations_ms": audio_durations,
    }
    report_path = args.output.with_suffix(".validation.json")
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if not validation["errors"] else 1


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def read_xlsx(path: Path) -> dict[str, list[dict[int, Any]]]:
    ns = {
        "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    with zipfile.ZipFile(path) as archive:
        shared_strings = read_shared_strings(archive, ns)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("pkgrel:Relationship", ns)
        }
        sheets: dict[str, list[dict[int, Any]]] = {}
        for sheet in workbook.findall("main:sheets/main:sheet", ns):
            name = sheet.attrib["name"]
            relationship_id = sheet.attrib[f"{{{ns['rel']}}}id"]
            target = rel_targets[relationship_id].lstrip("/")
            sheet_path = f"xl/{target}" if not target.startswith("xl/") else target
            sheets[name] = read_sheet(archive, sheet_path, shared_strings, ns)
        return sheets


def read_shared_strings(archive: zipfile.ZipFile, ns: dict[str, str]) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    strings: list[str] = []
    for item in root.findall("main:si", ns):
        text_parts = [node.text or "" for node in item.findall(".//main:t", ns)]
        strings.append("".join(text_parts))
    return strings


def read_sheet(
    archive: zipfile.ZipFile,
    sheet_path: str,
    shared_strings: list[str],
    ns: dict[str, str],
) -> list[dict[int, Any]]:
    root = ET.fromstring(archive.read(sheet_path))
    rows: list[dict[int, Any]] = []
    for row_node in root.findall("main:sheetData/main:row", ns):
        row: dict[int, Any] = {}
        for cell in row_node.findall("main:c", ns):
            ref = cell.attrib.get("r", "")
            column_index = column_number(ref)
            value_node = cell.find("main:v", ns)
            inline_node = cell.find("main:is/main:t", ns)
            raw_value = value_node.text if value_node is not None else inline_node.text if inline_node is not None else ""
            cell_type = cell.attrib.get("t")
            row[column_index] = cell_value(raw_value, cell_type, shared_strings)
        rows.append(row)
    return rows


def cell_value(raw_value: str | None, cell_type: str | None, shared_strings: list[str]) -> Any:
    if raw_value is None:
        return ""
    if cell_type == "s":
        return shared_strings[int(raw_value)]
    if cell_type in {"str", "inlineStr"}:
        return raw_value
    try:
        number = float(raw_value)
    except ValueError:
        return raw_value
    return int(number) if number.is_integer() else number


def column_number(cell_ref: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_ref.upper())
    total = 0
    for letter in letters:
        total = total * 26 + ord(letter) - ord("A") + 1
    return total


def parse_timing_workbook(workbook: dict[str, list[dict[int, Any]]]) -> tuple[list[VerseTiming], list[TitleTiming], list[str], list[str]]:
    verse_timings: list[VerseTiming] = []
    title_timings: list[TitleTiming] = []
    corrections: list[str] = []
    unresolved: list[str] = []

    for sheet_name, rows in workbook.items():
        header_index = find_verse_header(rows)
        if header_index is None:
            if sheet_name.casefold() != "sheet1":
                unresolved.append(f"{sheet_name}: no verse timing header found")
            continue
        title_header_index = find_title_header(rows)
        last_book = ""
        last_chapter = 0
        for source_row, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
            raw_book = clean(row.get(1))
            if raw_book:
                normalized_book = normalize_book(raw_book)
                if normalized_book and normalized_book != raw_book.strip():
                    corrections.append(f"{sheet_name} row {source_row}: normalized book {raw_book!r} to {normalized_book!r}")
                last_book = normalized_book or raw_book.strip()
            raw_chapter = row.get(2)
            if raw_chapter not in (None, ""):
                last_chapter = to_int(raw_chapter)
            verse = to_int(row.get(3))
            start_cell = row.get(4)
            if not verse or start_cell in (None, ""):
                continue
            if not raw_book and last_book:
                corrections.append(f"{sheet_name} row {source_row}: filled down book {last_book!r}")
            book = last_book
            chapter = last_chapter
            chapter_id = EXPECTED_CHAPTERS.get((book, chapter))
            if not chapter_id:
                unresolved.append(f"{sheet_name} row {source_row}: unsupported book/chapter {book!r} {chapter!r}")
                continue
            verse_timings.append(
                VerseTiming(
                    sheet=sheet_name,
                    source_row=source_row,
                    chapter_id=chapter_id,
                    book=book,
                    chapter=chapter,
                    verse=verse,
                    start_ms=seconds_to_ms(start_cell),
                    reviewer=clean(row.get(5)),
                )
            )

        if title_header_index is not None:
            title_timings.extend(parse_title_rows(sheet_name, rows, title_header_index, corrections, unresolved))

    return verse_timings, title_timings, corrections, unresolved


def find_verse_header(rows: list[dict[int, Any]]) -> int | None:
    for index, row in enumerate(rows[:8]):
        labels = [key(clean(value)) for column, value in sorted(row.items()) if column <= 5]
        if {"book", "chapter", "verse"}.issubset(set(labels)) and "startseconds" in set(labels):
            return index
    return None


def find_title_header(rows: list[dict[int, Any]]) -> int | None:
    for index, row in enumerate(rows[:8]):
        labels = [key(clean(value)) for column, value in sorted(row.items()) if column >= 6]
        if {"book", "chapter", "start", "end", "title"}.issubset(set(labels)):
            return index
    return None


def parse_title_rows(
    sheet_name: str,
    rows: list[dict[int, Any]],
    header_index: int,
    corrections: list[str],
    unresolved: list[str],
) -> list[TitleTiming]:
    output: list[TitleTiming] = []
    header = rows[header_index]
    columns = {key(value): column for column, value in header.items() if column >= 6 and clean(value)}
    book_column = columns["book"]
    chapter_column = columns["chapter"]
    start_column = columns["start"]
    end_column = columns["end"]
    title_column = columns["title"]
    reviewer_column = columns.get("reviewer")
    last_book = ""
    last_chapter = 0
    for source_row, row in enumerate(rows[header_index + 1 :], start=header_index + 2):
        raw_book = clean(row.get(book_column))
        if raw_book:
            normalized_book = normalize_book(raw_book)
            if normalized_book and normalized_book != raw_book.strip():
                corrections.append(f"{sheet_name} title row {source_row}: normalized book {raw_book!r} to {normalized_book!r}")
            last_book = normalized_book or raw_book.strip()
        chapter_cell = row.get(chapter_column)
        if chapter_cell not in (None, ""):
            try:
                last_chapter = to_int(chapter_cell)
            except ValueError:
                pass
        start_cell = row.get(start_column)
        end_cell = row.get(end_column)
        title = clean(row.get(title_column))
        reviewer = clean(row.get(reviewer_column)) if reviewer_column else ""
        if not title and start_cell in (None, "") and end_cell in (None, ""):
            continue
        book = last_book
        chapter = last_chapter
        chapter_id = EXPECTED_CHAPTERS.get((book, chapter))
        if not chapter_id:
            unresolved.append(f"{sheet_name} title row {source_row}: unsupported book/chapter {book!r} {chapter!r}")
            continue
        try:
            output.append(
                TitleTiming(
                    sheet=sheet_name,
                    source_row=source_row,
                    chapter_id=chapter_id,
                    book=book,
                    chapter=chapter,
                    title=title,
                    start_ms=seconds_to_ms(start_cell),
                    end_ms=seconds_to_ms(end_cell),
                    reviewer=reviewer,
                )
            )
        except ValueError as exc:
            unresolved.append(f"{sheet_name} title row {source_row}: malformed title timing ({exc})")
    return output


def normalize_book(value: str) -> str:
    return BOOK_NORMALIZATION.get(key(value), value.strip())


def key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).casefold())


def clean(value: Any) -> str:
    return "" if value in (None, "") else str(value).strip()


def to_int(value: Any) -> int:
    return int(float(str(value).strip()))


def seconds_to_ms(value: Any) -> int:
    if value in (None, ""):
        raise ValueError("blank timestamp")
    if isinstance(value, (int, float)):
        # Some reviewed sheets contain Excel time cells that display as MM:SS,
        # while the source column is semantically "start seconds".
        seconds = float(value) * 1440 if 0 < float(value) < 1 else float(value)
        return round(seconds * 1000)
    text = str(value).strip()
    if ":" in text:
        parts = [float(part) for part in text.split(":")]
        if len(parts) == 2:
            seconds = parts[0] * 60 + parts[1]
        elif len(parts) == 3:
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
        else:
            raise ValueError(f"unsupported timestamp {text!r}")
        return round(seconds * 1000)
    return round(float(text) * 1000)


def fetch_verse_texts(provider: SupabaseBibleProvider, timings: list[VerseTiming]) -> dict[str, dict[int, str]]:
    needed = sorted({(timing.book, timing.chapter, timing.chapter_id) for timing in timings})
    verse_texts: dict[str, dict[int, str]] = {}
    for book, chapter, chapter_id in needed:
        verses = provider.get_chapter(book, chapter, "sw-biblica")
        verse_texts[chapter_id] = {verse.verse: verse.text for verse in verses}
    return verse_texts


def audio_duration_ms(audio_root: Path, chapter_ids: set[str]) -> dict[str, int]:
    import av

    durations: dict[str, int] = {}
    for chapter_id in sorted(chapter_ids):
        book_code = chapter_id.split("_", 1)[0]
        path = audio_root / book_code / f"{chapter_id}.mp3"
        if not path.exists():
            continue
        with av.open(str(path)) as container:
            if container.duration is not None:
                durations[chapter_id] = round((container.duration / av.time_base) * 1000)
    return durations


def build_import_rows(
    timings: list[VerseTiming],
    verse_texts: dict[str, dict[int, str]],
    audio_durations: dict[str, int],
) -> tuple[list[dict[str, Any]], list[str]]:
    rows: list[dict[str, Any]] = []
    unresolved: list[str] = []
    grouped: dict[str, list[VerseTiming]] = defaultdict(list)
    for timing in timings:
        grouped[timing.chapter_id].append(timing)
    for chapter_id in sorted(grouped):
        chapter_timings = sorted(grouped[chapter_id], key=lambda item: item.verse)
        for index, timing in enumerate(chapter_timings):
            next_timing = chapter_timings[index + 1] if index + 1 < len(chapter_timings) else None
            end_ms = next_timing.start_ms if next_timing else audio_durations.get(chapter_id)
            if end_ms is None:
                unresolved.append(f"{chapter_id} verse {timing.verse}: final verse end time unresolved; audio duration unavailable")
            rows.append(
                {
                    "chapter_id": chapter_id,
                    "book": timing.book,
                    "chapter": timing.chapter,
                    "verse": timing.verse,
                    "verse_text": verse_texts.get(chapter_id, {}).get(timing.verse, ""),
                    "verse_start_ms": timing.start_ms,
                    "verse_end_ms": "" if end_ms is None else end_ms,
                    "verse_confidence": "",
                    "reviewer": timing.reviewer,
                }
            )
    return rows, unresolved


def title_rows(timings: list[TitleTiming]) -> list[dict[str, Any]]:
    return [
        {
            "chapter_id": timing.chapter_id,
            "book": timing.book,
            "chapter": timing.chapter,
            "title": timing.title,
            "title_start_ms": timing.start_ms,
            "title_end_ms": timing.end_ms,
            "reviewer": timing.reviewer,
        }
        for timing in sorted(timings, key=lambda item: (item.chapter_id, item.start_ms, item.source_row))
    ]


def validate_rows(rows: list[dict[str, Any]], verse_texts: dict[str, dict[int, str]]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    by_chapter: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_chapter[str(row["chapter_id"])].append(row)

    expected_counts = {chapter_id: len(texts) for chapter_id, texts in verse_texts.items()}
    actual_counts = {chapter_id: len(chapter_rows) for chapter_id, chapter_rows in by_chapter.items()}
    for chapter_id, expected_count in expected_counts.items():
        actual_count = actual_counts.get(chapter_id, 0)
        if actual_count != expected_count:
            errors.append(f"{chapter_id}: expected {expected_count} verses, found {actual_count}")
    for chapter_id, chapter_rows in by_chapter.items():
        seen: set[int] = set()
        previous_start = -1
        for row in sorted(chapter_rows, key=lambda item: int(item["verse"])):
            verse = int(row["verse"])
            if not row["chapter_id"]:
                errors.append(f"{chapter_id} verse {verse}: blank chapter_id")
            if not row["verse_text"]:
                errors.append(f"{chapter_id} verse {verse}: missing verse_text")
            if verse in seen:
                errors.append(f"{chapter_id} verse {verse}: duplicate verse")
            seen.add(verse)
            start_ms = int(row["verse_start_ms"])
            if start_ms <= previous_start:
                errors.append(f"{chapter_id} verse {verse}: timestamps are not strictly increasing")
            previous_start = start_ms
            end_ms = row["verse_end_ms"]
            if end_ms == "":
                warnings.append(f"{chapter_id} verse {verse}: blank verse_end_ms")
            elif int(end_ms) <= start_ms:
                errors.append(f"{chapter_id} verse {verse}: verse_end_ms is not greater than verse_start_ms")
            if (row["book"], int(row["chapter"])) not in EXPECTED_CHAPTERS:
                errors.append(f"{chapter_id} verse {verse}: book/chapter outside benchmark corpus")
    return {
        "expected_counts": expected_counts,
        "actual_counts": actual_counts,
        "errors": errors,
        "warnings": warnings,
    }


def write_xlsx(path: Path, sheets: dict[str, list[list[Any]]]) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types(len(sheets)))
        archive.writestr("_rels/.rels", package_rels())
        archive.writestr("xl/workbook.xml", workbook_xml(list(sheets)))
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels(len(sheets)))
        archive.writestr("xl/styles.xml", styles_xml())
        for index, rows in enumerate(sheets.values(), start=1):
            archive.writestr(f"xl/worksheets/sheet{index}.xml", worksheet_xml(rows))


def content_types(sheet_count: int) -> str:
    sheets = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        f"{sheets}</Types>"
    )


def package_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        "</Relationships>"
    )


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = "".join(
        f'<sheet name="{xml_escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{sheets}</sheets></workbook>"
    )


def workbook_rels(sheet_count: int) -> str:
    sheet_rels = "".join(
        f'<Relationship Id="rId{index}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        f'Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, sheet_count + 1)
    )
    styles_id = sheet_count + 1
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{sheet_rels}"
        f'<Relationship Id="rId{styles_id}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
        "</Relationships>"
    )


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        "<fonts count=\"1\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts>"
        "<fills count=\"1\"><fill><patternFill patternType=\"none\"/></fill></fills>"
        "<borders count=\"1\"><border/></borders>"
        "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>"
        "<cellXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/></cellXfs>"
        "</styleSheet>"
    )


def worksheet_xml(rows: list[list[Any]]) -> str:
    row_xml = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for column_index, value in enumerate(row, start=1):
            reference = f"{column_name(column_index)}{row_index}"
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                cells.append(f'<c r="{reference}"><v>{value}</v></c>')
            else:
                cells.append(f'<c r="{reference}" t="inlineStr"><is><t>{xml_escape(str(value))}</t></is></c>')
        row_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(row_xml)}</sheetData></worksheet>'
    )


def column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(ord("A") + remainder) + name
    return name


def xml_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


if __name__ == "__main__":
    raise SystemExit(main())
