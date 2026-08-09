from __future__ import annotations

import argparse
import csv
import json
import re
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree as ET

from .corpus import chapter_by_id
from .metrics import CERCalculator, WERCalculator, normalize_text, token_similarity_score, word_order_similarity
from .models import Transcript
from .verse_alignment import CanonicalVerse, align_transcript_to_verses


REFERENCE_SOURCE = "biblica_open_kiswahili"
REFERENCE_VERSION = "rev2-release"
DEFAULT_REFERENCE_ROOT = Path("evaluation/speech_lab/reference_sources/biblica_open_kiswahili")
TARGET_CHAPTERS = ("GEN_001", "MAT_005", "PSA_023", "ROM_008")
BOOK_CODE_BY_CHAPTER = {
    "GEN_001": "GEN",
    "MAT_005": "MAT",
    "PSA_023": "PSA",
    "ROM_008": "ROM",
}
INTRODUCTION_STYLES = {
    "mt",
    "mt1",
    "mt2",
    "ms",
    "ms1",
    "s",
    "s1",
    "s2",
    "r",
    "mr",
    "cl",
    "d",
}
VERSE_TEXT_STYLES = {"p", "q1", "q2", "q3", "m", "pi", "po", "li1", "li2", "lh", "b"}


@dataclass
class BiblicaIntroduction:
    type: str
    text: str


@dataclass
class BiblicaVerse:
    verse: int
    text: str


@dataclass
class BiblicaChapter:
    chapter_id: str
    source_name: str
    reference_source_version: str
    book: str
    chapter: int
    introductions: list[BiblicaIntroduction]
    verses: list[BiblicaVerse]

    @property
    def text(self) -> str:
        return " ".join(verse.text for verse in self.verses)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class BiblicaReferenceError(ValueError):
    pass


def validate_zip_paths(zip_path: str | Path) -> list[str]:
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
    bad = [
        name
        for name in names
        if PurePosixPath(name).is_absolute()
        or ".." in PurePosixPath(name).parts
        or "\\" in name
    ]
    if bad:
        raise BiblicaReferenceError(f"Unsafe archive paths rejected: {bad[:5]}")
    return names


def extract_required_source(zip_path: str | Path, destination: str | Path = DEFAULT_REFERENCE_ROOT) -> Path:
    names = validate_zip_paths(zip_path)
    required = {"metadata.xml", "release/styles.xml", "release/swh.ldml", "release/versification.vrs"}
    required.update(f"release/USX_1/{code}.usx" for code in sorted(set(BOOK_CODE_BY_CHAPTER.values())))
    missing = sorted(required - set(names))
    if missing:
        raise BiblicaReferenceError(f"Required files missing from archive: {missing}")
    destination_path = Path(destination)
    source_dir = destination_path / "source"
    source_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        for name in sorted(required):
            target = source_dir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    manifest = {
        "source_name": REFERENCE_SOURCE,
        "reference_source_version": REFERENCE_VERSION,
        "archive": str(Path(zip_path).resolve()),
        "format": "DBL/USX 3.0",
        "extracted_files": sorted(required),
    }
    (destination_path / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return source_dir


class BiblicaReferenceLoader:
    def __init__(self, root: str | Path = DEFAULT_REFERENCE_ROOT) -> None:
        self.root = Path(root)
        self.source_root = self.root / "source"

    def chapter(self, chapter_id: str) -> BiblicaChapter:
        benchmark = chapter_by_id(chapter_id)
        book_code = BOOK_CODE_BY_CHAPTER.get(chapter_id, benchmark.osis_book)
        path = self.source_root / "release" / "USX_1" / f"{book_code}.usx"
        if not path.exists():
            raise BiblicaReferenceError(f"USX file not found for {chapter_id}: {path}")
        return parse_usx_chapter(path, chapter_id)


def parse_usx_chapter(path: Path, chapter_id: str) -> BiblicaChapter:
    benchmark = chapter_by_id(chapter_id)
    root = ET.fromstring(path.read_text(encoding="utf-8"))
    introductions: list[BiblicaIntroduction] = []
    verses: dict[int, list[str]] = {}
    in_target_chapter = False
    past_target_chapter = False
    current_verse: int | None = None

    for node in root:
        tag = _tag(node)
        if tag == "chapter":
            if node.attrib.get("eid"):
                if in_target_chapter:
                    past_target_chapter = True
                    in_target_chapter = False
                current_verse = None
                continue
            number = node.attrib.get("number")
            if number and int(number) == benchmark.chapter:
                in_target_chapter = True
                current_verse = None
                continue
            if in_target_chapter:
                past_target_chapter = True
                in_target_chapter = False
                current_verse = None
            continue
        if past_target_chapter:
            break
        if not in_target_chapter or tag != "para":
            continue
        style = node.attrib.get("style", "")
        if _is_heading_style(style) and not any(_tag(child) == "verse" and child.attrib.get("number") for child in node):
            text = _normalize_whitespace(_text_without_notes(node))
            if text:
                introductions.append(BiblicaIntroduction(type=_intro_type(style), text=text))
            continue
        current_verse = _consume_para(node, current_verse, verses)

    ordered = [BiblicaVerse(verse=verse, text=_normalize_whitespace(" ".join(parts))) for verse, parts in sorted(verses.items())]
    validate_verses(ordered, chapter_id)
    return BiblicaChapter(
        chapter_id=chapter_id,
        source_name=REFERENCE_SOURCE,
        reference_source_version=REFERENCE_VERSION,
        book=benchmark.book,
        chapter=benchmark.chapter,
        introductions=introductions,
        verses=ordered,
    )


def _consume_para(node: ET.Element, current_verse: int | None, verses: dict[int, list[str]]) -> int | None:
    if node.text and current_verse is not None:
        verses.setdefault(current_verse, []).append(node.text)
    for child in node:
        tag = _tag(child)
        if tag == "verse" and child.attrib.get("number"):
            number = child.attrib["number"]
            if "-" in number:
                number = number.split("-", 1)[0]
            current_verse = int(number)
            verses.setdefault(current_verse, [])
        elif tag == "verse" and child.attrib.get("eid"):
            current_verse = None
        elif tag == "note":
            pass
        elif current_verse is not None:
            verses.setdefault(current_verse, []).append(_text_without_notes(child))
        if child.tail and current_verse is not None:
            verses.setdefault(current_verse, []).append(child.tail)
    return current_verse


def validate_verses(verses: list[BiblicaVerse], chapter_id: str) -> None:
    if not verses:
        raise BiblicaReferenceError(f"No verses found for {chapter_id}")
    numbers = [verse.verse for verse in verses]
    if len(numbers) != len(set(numbers)):
        raise BiblicaReferenceError(f"Duplicate verse numbers in {chapter_id}: {numbers}")
    expected = list(range(1, max(numbers) + 1))
    if numbers != expected:
        raise BiblicaReferenceError(f"Verse numbers missing or out of order in {chapter_id}: {numbers}")
    for verse in verses:
        if not verse.text:
            raise BiblicaReferenceError(f"Blank verse text in {chapter_id} verse {verse.verse}")


def write_chapter_references(root: str | Path = DEFAULT_REFERENCE_ROOT, chapters: tuple[str, ...] = TARGET_CHAPTERS) -> list[Path]:
    loader = BiblicaReferenceLoader(root)
    output_dir = Path(root) / "chapters"
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for chapter_id in chapters:
        chapter = loader.chapter(chapter_id)
        path = output_dir / f"{chapter_id}.json"
        path.write_text(json.dumps(chapter.to_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        paths.append(path)
    return paths


def load_chapter_reference(path: str | Path) -> BiblicaChapter:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    return BiblicaChapter(
        chapter_id=str(payload["chapter_id"]),
        source_name=str(payload["source_name"]),
        reference_source_version=str(payload["reference_source_version"]),
        book=str(payload["book"]),
        chapter=int(payload["chapter"]),
        introductions=[BiblicaIntroduction(**item) for item in payload.get("introductions", [])],
        verses=[BiblicaVerse(verse=int(item["verse"]), text=str(item["text"])) for item in payload.get("verses", [])],
    )


def biblica_canonical_verses(chapter: BiblicaChapter) -> list[CanonicalVerse]:
    return [CanonicalVerse(verse=item.verse, text=item.text) for item in chapter.verses]


def compare_existing_to_biblica(
    canonical_by_chapter: dict[str, dict[int, str]],
    root: str | Path = DEFAULT_REFERENCE_ROOT,
    chapters: tuple[str, ...] = TARGET_CHAPTERS,
) -> list[dict[str, Any]]:
    loader = BiblicaReferenceLoader(root)
    rows: list[dict[str, Any]] = []
    for chapter_id in chapters:
        biblica = loader.chapter(chapter_id)
        canonical = canonical_by_chapter[chapter_id]
        for verse in biblica.verses:
            existing = canonical.get(verse.verse, "")
            rows.append(
                {
                    "chapter_id": chapter_id,
                    "verse": verse.verse,
                    "existing_canonical_text": existing,
                    "biblica_reference_text": verse.text,
                    "exact_match": existing == verse.text,
                    "normalized_similarity": token_similarity_score(existing, verse.text),
                    "notes": classify_text_difference(existing, verse.text),
                }
            )
    return rows


def classify_text_difference(existing: str, biblica: str) -> str:
    if existing == biblica:
        return "exact_match"
    if normalize_text(existing) == normalize_text(biblica):
        return "punctuation_only"
    existing_tokens = normalize_text(existing).split()
    biblica_tokens = normalize_text(biblica).split()
    if sorted(existing_tokens) == sorted(biblica_tokens):
        return "word_order_change"
    existing_set = set(existing_tokens)
    biblica_set = set(biblica_tokens)
    if existing_set < biblica_set:
        return "addition"
    if biblica_set < existing_set:
        return "omission"
    overlap = len(existing_set & biblica_set) / max(len(existing_set | biblica_set), 1)
    if overlap >= 0.75:
        return "spelling_or_orthography"
    if overlap >= 0.45:
        return "word_substitution"
    return "substantial_translation_difference" if existing_tokens and biblica_tokens else "needs_review"


def rescore_aligned_transcript(aligned_path: str | Path, biblica: BiblicaChapter) -> dict[str, Any]:
    transcript = Transcript.from_dict(json.loads(Path(aligned_path).read_text(encoding="utf-8")))
    wer = WERCalculator().calculate(biblica.text, transcript.text)
    cer = CERCalculator().calculate(biblica.text, transcript.text)
    return {
        "chapter_id": biblica.chapter_id,
        "biblica_wer": wer,
        "biblica_cer": cer,
        "normalized_token_similarity": token_similarity_score(biblica.text, transcript.text),
        "word_order_similarity": word_order_similarity(biblica.text, transcript.text),
    }


def align_existing_transcript_to_biblica(
    transcript_path: str | Path,
    biblica: BiblicaChapter,
    output_path: str | Path,
) -> tuple[Transcript, Path]:
    transcript = Transcript.from_dict(json.loads(Path(transcript_path).read_text(encoding="utf-8")))
    if transcript.chapter_id != biblica.chapter_id:
        raise BiblicaReferenceError(
            f"Transcript chapter_id {transcript.chapter_id} does not match Biblica chapter {biblica.chapter_id}"
        )
    aligned = align_transcript_to_verses(transcript, biblica_canonical_verses(biblica))
    for verse in aligned.verses:
        verse.text_reference_mode = "biblica_source"
        verse.canonical_verse_text = verse.text
    metadata = dict(aligned.metadata)
    metadata["reference_source"] = {
        "mode": "biblica_source",
        "source_name": biblica.source_name,
        "reference_source_version": biblica.reference_source_version,
        "chapters_are_audio_source_candidates": True,
    }
    aligned.metadata = metadata
    output = _unique_path(Path(output_path))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(aligned.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return aligned, output


def rescore_existing_models(
    *,
    models: list[str],
    chapters: list[str],
    root: str | Path = DEFAULT_REFERENCE_ROOT,
    model_outputs_root: str | Path = "evaluation/speech_lab/model_outputs",
    reports_root: str | Path = "evaluation/speech_lab/reports",
    dry_run: bool = False,
) -> dict[str, Any]:
    loader = BiblicaReferenceLoader(root)
    rows: list[dict[str, Any]] = []
    outputs: list[str] = []
    for model in models:
        model_slug = model if model.startswith("faster-whisper-") else f"faster-whisper-{model}"
        model_dir = Path(model_outputs_root) / model_slug
        for chapter_id in chapters:
            raw_path = model_dir / f"{chapter_id}.json"
            aligned_path = model_dir / f"{chapter_id}.biblica-aligned-v2.json"
            if not raw_path.exists():
                raise BiblicaReferenceError(f"Model output missing: {raw_path}")
            biblica = loader.chapter(chapter_id)
            if dry_run:
                rows.append(_dry_run_rescore_row(model_slug, chapter_id, raw_path, aligned_path))
                continue
            aligned, written = align_existing_transcript_to_biblica(raw_path, biblica, aligned_path)
            outputs.append(str(written))
            rows.append(_rescore_row(model_slug, chapter_id, raw_path, written, aligned, biblica))
    report_paths = [] if dry_run else write_rescore_report(rows, reports_root=reports_root)
    return {"rows": rows, "aligned_outputs": outputs, "reports": [str(path) for path in report_paths]}


def write_reference_source_comparison_report(
    rows: list[dict[str, Any]],
    reports_root: str | Path = "evaluation/speech_lab/reports",
    basename: str = "reference_source_comparison",
) -> list[Path]:
    output_dir = Path(reports_root)
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = _unique_path(output_dir / f"{basename}.json")
    csv_path = json_path.with_suffix(".csv")
    md_path = json_path.with_suffix(".md")
    json_path.write_text(json.dumps({"rows": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_rows_csv(csv_path, rows)
    lines = [
        "# Reference Source Comparison",
        "",
        "| Chapter | Verse | Exact | Similarity | Classification | Spoken |",
        "| --- | ---: | --- | ---: | --- | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {row['chapter_id']} | {row['verse']} | {'yes' if row['exact_match'] else 'no'} | "
            f"{float(row['normalized_similarity']):.4f} | {row['notes']} | {row.get('spoken_reference_status', 'unavailable')} |"
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return [json_path, csv_path, md_path]


def write_rescore_report(
    rows: list[dict[str, Any]],
    reports_root: str | Path = "evaluation/speech_lab/reports",
    basename: str = "biblica_source_rescore",
) -> list[Path]:
    output_dir = Path(reports_root)
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = _unique_path(output_dir / f"{basename}.json")
    csv_path = json_path.with_suffix(".csv")
    md_path = json_path.with_suffix(".md")
    json_path.write_text(json.dumps({"rows": rows, "macro": _macro_rows(rows)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_rows_csv(csv_path, rows)
    lines = [
        "# Biblica Open Kiswahili Rescore",
        "",
        "| Model | Chapter | WER | CER | Token Similarity | Word Order | Aligned | Recovered | Unresolved | Coverage | Output |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {row['model_id']} | {row['chapter_id']} | {row['biblica_wer']:.4f} | {row['biblica_cer']:.4f} | "
            f"{row['normalized_token_similarity']:.4f} | {row['word_order_similarity']:.4f} | "
            f"{row['aligned_verses']} | {row['recovered_verses']} | {row['unresolved_verses']} | "
            f"{row['token_alignment_coverage']:.4f} | `{row['aligned_output_path']}` |"
        )
    macro = _macro_rows(rows)
    lines.extend(["", "## Macro Averages", ""])
    lines.append("| Model | WER | CER | Token Similarity | Word Order | Coverage |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: |")
    for model_id, values in macro.items():
        lines.append(
            f"| {model_id} | {values['biblica_wer']:.4f} | {values['biblica_cer']:.4f} | "
            f"{values['normalized_token_similarity']:.4f} | {values['word_order_similarity']:.4f} | "
            f"{values['token_alignment_coverage']:.4f} |"
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return [json_path, csv_path, md_path]


def write_csv(path: str | Path, rows: list[dict[str, Any]]) -> Path:
    output = _unique_path(Path(path))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]) if rows else ["chapter_id"])
        writer.writeheader()
        writer.writerows(rows)
    return output


def _dry_run_rescore_row(model_id: str, chapter_id: str, raw_path: Path, aligned_path: Path) -> dict[str, Any]:
    return {
        "model_id": model_id,
        "chapter_id": chapter_id,
        "raw_output_path": str(raw_path),
        "aligned_output_path": str(aligned_path),
        "dry_run": True,
    }


def _rescore_row(
    model_id: str,
    chapter_id: str,
    raw_path: Path,
    aligned_path: Path,
    aligned: Transcript,
    biblica: BiblicaChapter,
) -> dict[str, Any]:
    scored = rescore_aligned_transcript(aligned_path, biblica)
    alignment_metadata = aligned.metadata.get("verse_alignment", {})
    aligned_statuses = {"aligned", "recovered_between_neighbors"}
    aligned_count = sum(1 for verse in aligned.verses if verse.status in aligned_statuses)
    recovered_count = sum(1 for verse in aligned.verses if verse.status == "recovered_between_neighbors")
    unresolved_count = sum(1 for verse in aligned.verses if verse.status not in aligned_statuses)
    coverage_values = [
        verse.matched_tokens / verse.reference_tokens
        for verse in aligned.verses
        if verse.status in aligned_statuses and verse.reference_tokens
    ]
    return {
        "model_id": model_id,
        "chapter_id": chapter_id,
        "reference_source": REFERENCE_SOURCE,
        "reference_source_version": REFERENCE_VERSION,
        "raw_output_path": str(raw_path),
        "aligned_output_path": str(aligned_path),
        "verse_count": len(biblica.verses),
        "biblica_wer": scored["biblica_wer"],
        "biblica_cer": scored["biblica_cer"],
        "normalized_token_similarity": scored["normalized_token_similarity"],
        "word_order_similarity": scored["word_order_similarity"],
        "aligned_verses": aligned_count,
        "recovered_verses": recovered_count,
        "unresolved_verses": unresolved_count,
        "token_alignment_coverage": sum(coverage_values) / len(coverage_values) if coverage_values else 0.0,
        "alignment_algorithm": alignment_metadata.get("algorithm"),
        "transcription_runtime_seconds": aligned.metadata.get("transcription_runtime_seconds"),
    }


def _macro_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    numeric_fields = (
        "biblica_wer",
        "biblica_cer",
        "normalized_token_similarity",
        "word_order_similarity",
        "token_alignment_coverage",
    )
    model_ids = sorted({str(row["model_id"]) for row in rows})
    result: dict[str, dict[str, float]] = {}
    for model_id in model_ids:
        model_rows = [row for row in rows if row["model_id"] == model_id]
        result[model_id] = {
            field: sum(float(row[field]) for row in model_rows) / len(model_rows)
            for field in numeric_fields
        }
    return result


def _write_rows_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = sorted({key for row in rows for key in row}) if rows else ["chapter_id"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _tag(node: ET.Element) -> str:
    return node.tag.rsplit("}", 1)[-1]


def _text_without_notes(node: ET.Element) -> str:
    parts = [node.text or ""]
    for child in node:
        if _tag(child) != "note":
            parts.append(_text_without_notes(child))
        if child.tail:
            parts.append(child.tail)
    return "".join(parts)


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _is_heading_style(style: str) -> bool:
    return bool(style) and (style in INTRODUCTION_STYLES or style.rstrip("123456789") in INTRODUCTION_STYLES)


def _intro_type(style: str) -> str:
    if style.startswith("mt"):
        return "book_title"
    if style in {"cl", "mr"}:
        return "chapter_title"
    if style == "d":
        return "superscription"
    return "section_heading"


def _unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    index = 1
    while True:
        candidate = path.with_name(f"{stem}-{index}{suffix}")
        if not candidate.exists():
            return candidate
        index += 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Biblica Open Kiswahili reference source tooling.")
    parser.add_argument("--zip-path", required=True)
    parser.add_argument("--output-root", default=str(DEFAULT_REFERENCE_ROOT))
    args = parser.parse_args()
    extract_required_source(args.zip_path, args.output_root)
    for path in write_chapter_references(args.output_root):
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
