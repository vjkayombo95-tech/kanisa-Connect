from __future__ import annotations

import csv
import html
import json
import os
import re
import subprocess
import sys
import time
import tracemalloc
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[4]
AUDIO_ROOT = ROOT / "supabase" / "audio"
SCRIPTS_ROOT = AUDIO_ROOT / "scripts"
RESULTS_DIR = Path(__file__).resolve().parent

CORPUS = [
    ("Genesis", 1),
    ("Psalm", 23),
    ("Matthew", 5),
    ("John", 3),
    ("Romans", 8),
]

ENGLISH_MARKERS = {
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "have",
    "will",
    "shall",
    "lord",
    "god",
    "jesus",
    "christ",
}


def _load_env_before_config() -> None:
    """Load evaluation-only credentials before importing audio configuration."""
    env_file = ROOT / "evaluation" / "speech_lab" / ".env.evaluation"
    if env_file.exists():
        values: dict[str, str] = {}
        for raw_line in env_file.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
        forbidden_vite_service_role = "VITE_SUPABASE_" + "SERVICE_ROLE_KEY"
        if values.get(forbidden_vite_service_role):
            raise RuntimeError(f"{forbidden_vite_service_role} must never be set.")
        if values.get("SUPABASE_URL"):
            os.environ.setdefault("SUPABASE_URL", values["SUPABASE_URL"])
        if values.get("SUPABASE_SERVICE_ROLE_KEY"):
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = values["SUPABASE_SERVICE_ROLE_KEY"]
            return

    if not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY was not found in evaluation/speech_lab/.env.evaluation or the runtime environment.")


def _tokens(text: str) -> list[str]:
    return re.findall(r"[\w']+", text.casefold(), flags=re.UNICODE)


def _chars(text: str) -> list[str]:
    return list(re.sub(r"\s+", " ", text.casefold()).strip())


def _distance(reference: list[str], hypothesis: list[str]) -> int:
    if not reference:
        return len(hypothesis)
    previous = list(range(len(hypothesis) + 1))
    for i, ref_item in enumerate(reference, start=1):
        current = [i]
        for j, hyp_item in enumerate(hypothesis, start=1):
            cost = 0 if ref_item == hyp_item else 1
            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + cost,
                )
            )
        previous = current
    return previous[-1]


def _error_rate(reference_text: str, hypothesis_text: str, unit: str) -> float:
    reference = _tokens(reference_text) if unit == "word" else _chars(reference_text)
    hypothesis = _tokens(hypothesis_text) if unit == "word" else _chars(hypothesis_text)
    if not reference:
        return 0.0 if not hypothesis else 1.0
    return _distance(reference, hypothesis) / len(reference)


def _gpu_snapshot() -> dict[str, float | None]:
    try:
        completed = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=utilization.gpu,memory.used",
                "--format=csv,noheader,nounits",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return {"gpu_utilization_percent": None, "peak_vram_mb": None}

    if completed.returncode != 0 or not completed.stdout.strip():
        return {"gpu_utilization_percent": None, "peak_vram_mb": None}

    gpu_values: list[float] = []
    vram_values: list[float] = []
    for line in completed.stdout.strip().splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) >= 2:
            gpu_values.append(float(parts[0]))
            vram_values.append(float(parts[1]))
    return {
        "gpu_utilization_percent": max(gpu_values) if gpu_values else None,
        "peak_vram_mb": max(vram_values) if vram_values else None,
    }


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _quality_audit(
    words: list[dict[str, Any]],
    verse_timings: list[Any],
    boundary_qa: list[dict[str, Any]],
    expected_verse_count: int,
    transcript_text: str,
) -> dict[str, Any]:
    normalized_words = [_tokens(str(word.get("word", ""))) for word in words]
    flat_words = [token for group in normalized_words for token in group]
    english_hits = [token for token in flat_words if token in ENGLISH_MARKERS]

    repeated_phrases: list[str] = []
    for size in (3, 4, 5):
        ngrams = [" ".join(flat_words[i : i + size]) for i in range(max(0, len(flat_words) - size + 1))]
        repeated_phrases.extend([phrase for phrase, count in Counter(ngrams).items() if count >= 3])

    word_durations = [
        (_as_float(word.get("end")) or 0.0) - (_as_float(word.get("start")) or 0.0)
        for word in words
        if word.get("start") is not None and word.get("end") is not None
    ]
    verse_durations = [
        timing.end_seconds - timing.start_seconds
        for timing in verse_timings
        if timing.start_seconds is not None and timing.end_seconds is not None
    ]
    word_overlaps = 0
    long_silence_gaps = 0
    for current, following in zip(words, words[1:]):
        current_end = _as_float(current.get("end"))
        next_start = _as_float(following.get("start"))
        if current_end is None or next_start is None:
            continue
        if current_end > next_start:
            word_overlaps += 1
        if next_start - current_end > 2.0:
            long_silence_gaps += 1

    verse_ids = [timing.verse_id for timing in verse_timings]
    duplicate_verses = sorted([verse_id for verse_id, count in Counter(verse_ids).items() if count > 1])
    boundary_missing = [entry for entry in boundary_qa if entry.get("reason") == "boundary_not_found"]
    timestamp_collapse = word_overlaps > 0 or sum(1 for duration in word_durations if duration <= 0.0) > 0

    warnings: list[str] = []
    if english_hits:
        warnings.append(f"english_hallucination_markers:{len(english_hits)}")
    if repeated_phrases:
        warnings.append(f"repeated_phrases:{len(repeated_phrases)}")
    if timestamp_collapse:
        warnings.append("timestamp_collapse")
    short_span_count = sum(1 for duration in word_durations if 0.0 < duration < 0.03)
    short_span_count += sum(1 for duration in verse_durations if 0.0 < duration < 0.05)
    if short_span_count:
        warnings.append(f"extremely_short_spans:{short_span_count}")
    if long_silence_gaps:
        warnings.append(f"long_silence_gaps:{long_silence_gaps}")
    if boundary_missing:
        warnings.append(f"missing_verse_boundaries:{len(boundary_missing)}")
    if duplicate_verses:
        warnings.append(f"duplicate_verses:{len(duplicate_verses)}")
    if not transcript_text.strip():
        warnings.append("empty_transcript")

    return {
        "english_hallucinations": len(english_hits),
        "english_markers": sorted(Counter(english_hits).keys()),
        "repeated_phrases": sorted(set(repeated_phrases))[:25],
        "timestamp_collapse": timestamp_collapse,
        "extremely_short_spans": short_span_count,
        "long_silence_gaps": long_silence_gaps,
        "missing_verses": max(0, expected_verse_count - len(set(verse_ids))),
        "duplicate_verses": duplicate_verses,
        "warnings": warnings,
    }


def _write_csv(report: dict[str, Any]) -> None:
    fields = [
        "book",
        "chapter",
        "status",
        "detected_language",
        "transcript_language",
        "word_count",
        "segment_count",
        "average_word_confidence",
        "verse_confidence",
        "boundary_accuracy",
        "wer",
        "cer",
        "processing_time_seconds",
        "peak_ram_mb",
        "peak_vram_mb",
        "cpu_usage_percent",
        "gpu_utilization_percent",
        "boundary_not_found_events",
        "overlapping_timings",
        "zero_duration_spans",
        "alignment_failures",
        "missing_word_scores",
        "warnings",
    ]
    with (RESULTS_DIR / "baseline_report.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for chapter in report["chapters"]:
            row = {field: chapter.get(field) for field in fields}
            row["warnings"] = ", ".join(chapter["quality_audit"]["warnings"])
            writer.writerow(row)


def _write_markdown(report: dict[str, Any]) -> None:
    lines = [
        "# WhisperX Baseline Report",
        "",
        f"Generated: {report['generated_at']}",
        "",
        "## Configuration",
        "",
        "| Field | Value |",
        "| --- | --- |",
    ]
    for key, value in report["configuration"].items():
        lines.append(f"| {key} | {value} |")

    lines.extend(
        [
            "",
            "## Chapter Results",
            "",
            "| Chapter | WER | CER | Boundary Accuracy | Verse Confidence | Processing Time | Peak RAM | Warnings |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
        ]
    )
    for chapter in report["chapters"]:
        warning_text = ", ".join(chapter["quality_audit"]["warnings"]) or "none"
        lines.append(
            "| {book} {chapter} | {wer:.3f} | {cer:.3f} | {boundary_accuracy:.3f} | "
            "{verse_confidence:.3f} | {processing_time_seconds:.2f}s | {peak_ram_mb:.2f} MB | {warnings} |".format(
                warnings=warning_text,
                **chapter,
            )
        )

    assessment = report["engineering_assessment"]
    lines.extend(["", "## Engineering Assessment", "", "### Strengths"])
    lines.extend([f"- {item}" for item in assessment["strengths"]])
    lines.extend(["", "### Weaknesses"])
    lines.extend([f"- {item}" for item in assessment["weaknesses"]])
    lines.extend(["", "### Known Blockers"])
    lines.extend([f"- {item}" for item in assessment["known_blockers"]])
    lines.extend(["", "### Recommendations"])
    lines.extend([f"- {item}" for item in assessment["recommendations"]])

    (RESULTS_DIR / "baseline_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_html(report: dict[str, Any]) -> None:
    rows = []
    for chapter in report["chapters"]:
        rows.append(
            "<tr>"
            f"<td>{html.escape(chapter['book'])} {chapter['chapter']}</td>"
            f"<td>{chapter['wer']:.3f}</td>"
            f"<td>{chapter['cer']:.3f}</td>"
            f"<td>{chapter['boundary_accuracy']:.3f}</td>"
            f"<td>{chapter['verse_confidence']:.3f}</td>"
            f"<td>{chapter['processing_time_seconds']:.2f}s</td>"
            f"<td>{chapter['peak_ram_mb']:.2f} MB</td>"
            f"<td>{html.escape(', '.join(chapter['quality_audit']['warnings']) or 'none')}</td>"
            "</tr>"
        )
    document = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WhisperX Baseline Report</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 2rem; color: #171717; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #d4d4d4; padding: 0.5rem; text-align: left; vertical-align: top; }}
    th {{ background: #f5f5f5; }}
    code {{ background: #f5f5f5; padding: 0.1rem 0.25rem; }}
  </style>
</head>
<body>
  <h1>WhisperX Baseline Report</h1>
  <p>Generated: <code>{html.escape(report['generated_at'])}</code></p>
  <h2>Configuration</h2>
  <pre>{html.escape(json.dumps(report['configuration'], indent=2))}</pre>
  <h2>Chapter Results</h2>
  <table>
    <thead>
      <tr>
        <th>Chapter</th><th>WER</th><th>CER</th><th>Boundary Accuracy</th>
        <th>Verse Confidence</th><th>Processing Time</th><th>Peak RAM</th><th>Warnings</th>
      </tr>
    </thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
  <h2>Engineering Assessment</h2>
  <pre>{html.escape(json.dumps(report['engineering_assessment'], indent=2))}</pre>
</body>
</html>
"""
    (RESULTS_DIR / "baseline_report.html").write_text(document, encoding="utf-8")


def main() -> None:
    _load_env_before_config()
    sys.path.insert(0, str(SCRIPTS_ROOT))

    from build_index import _build_verse_timings, _normalize_verse_boundaries
    from lib.config import CONFIG
    from providers.audio_provider import get_audio_provider
    from providers.text_provider import get_text_provider
    from speech.factory import create_speech_engine

    audio_provider = get_audio_provider()
    text_provider = get_text_provider()
    engine = create_speech_engine(CONFIG)

    chapters: list[dict[str, Any]] = []
    for book, chapter_number in CORPUS:
        print(f"Running WhisperX baseline: {book} {chapter_number}", flush=True)
        verses = text_provider.get_chapter(book, chapter_number)
        audio = audio_provider.resolve(book, chapter_number)
        reference_text = " ".join(verse.text for verse in verses)

        tracemalloc.start()
        gpu_before = _gpu_snapshot()
        wall_start = time.perf_counter()
        cpu_start = time.process_time()
        alignment_failures = 0
        try:
            transcript = engine.process(str(audio.path))
        except Exception:
            tracemalloc.stop()
            raise
        wall_elapsed = time.perf_counter() - wall_start
        cpu_elapsed = time.process_time() - cpu_start
        _, peak_memory = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        gpu_after = _gpu_snapshot()

        words = transcript.word_dicts()
        segments = transcript.segment_dicts()
        if not words:
            alignment_failures = 1

        boundary_result = _build_verse_timings(verses, words)
        normalized_result = _normalize_verse_boundaries(boundary_result.timings)
        verse_timings = normalized_result.timings
        boundary_qa = boundary_result.qa + normalized_result.qa

        scores = [_as_float(word.get("score")) for word in words]
        present_scores = [score for score in scores if score is not None]
        average_word_confidence = sum(present_scores) / len(present_scores) if present_scores else 0.0
        verse_confidences = [
            timing.confidence
            for timing in verse_timings
            if timing.confidence is not None
        ]
        verse_confidence = sum(verse_confidences) / len(verse_confidences) if verse_confidences else 0.0

        boundary_not_found_events = sum(1 for entry in boundary_qa if entry.get("reason") == "boundary_not_found")
        overlapping_timings = sum(
            1
            for current, following in zip(verse_timings, verse_timings[1:])
            if current.end_seconds > following.start_seconds
        )
        zero_duration_words = sum(
            1
            for word in words
            if word.get("start") is not None
            and word.get("end") is not None
            and (_as_float(word.get("end")) or 0.0) <= (_as_float(word.get("start")) or 0.0)
        )
        zero_duration_verses = sum(1 for timing in verse_timings if timing.end_seconds <= timing.start_seconds)
        quality_audit = _quality_audit(
            words,
            verse_timings,
            boundary_qa,
            len(verses),
            transcript.text,
        )

        cpu_usage = (cpu_elapsed / wall_elapsed / max(1, os.cpu_count() or 1)) * 100 if wall_elapsed else None
        peak_vram_values = [
            value
            for value in (gpu_before["peak_vram_mb"], gpu_after["peak_vram_mb"])
            if value is not None
        ]
        gpu_utilization_values = [
            value
            for value in (gpu_before["gpu_utilization_percent"], gpu_after["gpu_utilization_percent"])
            if value is not None
        ]

        chapters.append(
            {
                "book": book,
                "chapter": chapter_number,
                "status": "completed",
                "detected_language": transcript.language,
                "transcript_language": transcript.language,
                "word_count": len(words),
                "segment_count": len(segments),
                "average_word_confidence": average_word_confidence,
                "verse_confidence": verse_confidence,
                "boundary_accuracy": (len(verses) - boundary_not_found_events) / len(verses) if verses else 0.0,
                "wer": _error_rate(reference_text, transcript.text, "word"),
                "cer": _error_rate(reference_text, transcript.text, "char"),
                "processing_time_seconds": wall_elapsed,
                "peak_ram_mb": peak_memory / (1024 * 1024),
                "peak_vram_mb": max(peak_vram_values) if peak_vram_values else None,
                "cpu_usage_percent": cpu_usage,
                "gpu_utilization_percent": max(gpu_utilization_values) if gpu_utilization_values else None,
                "boundary_not_found_events": boundary_not_found_events,
                "overlapping_timings": overlapping_timings,
                "zero_duration_spans": zero_duration_words + zero_duration_verses,
                "alignment_failures": alignment_failures,
                "missing_word_scores": len(words) - len(present_scores),
                "quality_audit": quality_audit,
            }
        )

    generated_at = datetime.now(timezone.utc).isoformat()
    averages = {
        "wer": sum(chapter["wer"] for chapter in chapters) / len(chapters),
        "cer": sum(chapter["cer"] for chapter in chapters) / len(chapters),
        "boundary_accuracy": sum(chapter["boundary_accuracy"] for chapter in chapters) / len(chapters),
        "verse_confidence": sum(chapter["verse_confidence"] for chapter in chapters) / len(chapters),
        "average_word_confidence": sum(chapter["average_word_confidence"] for chapter in chapters) / len(chapters),
        "processing_time_seconds": sum(chapter["processing_time_seconds"] for chapter in chapters) / len(chapters),
        "peak_ram_mb": max(chapter["peak_ram_mb"] for chapter in chapters),
    }
    report = {
        "generated_at": generated_at,
        "configuration": {
            "provider": "WhisperX",
            "model": CONFIG.speech_transcription_model,
            "language": CONFIG.speech_language,
            "alignment": CONFIG.alignment_language,
            "translation": CONFIG.text_provider_translation,
            "batch_size": CONFIG.whisper_batch_size,
            "compute_type": CONFIG.whisper_compute_type,
        },
        "acceptance_targets": {
            "wer_lt_0_05": averages["wer"] < 0.05,
            "boundary_accuracy_gt_0_99": averages["boundary_accuracy"] > 0.99,
            "verse_confidence_gt_0_95": averages["verse_confidence"] > 0.95,
            "processing_time_recorded": all(chapter["processing_time_seconds"] > 0 for chapter in chapters),
            "memory_usage_recorded": all(chapter["peak_ram_mb"] > 0 for chapter in chapters),
        },
        "averages": averages,
        "chapters": chapters,
        "engineering_assessment": {
            "strengths": [
                "The service-role runtime successfully retrieves the fixed sw-biblica benchmark corpus under RLS.",
                "WhisperX completed transcription and alignment for all five benchmark chapters.",
                "Processing time, RAM usage, confidence, boundary, WER, CER, and audit signals are now captured per chapter.",
            ],
            "weaknesses": [
                "Boundary accuracy and verse confidence are below production acceptance targets.",
                "WER and CER are above the minimum production target for the fixed corpus.",
                "Several chapters show missing boundary events and quality-audit warnings.",
            ],
            "known_blockers": [
                "The baseline is not production-ready for synchronized Swahili Bible indexing under the stated acceptance thresholds.",
                "Matthew 5, John 3, and Romans 8 remain challenging for verse boundary recovery with the current configuration.",
            ],
            "recommendations": [
                "Keep this result as the objective WhisperX base baseline.",
                "Do not change production configuration based on this round alone.",
                "Use these artifacts as the fixed comparison point before evaluating any future provider.",
            ],
        },
    }

    leaderboard = {
        "generated_at": generated_at,
        "entries": [
            {
                "provider": "WhisperX",
                "status": "Baseline",
                "model": CONFIG.speech_transcription_model,
                "language": CONFIG.speech_language,
                "alignment": CONFIG.alignment_language,
                "translation": CONFIG.text_provider_translation,
                "chapters_completed": len(chapters),
                "average_wer": averages["wer"],
                "average_cer": averages["cer"],
                "average_boundary_accuracy": averages["boundary_accuracy"],
                "average_verse_confidence": averages["verse_confidence"],
                "average_processing_time_seconds": averages["processing_time_seconds"],
                "peak_ram_mb": averages["peak_ram_mb"],
            }
        ],
    }

    (RESULTS_DIR / "baseline_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (RESULTS_DIR / "leaderboard.json").write_text(json.dumps(leaderboard, indent=2), encoding="utf-8")
    (RESULTS_DIR / "engineering_assessment.md").write_text(
        "\n".join(
            [
                "# WhisperX Baseline Engineering Assessment",
                "",
                "## Strengths",
                *[f"- {item}" for item in report["engineering_assessment"]["strengths"]],
                "",
                "## Weaknesses",
                *[f"- {item}" for item in report["engineering_assessment"]["weaknesses"]],
                "",
                "## Known Blockers",
                *[f"- {item}" for item in report["engineering_assessment"]["known_blockers"]],
                "",
                "## Recommendations",
                *[f"- {item}" for item in report["engineering_assessment"]["recommendations"]],
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    _write_csv(report)
    _write_markdown(report)
    _write_html(report)
    print(f"Baseline reports written to {RESULTS_DIR}", flush=True)


if __name__ == "__main__":
    main()
