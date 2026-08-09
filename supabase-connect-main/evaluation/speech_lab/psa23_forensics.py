from __future__ import annotations

import csv
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .comparison import load_transcripts
from .corpus import chapter_by_id
from .metrics import CERCalculator, WERCalculator, normalize_text, token_similarity_score, word_order_similarity
from .models import Transcript
from .providers.faster_whisper_provider import FasterWhisperProvider, resolve_audio_path
from .psa23_diagnostic import (
    CHAPTER_ID,
    DEFAULT_BIBLICA,
    DEFAULT_MODEL_OUTPUTS,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_WORKBOOK,
    EXPECTED_VERSES,
    ReferenceSource,
    SpokenIntroduction,
    SpokenVerse,
    analyze_introductions,
    edit_operation_counts,
    load_reference_sources,
    load_spoken_review_workbook,
    remove_introduction_words,
    score_text,
)
from .verse_alignment import align_transcript_to_verses


OPTIMIZATION_CONFIGS: dict[str, dict[str, Any]] = {
    "medium_beam5": {"beam_size": 5},
    "medium_beam10": {"beam_size": 10},
    "medium_bestof5": {"beam_size": 1, "best_of": 5},
    "medium_bestof10": {"beam_size": 1, "best_of": 10},
    "medium_vad_tuned": {"vad_filter": True, "vad_parameters": {"min_silence_duration_ms": 500, "speech_pad_ms": 200}},
    "medium_no_previous_context": {"condition_on_previous_text": False},
    "medium_bible_prompt": {
        "initial_prompt": (
            "Maandiko Matakatifu ya Kiswahili. Zaburi. Mwenyezi Mungu ndiye mchungaji wangu. "
            "Hunilaza katika malisho ya majani mabichi."
        )
    },
}


def run_psa23_forensic_analysis(
    *,
    spoken_workbook: str | Path = DEFAULT_WORKBOOK,
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    model_outputs_root: str | Path = DEFAULT_MODEL_OUTPUTS,
    overwrite: bool = False,
) -> dict[str, Any]:
    spoken_verses, intros, validation = load_spoken_review_workbook(spoken_workbook)
    references = load_reference_sources(spoken_workbook, DEFAULT_BIBLICA)
    forensic_rows: list[dict[str, Any]] = []
    introduction_rows: list[dict[str, Any]] = []
    diff_rows: list[dict[str, Any]] = []
    for model in ("small", "medium"):
        raw_path = Path(model_outputs_root) / f"faster-whisper-{model}" / f"{CHAPTER_ID}.json"
        aligned_path = Path(model_outputs_root) / f"faster-whisper-{model}" / f"{CHAPTER_ID}.diagnostic-human-spoken-aligned.json"
        raw = load_transcripts(raw_path)[0]
        cleaned = remove_introduction_words(raw, intros)
        aligned = load_transcripts(aligned_path)[0] if aligned_path.exists() else align_transcript_to_verses(cleaned, references["human_spoken"].verses)
        introduction_rows.extend({"model": model, **row} for row in analyze_introductions(raw, cleaned, references["human_spoken"], intros, spoken_verses))
        for verse in EXPECTED_VERSES:
            row, diffs = forensic_verse_row(model, verse, aligned, references, spoken_verses, intros)
            forensic_rows.append(row)
            diff_rows.extend(diffs)
    outputs = write_forensic_reports(
        output_dir=output_dir,
        forensic_rows=forensic_rows,
        diff_rows=diff_rows,
        introduction_rows=introduction_rows,
        workbook_validation=validation,
        overwrite=overwrite,
    )
    return {
        "workbook_validation": validation,
        "forensic_rows": forensic_rows,
        "diff_rows": diff_rows,
        "introduction_rows": introduction_rows,
        "outputs": {key: str(value) for key, value in outputs.items()},
    }


def run_medium_optimization(
    *,
    spoken_workbook: str | Path = DEFAULT_WORKBOOK,
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    model_outputs_root: str | Path = DEFAULT_MODEL_OUTPUTS,
    optimization_output_root: str | Path = "evaluation/speech_lab/model_outputs/faster-whisper-medium-psa23-optimization",
    audio: str | Path | None = None,
    overwrite: bool = False,
    dry_run: bool = False,
) -> dict[str, Any]:
    audio_path = resolve_audio_path(CHAPTER_ID, audio)
    planned = {
        "baseline_medium": str(Path(model_outputs_root) / "faster-whisper-medium" / f"{CHAPTER_ID}.json"),
        **{
            name: str(Path(optimization_output_root) / f"{name}.json")
            for name in OPTIMIZATION_CONFIGS
        },
    }
    if dry_run:
        return {"dry_run": True, "audio": str(audio_path), "planned_transcripts": planned, "configs": OPTIMIZATION_CONFIGS}
    references = load_reference_sources(spoken_workbook, DEFAULT_BIBLICA)
    _spoken_verses, intros, _validation = load_spoken_review_workbook(spoken_workbook)
    output_root = Path(optimization_output_root)
    output_root.mkdir(parents=True, exist_ok=True)
    transcript_paths: dict[str, Path] = {"baseline_medium": Path(planned["baseline_medium"])}
    chapter = chapter_by_id(CHAPTER_ID)
    for name, options in OPTIMIZATION_CONFIGS.items():
        out_path = _unique_path(output_root / f"{name}.json", overwrite=overwrite)
        provider = FasterWhisperProvider(model_name="medium", language="sw", transcription_options=options)
        transcript = provider.transcribe(chapter, audio_path)
        transcript.metadata["optimization_config"] = name
        out_path.write_text(json.dumps(transcript.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        transcript_paths[name] = out_path
    rows = []
    for name, path in transcript_paths.items():
        rows.append(score_optimization_transcript(name, path, references["human_spoken"], intros))
    ranking = sorted(
        rows,
        key=lambda row: (
            row["wer"],
            row["cer"],
            -row["verse_resolution_rate"],
        ),
    )
    for index, row in enumerate(ranking, start=1):
        row["rank"] = index
    outputs = write_optimization_reports(ranking, output_dir=output_dir, overwrite=overwrite)
    return {"dry_run": False, "audio": str(audio_path), "ranking": ranking, "outputs": {key: str(value) for key, value in outputs.items()}}


def score_optimization_transcript(
    config_name: str,
    transcript_path: str | Path,
    human_reference: ReferenceSource,
    introductions: list[SpokenIntroduction],
) -> dict[str, Any]:
    raw = load_transcripts(transcript_path)[0]
    cleaned = remove_introduction_words(raw, introductions)
    aligned = align_transcript_to_verses(cleaned, human_reference.verses)
    chapter_score = score_text(human_reference.text, cleaned.text)
    aligned_statuses = {"aligned", "recovered_between_neighbors"}
    unresolved = [verse.verse for verse in aligned.verses if verse.status not in aligned_statuses]
    coverage_values = [
        verse.matched_tokens / verse.reference_tokens
        for verse in aligned.verses
        if verse.reference_tokens and verse.status in aligned_statuses
    ]
    return {
        "config": config_name,
        "transcript_path": str(transcript_path),
        "wer": chapter_score["wer"],
        "cer": chapter_score["cer"],
        "insertions": chapter_score["insertions"],
        "deletions": chapter_score["deletions"],
        "substitutions": chapter_score["substitutions"],
        "runtime_seconds": raw.metadata.get("transcription_runtime_seconds", 0),
        "verse_resolution_rate": (len(aligned.verses) - len(unresolved)) / len(aligned.verses),
        "coverage": sum(coverage_values) / len(coverage_values) if coverage_values else 0.0,
        "unresolved_verses": ",".join(str(verse) for verse in unresolved),
    }


def forensic_verse_row(
    model: str,
    verse: int,
    aligned: Transcript,
    references: dict[str, ReferenceSource],
    spoken_verses: list[SpokenVerse],
    intros: list[SpokenIntroduction],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    reference_text = _verse_text(references["human_spoken"], verse)
    asr_text = _assigned_text(aligned, verse)
    candidate = next(item for item in aligned.verses if item.verse == verse)
    timing = next(item for item in spoken_verses if item.verse == verse)
    score = score_text(reference_text, asr_text)
    diffs = word_diffs(reference_text, asr_text, references, verse)
    leakage = [diff for diff in diffs if diff["classification"] == "neighboring_verse_leakage"]
    return (
        {
            "model": model,
            "verse": verse,
            "reference_text": reference_text,
            "assigned_asr_text": asr_text,
            "wer": score["wer"],
            "cer": score["cer"],
            "insertions": score["insertions"],
            "deletions": score["deletions"],
            "substitutions": score["substitutions"],
            "predicted_start_ms": candidate.start_ms,
            "predicted_end_ms": candidate.end_ms,
            "golden_start_ms": timing.verse_start_ms,
            "golden_end_ms": timing.verse_end_ms,
            "start_drift_ms": None if candidate.start_ms is None else candidate.start_ms - timing.verse_start_ms,
            "end_drift_ms": None if candidate.end_ms is None else candidate.end_ms - timing.verse_end_ms,
            "alignment_status": candidate.status,
            "confidence": candidate.alignment_score,
            "neighboring_verse_leakage": bool(leakage),
            "neighboring_verse_leakage_count": len(leakage),
            "contamination_words": " ".join(_introduction_words_in_text(asr_text, intros)) if verse == 1 else "",
            "contamination_count": len(_introduction_words_in_text(asr_text, intros)) if verse == 1 else 0,
            "normalized_token_similarity": token_similarity_score(reference_text, asr_text),
            "word_order_similarity": word_order_similarity(reference_text, asr_text),
        },
        [{"model": model, "verse": verse, **diff} for diff in diffs],
    )


def word_diffs(reference: str, hypothesis: str, references: dict[str, ReferenceSource], verse: int) -> list[dict[str, Any]]:
    ref = normalize_text(reference).split()
    hyp = normalize_text(hypothesis).split()
    moves = _alignment_moves(ref, hyp)
    rows = []
    neighbor_tokens = _neighbor_tokens(references["human_spoken"], verse)
    for move, ref_word, hyp_word in moves:
        if move == "match":
            continue
        classification = move
        if move == "insertion" and hyp_word in neighbor_tokens:
            classification = "neighboring_verse_leakage"
        elif move == "substitution" and ref_word and hyp_word and _orthographic_pair(ref_word, hyp_word):
            classification = "orthography"
        rows.append(
            {
                "reference_word": ref_word or "",
                "asr_word": hyp_word or "",
                "operation": move,
                "classification": classification,
                "description": _diff_description(move, ref_word, hyp_word, classification),
            }
        )
    return rows


def write_forensic_reports(
    *,
    output_dir: str | Path,
    forensic_rows: list[dict[str, Any]],
    diff_rows: list[dict[str, Any]],
    introduction_rows: list[dict[str, Any]],
    workbook_validation: dict[str, Any],
    overwrite: bool,
) -> dict[str, Path]:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    json_path = _unique_path(out / "psa23_forensic_analysis.json", overwrite=overwrite)
    md_path = json_path.with_suffix(".md")
    json_path.write_text(
        json.dumps(
            {
                "workbook_validation": workbook_validation,
                "forensic_rows": forensic_rows,
                "diff_rows": diff_rows,
                "introduction_rows": introduction_rows,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    md_path.write_text(_forensic_markdown(forensic_rows, diff_rows, introduction_rows), encoding="utf-8")
    return {"json": json_path, "markdown": md_path}


def write_optimization_reports(rows: list[dict[str, Any]], *, output_dir: str | Path, overwrite: bool) -> dict[str, Path]:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    csv_path = _unique_path(out / "psa23_medium_optimization.csv", overwrite=overwrite)
    md_path = csv_path.with_suffix(".md")
    _write_csv(csv_path, rows)
    lines = [
        "# PSA_023 Medium Optimization",
        "",
        "| Rank | Config | WER | CER | Runtime | Resolution | Coverage | Unresolved |",
        "| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for row in rows:
        lines.append(
            f"| {row['rank']} | {row['config']} | {row['wer']:.4f} | {row['cer']:.4f} | "
            f"{float(row['runtime_seconds']):.2f} | {row['verse_resolution_rate']:.4f} | {row['coverage']:.4f} | {row['unresolved_verses']} |"
        )
    best = rows[0] if rows else None
    if best:
        lines.extend(
            [
                "",
                "## Recommendation",
                "",
                f"- Best measured configuration: `{best['config']}`.",
                "- Ranking is ordered by human spoken WER, then CER, then verse resolution.",
            ]
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"csv": csv_path, "markdown": md_path}


def _alignment_moves(ref: list[str], hyp: list[str]) -> list[tuple[str, str | None, str | None]]:
    rows = len(ref) + 1
    cols = len(hyp) + 1
    costs = [[0] * cols for _ in range(rows)]
    moves = [[""] * cols for _ in range(rows)]
    for r in range(1, rows):
        costs[r][0] = r
        moves[r][0] = "deletion"
    for c in range(1, cols):
        costs[0][c] = c
        moves[0][c] = "insertion"
    for r in range(1, rows):
        for c in range(1, cols):
            sub = 0 if ref[r - 1] == hyp[c - 1] else 1
            choices = (
                (costs[r - 1][c] + 1, "deletion"),
                (costs[r][c - 1] + 1, "insertion"),
                (costs[r - 1][c - 1] + sub, "match" if sub == 0 else "substitution"),
            )
            costs[r][c], moves[r][c] = min(choices, key=lambda item: item[0])
    result = []
    r = len(ref)
    c = len(hyp)
    while r > 0 or c > 0:
        move = moves[r][c]
        if move == "match":
            result.append((move, ref[r - 1], hyp[c - 1]))
            r -= 1
            c -= 1
        elif move == "substitution":
            result.append((move, ref[r - 1], hyp[c - 1]))
            r -= 1
            c -= 1
        elif move == "deletion":
            result.append((move, ref[r - 1], None))
            r -= 1
        else:
            result.append((move, None, hyp[c - 1]))
            c -= 1
    return list(reversed(result))


def _neighbor_tokens(reference: ReferenceSource, verse: int) -> set[str]:
    tokens: set[str] = set()
    for neighbor in (verse - 1, verse + 1):
        if neighbor in EXPECTED_VERSES:
            tokens.update(normalize_text(_verse_text(reference, neighbor)).split())
    return tokens


def _orthographic_pair(reference: str, hypothesis: str) -> bool:
    if not reference or not hypothesis:
        return False
    common = set(reference) & set(hypothesis)
    return len(common) / max(len(set(reference) | set(hypothesis)), 1) >= 0.55


def _diff_description(move: str, ref_word: str | None, hyp_word: str | None, classification: str) -> str:
    if move == "substitution":
        return f"{ref_word} -> {hyp_word} ({classification})"
    if move == "deletion":
        return f"{ref_word} missing ({classification})"
    return f"{hyp_word} extra ({classification})"


def _forensic_markdown(forensic_rows: list[dict[str, Any]], diff_rows: list[dict[str, Any]], intro_rows: list[dict[str, Any]]) -> str:
    lines = [
        "# PSA_023 Forensic Analysis",
        "",
        "| Model | Verse | WER | CER | Ins | Del | Sub | Status | Start Drift | End Drift | Leakage |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |",
    ]
    for row in forensic_rows:
        lines.append(
            f"| {row['model']} | {row['verse']} | {row['wer']:.4f} | {row['cer']:.4f} | "
            f"{row['insertions']} | {row['deletions']} | {row['substitutions']} | {row['alignment_status']} | "
            f"{_fmt(row['start_drift_ms'])} | {_fmt(row['end_drift_ms'])} | {row['neighboring_verse_leakage_count']} |"
        )
    lines.extend(["", "## Introduction Audit", ""])
    for row in intro_rows:
        lines.append(
            f"- {row['model']}: detected `{row['detected_introduction_text']}`; "
            f"raw WER {row['raw_spoken_wer']:.4f}, cleaned WER {row['cleaned_spoken_wer']:.4f}."
        )
    lines.extend(["", "## Word-Level Differences", ""])
    for row in diff_rows:
        lines.append(f"- {row['model']} v{row['verse']}: {row['description']}")
    lines.extend(
        [
            "",
            "## Recommendation Notes",
            "",
            "- If timing drift is small but WER remains high, treat the verse as primarily transcription error.",
            "- If drift is large or a verse is unresolved, treat it as alignment or boundary error.",
            "- Introduction words are audited separately and should not be counted as verse 1.",
        ]
    )
    return "\n".join(lines) + "\n"


def _assigned_text(transcript: Transcript, verse: int) -> str:
    return " ".join(word.word for word in transcript.words if word.verse == verse)


def _verse_text(source: ReferenceSource, verse: int) -> str:
    return next(item.text for item in source.verses if item.verse == verse)


def _introduction_words_in_text(text: str, intros: list[SpokenIntroduction]) -> list[str]:
    tokens = set(normalize_text(text).split())
    found = []
    for intro in intros:
        found.extend(token for token in normalize_text(intro.spoken_text).split() if token in tokens)
    return found


def _unique_path(path: Path, *, overwrite: bool) -> Path:
    if overwrite or not path.exists():
        return path
    index = 1
    while True:
        candidate = path.with_name(f"{path.stem}-{index}{path.suffix}")
        if not candidate.exists():
            return candidate
        index += 1


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = sorted({key for row in rows for key in row}) if rows else ["empty"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _fmt(value: Any) -> str:
    return "-" if value is None else str(value)
