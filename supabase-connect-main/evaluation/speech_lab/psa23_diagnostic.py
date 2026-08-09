from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import median
from typing import Any

from .biblica_reference import load_chapter_reference
from .comparison import load_transcripts
from .metrics import CERCalculator, WERCalculator, normalize_text, token_similarity_score, word_order_similarity
from .models import Transcript, WordTiming
from .spoken_review import read_xlsx
from .verse_alignment import CanonicalVerse, align_transcript_to_verses


CHAPTER_ID = "PSA_023"
EXPECTED_VERSES = tuple(range(1, 7))
DEFAULT_WORKBOOK = Path("evaluation/speech_lab/golden/golden_reference_spoken_text_review_psa_023.xlsx")
DEFAULT_BIBLICA = Path("evaluation/speech_lab/reference_sources/biblica_open_kiswahili/chapters/PSA_023.json")
DEFAULT_OUTPUT_DIR = Path("evaluation/speech_lab/reports")
DEFAULT_MODEL_OUTPUTS = Path("evaluation/speech_lab/model_outputs")


@dataclass(frozen=True)
class SpokenVerse:
    chapter_id: str
    book: str
    chapter: int
    verse: int
    canonical_verse_text: str
    spoken_reference_text: str
    verse_start_ms: int
    verse_end_ms: int
    spoken_text_review_status: str
    reviewer: str
    review_notes: str


@dataclass(frozen=True)
class SpokenIntroduction:
    chapter_id: str
    introduction_type: str
    spoken_text: str
    start_ms: int
    end_ms: int
    review_status: str
    reviewer: str
    notes: str


@dataclass(frozen=True)
class ReferenceSource:
    chapter_id: str
    reference_type: str
    reference_source: str
    verses: list[CanonicalVerse]
    introductions: list[SpokenIntroduction]

    @property
    def text(self) -> str:
        return " ".join(verse.text for verse in sorted(self.verses, key=lambda item: item.verse))


class Psalm23DiagnosticError(ValueError):
    pass


def load_spoken_review_workbook(path: str | Path) -> tuple[list[SpokenVerse], list[SpokenIntroduction], dict[str, Any]]:
    workbook = read_xlsx(Path(path))
    sheets = {name.casefold(): rows for name, rows in workbook.items()}
    if "verses" not in sheets:
        raise Psalm23DiagnosticError("Workbook missing required 'verses' sheet")
    if "introductions" not in sheets:
        raise Psalm23DiagnosticError("Workbook missing required 'introductions' sheet")
    verse_rows = _named_rows(sheets["verses"])
    intro_rows = _named_rows(sheets["introductions"])
    verses: list[SpokenVerse] = []
    intros: list[SpokenIntroduction] = []
    errors: list[str] = []
    warnings: list[str] = []
    seen: set[int] = set()
    for row in verse_rows:
        verse = _int(row.get("verse"), "verse")
        chapter_id = str(row.get("chapter_id", "")).strip()
        status = str(row.get("spoken_text_review_status", "")).strip() or "pending"
        spoken = str(row.get("spoken_reference_text", "")).strip()
        if chapter_id != CHAPTER_ID:
            errors.append(f"Wrong chapter_id for verse {verse}: {chapter_id}")
        if verse in seen:
            errors.append(f"Duplicate verse number: {verse}")
        seen.add(verse)
        if status == "reviewed_exact" and not spoken:
            errors.append(f"Blank spoken_reference_text for reviewed_exact verse {verse}")
        if status != "reviewed_exact":
            warnings.append(f"Verse {verse} is not reviewed_exact: {status}")
        verses.append(
            SpokenVerse(
                chapter_id=chapter_id,
                book=str(row.get("book", "")).strip(),
                chapter=_int(row.get("chapter"), "chapter"),
                verse=verse,
                canonical_verse_text=str(row.get("canonical_verse_text", "")).strip(),
                spoken_reference_text=spoken,
                verse_start_ms=_int(row.get("verse_start_ms"), "verse_start_ms"),
                verse_end_ms=_int(row.get("verse_end_ms"), "verse_end_ms"),
                spoken_text_review_status=status,
                reviewer=str(row.get("reviewer", "")).strip(),
                review_notes=str(row.get("review_notes", "")).strip(),
            )
        )
    if sorted(seen) != list(EXPECTED_VERSES):
        errors.append(f"Expected verses 1 through 6, found {sorted(seen)}")
    for intro_row in intro_rows:
        if not any(str(value).strip() for value in intro_row.values()):
            continue
        chapter_id = str(intro_row.get("chapter_id", "")).strip()
        if chapter_id != CHAPTER_ID:
            errors.append(f"Wrong introduction chapter_id: {chapter_id}")
        intros.append(
            SpokenIntroduction(
                chapter_id=chapter_id,
                introduction_type=str(intro_row.get("introduction_type", "")).strip(),
                spoken_text=str(intro_row.get("spoken_text", "")).strip(),
                start_ms=_int(intro_row.get("start_ms"), "start_ms"),
                end_ms=_int(intro_row.get("end_ms"), "end_ms"),
                review_status=str(intro_row.get("review_status", "")).strip() or "pending",
                reviewer=str(intro_row.get("reviewer", "")).strip(),
                notes=str(intro_row.get("notes", "")).strip(),
            )
        )
    if errors:
        raise Psalm23DiagnosticError("; ".join(errors))
    return verses, intros, {"warnings": warnings, "pending_or_incomplete_rows": warnings}


def load_reference_sources(spoken_workbook: str | Path, biblica_path: str | Path = DEFAULT_BIBLICA) -> dict[str, ReferenceSource]:
    spoken_verses, intros, _validation = load_spoken_review_workbook(spoken_workbook)
    biblica = load_chapter_reference(biblica_path)
    return {
        "canonical": ReferenceSource(
            chapter_id=CHAPTER_ID,
            reference_type="existing_canonical",
            reference_source="spoken_review_workbook_canonical_column",
            verses=[CanonicalVerse(item.verse, item.canonical_verse_text) for item in spoken_verses],
            introductions=[],
        ),
        "biblica": ReferenceSource(
            chapter_id=CHAPTER_ID,
            reference_type="biblica_source",
            reference_source="biblica_open_kiswahili",
            verses=[CanonicalVerse(item.verse, item.text) for item in biblica.verses],
            introductions=[
                SpokenIntroduction(
                    chapter_id=CHAPTER_ID,
                    introduction_type=item.type,
                    spoken_text=item.text,
                    start_ms=-1,
                    end_ms=-1,
                    review_status="source_heading",
                    reviewer="",
                    notes="Biblica heading, not timed spoken workbook introduction",
                )
                for item in biblica.introductions
            ],
        ),
        "human_spoken": ReferenceSource(
            chapter_id=CHAPTER_ID,
            reference_type="human_spoken",
            reference_source="golden_reference_spoken_text_review_psa_023",
            verses=[CanonicalVerse(item.verse, item.spoken_reference_text) for item in spoken_verses],
            introductions=intros,
        ),
    }


def run_psalm23_diagnostic(
    *,
    spoken_workbook: str | Path = DEFAULT_WORKBOOK,
    models: list[str],
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    model_outputs_root: str | Path = DEFAULT_MODEL_OUTPUTS,
    overwrite: bool = False,
    dry_run: bool = False,
) -> dict[str, Any]:
    transcript_paths = {
        model: Path(model_outputs_root) / f"faster-whisper-{model}" / f"{CHAPTER_ID}.json"
        for model in models
    }
    aligned_paths = {
        model: Path(model_outputs_root) / f"faster-whisper-{model}" / f"{CHAPTER_ID}.diagnostic-human-spoken-aligned.json"
        for model in models
    }
    inputs = {
        "spoken_workbook": str(Path(spoken_workbook)),
        "biblica_reference": str(DEFAULT_BIBLICA),
        "transcripts": {model: str(path) for model, path in transcript_paths.items()},
    }
    for path in transcript_paths.values():
        if not path.exists():
            raise Psalm23DiagnosticError(f"Transcript output missing: {path}")
    if dry_run:
        return {"dry_run": True, "inputs": inputs, "planned_outputs": planned_output_paths(output_dir)}

    spoken_verses, intros, validation = load_spoken_review_workbook(spoken_workbook)
    references = load_reference_sources(spoken_workbook, DEFAULT_BIBLICA)
    verse_rows: list[dict[str, Any]] = []
    summary_rows: list[dict[str, Any]] = []
    introduction_rows: list[dict[str, Any]] = []
    reference_payload = {
        key: {
            "chapter_id": source.chapter_id,
            "reference_type": source.reference_type,
            "reference_source": source.reference_source,
            "verses": [asdict(verse) for verse in source.verses],
            "introductions": [asdict(item) for item in source.introductions],
        }
        for key, source in references.items()
    }
    for model, transcript_path in transcript_paths.items():
        raw_transcript = load_transcripts(transcript_path)[0]
        cleaned_transcript = remove_introduction_words(raw_transcript, intros)
        aligned_by_reference = {
            name: align_transcript_to_verses(cleaned_transcript, source.verses)
            for name, source in references.items()
        }
        human_aligned = aligned_by_reference["human_spoken"]
        human_output = _unique_path(aligned_paths[model], overwrite=overwrite)
        human_output.write_text(json.dumps(human_aligned.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        intro_analysis = analyze_introductions(raw_transcript, cleaned_transcript, references["human_spoken"], intros, spoken_verses)
        introduction_rows.extend({"model": model, **row} for row in intro_analysis)
        chapter_scores = {}
        raw_chapter_scores = {}
        for name, source in references.items():
            chapter_scores[name] = score_text(source.text, cleaned_transcript.text)
            raw_chapter_scores[name] = score_text(source.text, raw_transcript.text)
        summary_rows.append(_summary_row(model, chapter_scores, raw_chapter_scores, human_aligned, human_output))
        verse_rows.extend(
            _verse_rows(
                model=model,
                references=references,
                aligned_by_reference=aligned_by_reference,
                spoken_verses=spoken_verses,
            )
        )
    outputs = write_diagnostic_reports(
        output_dir=output_dir,
        inputs=inputs,
        references=reference_payload,
        workbook_validation=validation,
        summary_rows=summary_rows,
        verse_rows=verse_rows,
        introduction_rows=introduction_rows,
        overwrite=overwrite,
    )
    return {
        "dry_run": False,
        "inputs": inputs,
        "workbook_validation": validation,
        "summary_rows": summary_rows,
        "verse_rows": verse_rows,
        "introduction_rows": introduction_rows,
        "outputs": {key: str(path) for key, path in outputs.items()},
    }


def score_text(reference: str, hypothesis: str) -> dict[str, Any]:
    ref_words = normalize_text(reference).split()
    hyp_words = normalize_text(hypothesis).split()
    ops = edit_operation_counts(ref_words, hyp_words)
    return {
        "wer": WERCalculator().calculate(reference, hypothesis),
        "cer": CERCalculator().calculate(reference, hypothesis),
        "insertions": ops["insertions"],
        "deletions": ops["deletions"],
        "substitutions": ops["substitutions"],
        "reference_word_count": len(ref_words),
        "hypothesis_word_count": len(hyp_words),
    }


def edit_operation_counts(reference_words: list[str], hypothesis_words: list[str]) -> dict[str, int]:
    rows = len(reference_words) + 1
    columns = len(hypothesis_words) + 1
    costs = [[0] * columns for _ in range(rows)]
    moves = [[""] * columns for _ in range(rows)]
    for row in range(1, rows):
        costs[row][0] = row
        moves[row][0] = "delete"
    for column in range(1, columns):
        costs[0][column] = column
        moves[0][column] = "insert"
    for row in range(1, rows):
        for column in range(1, columns):
            sub_cost = 0 if reference_words[row - 1] == hypothesis_words[column - 1] else 1
            choices = (
                (costs[row - 1][column] + 1, "delete"),
                (costs[row][column - 1] + 1, "insert"),
                (costs[row - 1][column - 1] + sub_cost, "match" if sub_cost == 0 else "substitute"),
            )
            costs[row][column], moves[row][column] = min(choices, key=lambda item: item[0])
    counts = {"insertions": 0, "deletions": 0, "substitutions": 0}
    row = len(reference_words)
    column = len(hypothesis_words)
    while row > 0 or column > 0:
        move = moves[row][column]
        if move == "match":
            row -= 1
            column -= 1
        elif move == "substitute":
            counts["substitutions"] += 1
            row -= 1
            column -= 1
        elif move == "delete":
            counts["deletions"] += 1
            row -= 1
        else:
            counts["insertions"] += 1
            column -= 1
    return counts


def remove_introduction_words(transcript: Transcript, introductions: list[SpokenIntroduction]) -> Transcript:
    if not introductions:
        return transcript
    kept_words = [
        word
        for word in transcript.words
        if not any(_word_overlaps(word, intro.start_ms, intro.end_ms) for intro in introductions)
    ]
    return Transcript(
        chapter_id=transcript.chapter_id,
        text=" ".join(word.word for word in kept_words),
        words=[WordTiming(**word.__dict__) for word in kept_words],
        metadata={**transcript.metadata, "introduction_cleaned": True},
    )


def analyze_introductions(
    raw_transcript: Transcript,
    cleaned_transcript: Transcript,
    spoken_reference: ReferenceSource,
    introductions: list[SpokenIntroduction],
    spoken_verses: list[SpokenVerse],
) -> list[dict[str, Any]]:
    rows = []
    raw_score = score_text(spoken_reference.text, raw_transcript.text)
    cleaned_score = score_text(spoken_reference.text, cleaned_transcript.text)
    verse_one_start = next(item.verse_start_ms for item in spoken_verses if item.verse == 1)
    for intro in introductions:
        words = [word for word in raw_transcript.words if _word_overlaps(word, intro.start_ms, intro.end_ms)]
        detected = " ".join(word.word for word in words)
        rows.append(
            {
                "expected_introduction_text": intro.spoken_text,
                "detected_introduction_text": detected,
                "start_ms": intro.start_ms,
                "end_ms": intro.end_ms,
                "overlaps_verse_1": intro.end_ms > verse_one_start,
                "extra_words_added_to_chapter_wer": len(normalize_text(detected).split()),
                "raw_spoken_wer": raw_score["wer"],
                "cleaned_spoken_wer": cleaned_score["wer"],
            }
        )
    return rows


def write_diagnostic_reports(
    *,
    output_dir: str | Path,
    inputs: dict[str, Any],
    references: dict[str, Any],
    workbook_validation: dict[str, Any],
    summary_rows: list[dict[str, Any]],
    verse_rows: list[dict[str, Any]],
    introduction_rows: list[dict[str, Any]],
    overwrite: bool,
) -> dict[str, Path]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    json_path = _unique_path(output / "psa_023_three_reference_diagnostic.json", overwrite=overwrite)
    csv_path = json_path.with_suffix(".csv")
    md_path = json_path.with_suffix(".md")
    verse_csv_path = _unique_path(output / "psa_023_verse_diagnostic.csv", overwrite=overwrite)
    payload = {
        "inputs": inputs,
        "references": references,
        "workbook_validation": workbook_validation,
        "summary_rows": summary_rows,
        "verse_rows": verse_rows,
        "introduction_rows": introduction_rows,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_csv(csv_path, summary_rows)
    _write_csv(verse_csv_path, verse_rows)
    md_path.write_text(_markdown_report(summary_rows, verse_rows, introduction_rows), encoding="utf-8")
    return {"json": json_path, "csv": csv_path, "markdown": md_path, "verse_csv": verse_csv_path}


def planned_output_paths(output_dir: str | Path) -> dict[str, str]:
    output = Path(output_dir)
    return {
        "json": str(output / "psa_023_three_reference_diagnostic.json"),
        "csv": str(output / "psa_023_three_reference_diagnostic.csv"),
        "markdown": str(output / "psa_023_three_reference_diagnostic.md"),
        "verse_csv": str(output / "psa_023_verse_diagnostic.csv"),
    }


def _summary_row(
    model: str,
    chapter_scores: dict[str, dict[str, Any]],
    raw_chapter_scores: dict[str, dict[str, Any]],
    human_aligned: Transcript,
    human_output: Path,
) -> dict[str, Any]:
    spoken_wers = [
        score_text(verse.text, _assigned_text(human_aligned, verse.verse))["wer"]
        for verse in human_aligned.verses
    ]
    unresolved = [verse.verse for verse in human_aligned.verses if verse.status not in {"aligned", "recovered_between_neighbors"}]
    coverage_values = [
        verse.matched_tokens / verse.reference_tokens
        for verse in human_aligned.verses
        if verse.reference_tokens and verse.status in {"aligned", "recovered_between_neighbors"}
    ]
    canonical_wer = chapter_scores["canonical"]["wer"]
    biblica_wer = chapter_scores["biblica"]["wer"]
    spoken_wer = chapter_scores["human_spoken"]["wer"]
    return {
        "model": model,
        "canonical_chapter_wer": canonical_wer,
        "biblica_chapter_wer": biblica_wer,
        "spoken_reference_chapter_wer": spoken_wer,
        "canonical_chapter_cer": chapter_scores["canonical"]["cer"],
        "biblica_chapter_cer": chapter_scores["biblica"]["cer"],
        "spoken_reference_chapter_cer": chapter_scores["human_spoken"]["cer"],
        "raw_spoken_reference_chapter_wer": raw_chapter_scores["human_spoken"]["wer"],
        "cleaned_spoken_reference_chapter_wer": spoken_wer,
        "best_performing_reference": min(chapter_scores, key=lambda key: chapter_scores[key]["wer"]),
        "canonical_to_spoken_abs_wer_improvement": canonical_wer - spoken_wer,
        "canonical_to_spoken_pct_wer_improvement": _pct_improvement(canonical_wer, spoken_wer),
        "biblica_to_spoken_abs_wer_improvement": biblica_wer - spoken_wer,
        "biblica_to_spoken_pct_wer_improvement": _pct_improvement(biblica_wer, spoken_wer),
        "mean_verse_wer": sum(spoken_wers) / len(spoken_wers),
        "median_verse_wer": median(spoken_wers),
        "verses_spoken_wer_below_0_20": sum(1 for value in spoken_wers if value < 0.20),
        "verses_spoken_wer_0_20_to_0_40": sum(1 for value in spoken_wers if 0.20 <= value <= 0.40),
        "verses_spoken_wer_above_0_40": sum(1 for value in spoken_wers if value > 0.40),
        "unresolved_verses": ",".join(str(verse) for verse in unresolved),
        "verse_resolution_rate": (len(human_aligned.verses) - len(unresolved)) / len(human_aligned.verses),
        "token_alignment_coverage": sum(coverage_values) / len(coverage_values) if coverage_values else 0.0,
        "human_spoken_aligned_output": str(human_output),
    }


def _verse_rows(
    *,
    model: str,
    references: dict[str, ReferenceSource],
    aligned_by_reference: dict[str, Transcript],
    spoken_verses: list[SpokenVerse],
) -> list[dict[str, Any]]:
    human_aligned = aligned_by_reference["human_spoken"]
    rows = []
    human_timing = {item.verse: item for item in spoken_verses}
    for verse in EXPECTED_VERSES:
        asr_text = _assigned_text(human_aligned, verse)
        scores = {name: score_text(_verse_text(source, verse), asr_text) for name, source in references.items()}
        candidate = next(item for item in human_aligned.verses if item.verse == verse)
        timing = human_timing[verse]
        rows.append(
            {
                "model": model,
                "verse": verse,
                "canonical_text": _verse_text(references["canonical"], verse),
                "biblica_text": _verse_text(references["biblica"], verse),
                "human_exact_spoken_text": _verse_text(references["human_spoken"], verse),
                "asr_text_assigned_to_verse": asr_text,
                "canonical_wer": scores["canonical"]["wer"],
                "biblica_wer": scores["biblica"]["wer"],
                "spoken_reference_wer": scores["human_spoken"]["wer"],
                "canonical_cer": scores["canonical"]["cer"],
                "biblica_cer": scores["biblica"]["cer"],
                "spoken_reference_cer": scores["human_spoken"]["cer"],
                "insertions_against_spoken_reference": scores["human_spoken"]["insertions"],
                "deletions_against_spoken_reference": scores["human_spoken"]["deletions"],
                "substitutions_against_spoken_reference": scores["human_spoken"]["substitutions"],
                "normalized_token_similarity": token_similarity_score(_verse_text(references["human_spoken"], verse), asr_text),
                "word_order_similarity": word_order_similarity(_verse_text(references["human_spoken"], verse), asr_text),
                "alignment_status": candidate.status,
                "confidence": candidate.alignment_score,
                "predicted_start_ms": candidate.start_ms,
                "predicted_end_ms": candidate.end_ms,
                "human_start_ms": timing.verse_start_ms,
                "human_end_ms": timing.verse_end_ms,
                "start_drift_ms": None if candidate.start_ms is None else candidate.start_ms - timing.verse_start_ms,
                "end_drift_ms": None if candidate.end_ms is None else candidate.end_ms - timing.verse_end_ms,
                "likely_primary_cause": classify_primary_cause(scores, candidate, asr_text, references, verse, timing),
            }
        )
    return rows


def classify_primary_cause(
    scores: dict[str, dict[str, Any]],
    candidate,
    asr_text: str,
    references: dict[str, ReferenceSource],
    verse: int,
    timing: SpokenVerse,
) -> str:
    spoken_wer = scores["human_spoken"]["wer"]
    canonical_wer = scores["canonical"]["wer"]
    biblica_wer = scores["biblica"]["wer"]
    if candidate.start_ms is None or candidate.end_ms is None:
        return "verse_assignment_error"
    if abs(candidate.start_ms - timing.verse_start_ms) > 3000 or abs(candidate.end_ms - timing.verse_end_ms) > 3000:
        return "timing_boundary_error"
    if spoken_wer + 0.20 < canonical_wer and spoken_wer + 0.20 < biblica_wer:
        return "reference_mismatch"
    normalized_asr = normalize_text(asr_text)
    intro_tokens = set()
    for intro in references["human_spoken"].introductions:
        intro_tokens.update(normalize_text(intro.spoken_text).split())
    if intro_tokens and intro_tokens & set(normalized_asr.split()) and verse == 1:
        return "introduction_contamination"
    if spoken_wer > 0.40:
        ops = scores["human_spoken"]
        if ops["deletions"] > ops["insertions"] and ops["deletions"] >= ops["substitutions"]:
            return "ASR_omission"
        if ops["insertions"] > ops["deletions"] and ops["insertions"] >= ops["substitutions"]:
            return "ASR_insertion"
        if ops["substitutions"] > 0:
            return "ASR_substitution"
        return "mixed"
    if spoken_wer > 0.20:
        return "mixed"
    return "needs_review"


def _assigned_text(transcript: Transcript, verse: int) -> str:
    words = [word.word for word in transcript.words if word.verse == verse]
    return " ".join(words)


def _verse_text(source: ReferenceSource, verse: int) -> str:
    return next(item.text for item in source.verses if item.verse == verse)


def _word_overlaps(word: WordTiming, start_ms: int, end_ms: int) -> bool:
    if word.start_ms is None or word.end_ms is None:
        return False
    return word.start_ms < end_ms and word.end_ms > start_ms


def _named_rows(raw_rows: list[dict[int, Any]]) -> list[dict[str, Any]]:
    if not raw_rows:
        return []
    headers = [str(raw_rows[0].get(index, "")).strip() for index in sorted(raw_rows[0])]
    required = [header for header in headers if header]
    rows = []
    for raw in raw_rows[1:]:
        row = {required[index - 1]: raw.get(index, "") for index in range(1, len(required) + 1)}
        if any(str(value).strip() for value in row.values()):
            rows.append(row)
    return rows


def _int(value: Any, field: str) -> int:
    if value in (None, ""):
        raise Psalm23DiagnosticError(f"Missing required numeric field: {field}")
    return int(float(str(value).strip()))


def _pct_improvement(before: float, after: float) -> float | None:
    return None if before == 0 else (before - after) / before


def _unique_path(path: Path, *, overwrite: bool) -> Path:
    if overwrite or not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    index = 1
    while True:
        candidate = path.with_name(f"{stem}-{index}{suffix}")
        if not candidate.exists():
            return candidate
        index += 1


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = sorted({key for row in rows for key in row}) if rows else ["empty"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _markdown_report(summary_rows: list[dict[str, Any]], verse_rows: list[dict[str, Any]], intro_rows: list[dict[str, Any]]) -> str:
    lines = [
        "# PSA_023 Three-Reference Diagnostic",
        "",
        "## Summary",
        "",
        "| Model | Canonical WER | Biblica WER | Spoken WER | Raw Spoken WER | Best Ref | Resolution | Coverage |",
        "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |",
    ]
    for row in summary_rows:
        lines.append(
            f"| {row['model']} | {row['canonical_chapter_wer']:.4f} | {row['biblica_chapter_wer']:.4f} | "
            f"{row['spoken_reference_chapter_wer']:.4f} | {row['raw_spoken_reference_chapter_wer']:.4f} | "
            f"{row['best_performing_reference']} | {row['verse_resolution_rate']:.4f} | {row['token_alignment_coverage']:.4f} |"
        )
    lines.extend(["", "## Verse Diagnostic", ""])
    lines.append("| Model | Verse | Spoken WER | Canonical WER | Biblica WER | Cause | Start Drift | End Drift |")
    lines.append("| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |")
    for row in verse_rows:
        lines.append(
            f"| {row['model']} | {row['verse']} | {row['spoken_reference_wer']:.4f} | "
            f"{row['canonical_wer']:.4f} | {row['biblica_wer']:.4f} | {row['likely_primary_cause']} | "
            f"{_fmt(row['start_drift_ms'])} | {_fmt(row['end_drift_ms'])} |"
        )
    lines.extend(["", "## Introduction Analysis", ""])
    lines.append("| Model | Expected | Detected | Raw WER | Cleaned WER | Extra Words |")
    lines.append("| --- | --- | --- | ---: | ---: | ---: |")
    for row in intro_rows:
        lines.append(
            f"| {row['model']} | {row['expected_introduction_text']} | {row['detected_introduction_text']} | "
            f"{row['raw_spoken_wer']:.4f} | {row['cleaned_spoken_wer']:.4f} | {row['extra_words_added_to_chapter_wer']} |"
        )
    lines.extend(
        [
            "",
            "## Diagnostic Answers",
            "",
            "- Biblica closeness is determined by the lower chapter WER/CER versus the canonical reference in the summary table.",
            "- Human spoken-reference improvement estimates the reference-mismatch share; remaining spoken WER is treated as ASR, timing, or assignment error evidence.",
            "- Introduction contamination is reported separately using the workbook introduction timestamps and raw-versus-cleaned WER.",
            "- Likely causes are deterministic labels, not semantic-equivalence claims.",
        ]
    )
    return "\n".join(lines) + "\n"


def _fmt(value: Any) -> str:
    return "-" if value is None else str(value)
