from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

from .canonical_text import load_canonical_verses_from_supabase
from .corpus import BENCHMARK_CORPUS, chapter_by_id
from .supabase_store import DEFAULT_ENV_FILE, EvaluationSupabaseStore


_PREPARE_WORKBOOK_PATH = Path(__file__).resolve().parent / "golden" / "prepare_golden_reference_workbook.py"
_SPEC = importlib.util.spec_from_file_location("prepare_golden_reference_workbook", _PREPARE_WORKBOOK_PATH)
if _SPEC is None or _SPEC.loader is None:  # pragma: no cover
    raise ImportError(f"Cannot load workbook utilities from {_PREPARE_WORKBOOK_PATH}")
_WORKBOOK_UTILS = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _WORKBOOK_UTILS
_SPEC.loader.exec_module(_WORKBOOK_UTILS)
read_xlsx = _WORKBOOK_UTILS.read_xlsx
write_xlsx = _WORKBOOK_UTILS.write_xlsx


REVIEW_COLUMNS = [
    "chapter_id",
    "book",
    "chapter",
    "verse",
    "canonical_verse_text",
    "spoken_reference_text",
    "verse_start_ms",
    "verse_end_ms",
    "spoken_text_review_status",
    "reviewer",
    "review_notes",
]

INTRO_COLUMNS = [
    "chapter_id",
    "introduction_type",
    "spoken_text",
    "start_ms",
    "end_ms",
    "review_status",
    "reviewer",
    "notes",
]

VALID_MODES = {"pending", "reviewed_exact", "reviewed_minor_uncertainty", "audio_unclear"}
VALID_INTRO_TYPES = {"book_title", "chapter_title", "section_heading", "narrator_intro", "other_non_verse"}


def create_review_workbook(output: str | Path, *, env_file: str | Path | None = DEFAULT_ENV_FILE) -> Path:
    store = EvaluationSupabaseStore.from_env_file(env_file)
    verse_rows = [REVIEW_COLUMNS]
    intro_rows = [INTRO_COLUMNS]
    for chapter in BENCHMARK_CORPUS:
        if chapter.id == "JHN_003":
            continue
        golden = store.load_golden_reference(chapter.id)
        canonical = {verse.verse: verse.text for verse in load_canonical_verses_from_supabase(chapter.id, env_file=env_file)}
        boundaries = {boundary.verse: boundary for boundary in golden.verse_boundaries}
        for verse_number in sorted(canonical):
            boundary = boundaries.get(verse_number)
            verse_rows.append(
                [
                    chapter.id,
                    chapter.book,
                    chapter.chapter,
                    verse_number,
                    canonical[verse_number],
                    "",
                    boundary.start_ms if boundary else "",
                    boundary.end_ms if boundary else "",
                    "pending",
                    "",
                    "",
                ]
            )
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_xlsx(path, {"verses": verse_rows, "introductions": intro_rows})
    return path


def validate_review_workbook(path: str | Path) -> dict[str, Any]:
    workbook = read_xlsx(Path(path))
    errors: list[str] = []
    warnings: list[str] = []
    verse_rows = _rows(workbook.get("verses", []))
    intro_rows = _rows(workbook.get("introductions", []))
    seen_verses: set[tuple[str, int]] = set()
    previous_by_chapter: dict[str, int] = {}
    canonical_by_key: dict[tuple[str, int], str] = {}
    for row in verse_rows:
        chapter_id = str(row.get("chapter_id", "")).strip()
        verse = _int(row.get("verse"))
        key = (chapter_id, verse)
        if chapter_id:
            try:
                chapter_by_id(chapter_id)
            except KeyError:
                errors.append(f"Invalid chapter_id: {chapter_id}")
        if key in seen_verses:
            errors.append(f"Duplicate verse row: {chapter_id} {verse}")
        seen_verses.add(key)
        canonical = str(row.get("canonical_verse_text", "")).strip()
        if key in canonical_by_key and canonical_by_key[key] != canonical:
            errors.append(f"Canonical text changed for {chapter_id} verse {verse}")
        canonical_by_key[key] = canonical
        status = str(row.get("spoken_text_review_status", "pending")).strip() or "pending"
        if status not in VALID_MODES:
            errors.append(f"Invalid review status for {chapter_id} verse {verse}: {status}")
        spoken = str(row.get("spoken_reference_text", "")).strip()
        reviewer = str(row.get("reviewer", "")).strip()
        if status == "reviewed_exact" and not spoken:
            errors.append(f"Exact spoken text required for reviewed_exact: {chapter_id} verse {verse}")
        if status != "pending" and not reviewer:
            errors.append(f"Reviewer required for reviewed row: {chapter_id} verse {verse}")
        start = _optional_int(row.get("verse_start_ms"))
        end = _optional_int(row.get("verse_end_ms"))
        if start is not None and end is not None:
            if start >= end:
                errors.append(f"Verse start must be before end: {chapter_id} verse {verse}")
            previous = previous_by_chapter.get(chapter_id)
            if previous is not None and start < previous:
                errors.append(f"Verse timestamps not monotonic: {chapter_id} verse {verse}")
            previous_by_chapter[chapter_id] = start
    seen_intro_ranges: set[tuple[str, int, int]] = set()
    verse_ranges = [
        (str(row.get("chapter_id", "")).strip(), _optional_int(row.get("verse_start_ms")), _optional_int(row.get("verse_end_ms")))
        for row in verse_rows
    ]
    for row in intro_rows:
        if not any(str(value).strip() for value in row.values()):
            continue
        chapter_id = str(row.get("chapter_id", "")).strip()
        intro_type = str(row.get("introduction_type", "")).strip()
        start = _optional_int(row.get("start_ms"))
        end = _optional_int(row.get("end_ms"))
        reviewer = str(row.get("reviewer", "")).strip()
        status = str(row.get("review_status", "pending")).strip() or "pending"
        if intro_type not in VALID_INTRO_TYPES:
            errors.append(f"Invalid introduction_type: {intro_type}")
        if status != "pending" and not reviewer:
            errors.append(f"Reviewer required for reviewed introduction: {chapter_id} {start}-{end}")
        if start is None or end is None or start >= end:
            errors.append(f"Introduction start/end invalid: {chapter_id} {start}-{end}")
            continue
        range_key = (chapter_id, start, end)
        if range_key in seen_intro_ranges:
            errors.append(f"Duplicate introduction range: {chapter_id} {start}-{end}")
        seen_intro_ranges.add(range_key)
        for verse_chapter, verse_start, verse_end in verse_ranges:
            if chapter_id == verse_chapter and verse_start is not None and verse_end is not None and start < verse_end and end > verse_start:
                warnings.append(f"Introduction overlaps verse content: {chapter_id} {start}-{end}")
    return {"errors": errors, "warnings": warnings}


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or validate spoken-reference review workbooks.")
    subcommands = parser.add_subparsers(dest="command", required=True)
    create = subcommands.add_parser("create")
    create.add_argument("--output", default="evaluation/speech_lab/golden/golden_reference_spoken_text_review_template.xlsx")
    create.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    validate = subcommands.add_parser("validate")
    validate.add_argument("--input", required=True)
    args = parser.parse_args()
    if args.command == "create":
        print(create_review_workbook(args.output, env_file=args.env_file))
        return 0
    result = validate_review_workbook(args.input)
    print(json.dumps(result, indent=2))
    return 0 if not result["errors"] else 1


def _rows(raw_rows: list[dict[int, Any]]) -> list[dict[str, Any]]:
    if not raw_rows:
        return []
    headers = [str(raw_rows[0].get(index, "")).strip() for index in sorted(raw_rows[0])]
    rows = []
    for raw in raw_rows[1:]:
        row = {headers[index - 1]: raw.get(index, "") for index in range(1, len(headers) + 1)}
        if any(str(value).strip() for value in row.values()):
            rows.append(row)
    return rows


def _int(value: Any) -> int:
    return int(float(str(value).strip()))


def _optional_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    return _int(value)


if __name__ == "__main__":
    raise SystemExit(main())
