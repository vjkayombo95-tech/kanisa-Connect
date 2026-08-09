from __future__ import annotations

import csv
import html
import json
import os
import re
import statistics
import sys
import time
import tracemalloc
import unicodedata
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROUND2_DIR = Path(__file__).resolve().parent
RESULTS_DIR = ROUND2_DIR.parent
BASELINE_DIR = RESULTS_DIR / "baseline"
ROOT = Path(__file__).resolve().parents[4]
AUDIO_ROOT = ROOT / "supabase" / "audio"
SCRIPTS_ROOT = AUDIO_ROOT / "scripts"

sys.path.insert(0, str(BASELINE_DIR))
from generate_whisperx_baseline import (  # type: ignore
    CORPUS,
    _as_float,
    _chars,
    _error_rate,
    _gpu_snapshot,
    _load_env_before_config,
    _quality_audit,
    _tokens,
)


BIBLICAL_NAMES = {
    "Mungu",
    "Yesu",
    "Kristo",
    "Bwana",
    "Ibrahimu",
    "Isaka",
    "Yakobo",
    "Musa",
    "Daudi",
    "Yohana",
    "Paulo",
    "Israeli",
}

_FASTER_MODELS: dict[tuple[str, str, str], Any] = {}
_ALIGNERS: dict[tuple[str, str | None], Any] = {}


def _normalize_text(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    asciiish = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(re.findall(r"[\w']+", asciiish, flags=re.UNICODE))


def _normalized_error_rate(reference_text: str, hypothesis_text: str, unit: str) -> float:
    return _error_rate(_normalize_text(reference_text), _normalize_text(hypothesis_text), unit)


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((percentile / 100) * (len(ordered) - 1))))
    return ordered[index]


def _biblical_name_accuracy(reference_text: str, hypothesis_text: str) -> float | None:
    reference_tokens = CounterToken(_tokens(reference_text))
    hypothesis_tokens = CounterToken(_tokens(hypothesis_text))
    expected = 0
    matched = 0
    for name in BIBLICAL_NAMES:
        key = name.casefold()
        count = reference_tokens.get(key, 0)
        expected += count
        matched += min(count, hypothesis_tokens.get(key, 0))
    if expected == 0:
        return None
    return matched / expected


def CounterToken(tokens: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for token in tokens:
        counts[token] = counts.get(token, 0) + 1
    return counts


def _retry(label: str, operation: Any, attempts: int = 4) -> Any:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except Exception as exc:  # noqa: BLE001 - evaluation harness records provider/runtime failures.
            last_error = exc
            if attempt == attempts:
                break
            print(f"{label} failed on attempt {attempt}; retrying in {attempt * 3}s: {exc}", flush=True)
            time.sleep(attempt * 3)
    raise RuntimeError(f"{label} failed after {attempts} attempts: {last_error}") from last_error


def _word_timing_stats(words: list[dict[str, Any]], segments: list[dict[str, Any]]) -> dict[str, Any]:
    durations: list[float] = []
    timestamp_collapse_count = 0
    for current, following in zip(words, words[1:]):
        current_start = _as_float(current.get("start"))
        current_end = _as_float(current.get("end"))
        next_start = _as_float(following.get("start"))
        if current_start is not None and current_end is not None:
            duration = current_end - current_start
            durations.append(duration)
            if duration <= 0:
                timestamp_collapse_count += 1
        if current_end is not None and next_start is not None and current_end > next_start:
            timestamp_collapse_count += 1

    last_word_end = max([_as_float(word.get("end")) or 0.0 for word in words], default=0.0)
    last_segment_end = max([_as_float(segment.get("end")) or 0.0 for segment in segments], default=0.0)
    return {
        "average_word_timing_error_ms": None,
        "average_verse_timing_error_ms": None,
        "p95_timing_error_ms": None,
        "timestamp_drift_seconds": last_word_end - last_segment_end,
        "timestamp_collapse_count": timestamp_collapse_count,
        "median_word_duration_ms": (statistics.median(durations) * 1000) if durations else None,
        "p95_word_duration_ms": ((_percentile(durations, 95) or 0.0) * 1000) if durations else None,
        "timing_error_note": "No manually corrected golden timing reference is available for Round 2 timing-error deltas.",
    }


def _faster_whisper_transcript(config: Any, audio_path: Path) -> Any:
    from faster_whisper import WhisperModel
    from speech.types import StandardTranscript, TranscriptSegment
    from speech.whisperx_engine import WhisperXSpeechEngine

    model_key = (config.speech_transcription_model, "cpu", config.whisper_compute_type)
    model = _FASTER_MODELS.get(model_key)
    if model is None:
        model = WhisperModel(
            config.speech_transcription_model,
            device="cpu",
            compute_type=config.whisper_compute_type,
            download_root=str(config.models_dir),
        )
        _FASTER_MODELS[model_key] = model
    segments_iter, info = model.transcribe(
        str(audio_path),
        language=config.speech_language,
        beam_size=5,
        best_of=5,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    segments = [
        TranscriptSegment(
            start=float(segment.start),
            end=float(segment.end),
            text=segment.text.strip(),
            confidence=None,
            metadata={"avg_logprob": segment.avg_logprob, "no_speech_prob": segment.no_speech_prob},
        )
        for segment in segments_iter
    ]
    transcript = StandardTranscript(
        language=getattr(info, "language", config.speech_language) or config.speech_language,
        text=" ".join(segment.text for segment in segments).strip(),
        segments=segments,
        words=[],
        metadata={"provider": "faster_whisper", "duration": getattr(info, "duration", None)},
    )
    aligner_key = (config.speech_transcription_model, config.alignment_language)
    aligner = _ALIGNERS.get(aligner_key)
    if aligner is None:
        aligner = WhisperXSpeechEngine(config)
        _ALIGNERS[aligner_key] = aligner
    return aligner._align(audio_path, transcript)


def _run_provider(provider_key: str, display_name: str, config: Any, slug: str) -> dict[str, Any]:
    from build_index import _build_verse_timings, _normalize_verse_boundaries
    from providers.audio_provider import get_audio_provider
    from providers.text_provider import get_text_provider
    from speech.factory import create_speech_engine

    audio_provider = get_audio_provider()
    text_provider = get_text_provider()
    engine = create_speech_engine(config) if provider_key == "whisperx" else None
    partial_path = ROUND2_DIR / f"{slug}.partial.json"
    if partial_path.exists():
        existing = json.loads(partial_path.read_text(encoding="utf-8"))
        chapters: list[dict[str, Any]] = [
            chapter
            for chapter in existing.get("chapters", [])
            if chapter.get("status") == "completed"
        ]
    else:
        chapters = []
    completed_keys = {
        (chapter.get("book"), chapter.get("chapter"))
        for chapter in chapters
        if chapter.get("status") == "completed"
    }

    for book, chapter_number in CORPUS:
        if (book, chapter_number) in completed_keys:
            print(f"Skipping recorded {display_name}: {book} {chapter_number}", flush=True)
            continue
        print(f"Running {display_name}: {book} {chapter_number}", flush=True)
        try:
            verses = _retry(f"text lookup {book} {chapter_number}", lambda: text_provider.get_chapter(book, chapter_number))
            audio = _retry(f"audio lookup {book} {chapter_number}", lambda: audio_provider.resolve(book, chapter_number))
        except Exception as exc:
            chapters.append(
                {
                    "book": book,
                    "chapter": chapter_number,
                    "status": "failed",
                    "error": str(exc),
                    "processing_time_seconds": 0.0,
                    "peak_ram_mb": 0.0,
                }
            )
            partial_path.write_text(json.dumps({"provider": display_name, "chapters": chapters}, indent=2), encoding="utf-8")
            continue
        reference_text = " ".join(verse.text for verse in verses)

        tracemalloc.start()
        gpu_before = _gpu_snapshot()
        start_wall = time.perf_counter()
        start_cpu = time.process_time()
        status = "completed"
        error: str | None = None
        try:
            if provider_key == "whisperx":
                transcript = engine.process(audio.path)
            else:
                transcript = _faster_whisper_transcript(config, audio.path)
        except Exception as exc:
            status = "failed"
            error = str(exc)
            transcript = None
        processing_time = time.perf_counter() - start_wall
        cpu_elapsed = time.process_time() - start_cpu
        _, peak_memory = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        gpu_after = _gpu_snapshot()

        if transcript is None:
            chapters.append(
                {
                    "book": book,
                    "chapter": chapter_number,
                    "status": status,
                    "error": error,
                    "processing_time_seconds": processing_time,
                    "peak_ram_mb": peak_memory / (1024 * 1024),
                }
            )
            continue

        words = transcript.word_dicts()
        segments = transcript.segment_dicts()
        boundary_result = _build_verse_timings(verses, words)
        normalized_result = _normalize_verse_boundaries(boundary_result.timings)
        verse_timings = normalized_result.timings
        boundary_qa = boundary_result.qa + normalized_result.qa
        boundary_not_found = sum(1 for entry in boundary_qa if entry.get("reason") == "boundary_not_found")
        present_scores = [_as_float(word.get("score")) for word in words if _as_float(word.get("score")) is not None]
        verse_confidences = [timing.confidence for timing in verse_timings if timing.confidence is not None]
        quality_audit = _quality_audit(words, verse_timings, boundary_qa, len(verses), transcript.text)
        timing_stats = _word_timing_stats(words, segments)
        audio_duration = max([_as_float(segment.get("end")) or 0.0 for segment in segments], default=0.0)
        gpu_values = [value for value in (gpu_before["gpu_utilization_percent"], gpu_after["gpu_utilization_percent"]) if value is not None]
        vram_values = [value for value in (gpu_before["peak_vram_mb"], gpu_after["peak_vram_mb"]) if value is not None]

        chapters.append(
            {
                "book": book,
                "chapter": chapter_number,
                "status": status,
                "detected_language": transcript.language,
                "transcript_language": transcript.language,
                "word_count": len(words),
                "segment_count": len(segments),
                "average_word_confidence": sum(present_scores) / len(present_scores) if present_scores else 0.0,
                "verse_confidence": sum(verse_confidences) / len(verse_confidences) if verse_confidences else 0.0,
                "boundary_accuracy": (len(verses) - boundary_not_found) / len(verses) if verses else 0.0,
                "wer": _error_rate(reference_text, transcript.text, "word"),
                "cer": _error_rate(reference_text, transcript.text, "char"),
                "normalized_wer": _normalized_error_rate(reference_text, transcript.text, "word"),
                "normalized_cer": _normalized_error_rate(reference_text, transcript.text, "char"),
                "processing_time_seconds": processing_time,
                "peak_ram_mb": peak_memory / (1024 * 1024),
                "peak_vram_mb": max(vram_values) if vram_values else None,
                "cpu_usage_percent": (cpu_elapsed / processing_time / max(1, os.cpu_count() or 1)) * 100 if processing_time else None,
                "gpu_utilization_percent": max(gpu_values) if gpu_values else None,
                "words_per_second": len(words) / processing_time if processing_time else None,
                "audio_minutes_per_minute": (audio_duration / 60) / (processing_time / 60) if processing_time else None,
                "boundary_not_found_count": boundary_not_found,
                "overlapping_timings": sum(1 for a, b in zip(verse_timings, verse_timings[1:]) if a.end_seconds > b.start_seconds),
                "zero_duration_spans": sum(1 for timing in verse_timings if timing.end_seconds <= timing.start_seconds),
                "alignment_failures": 0 if words else 1,
                "missing_word_scores": len(words) - len(present_scores),
                "proper_biblical_name_accuracy": _biblical_name_accuracy(reference_text, transcript.text),
                "repeated_phrase_detection": len(quality_audit["repeated_phrases"]),
                "english_hallucination_count": quality_audit["english_hallucinations"],
                "duplicate_verse_count": len(quality_audit["duplicate_verses"]),
                "missing_verse_count": quality_audit["missing_verses"],
                "qa_pass": boundary_not_found == 0 and (sum(verse_confidences) / len(verse_confidences) if verse_confidences else 0.0) >= 0.95,
                "quality_audit": quality_audit,
                **timing_stats,
            }
        )
        partial_path.write_text(json.dumps({"provider": display_name, "chapters": chapters}, indent=2), encoding="utf-8")

    completed = [chapter for chapter in chapters if chapter.get("status") == "completed"]
    averages = {}
    for key in (
        "wer",
        "cer",
        "normalized_wer",
        "normalized_cer",
        "boundary_accuracy",
        "verse_confidence",
        "average_word_confidence",
        "processing_time_seconds",
        "peak_ram_mb",
        "words_per_second",
        "audio_minutes_per_minute",
        "english_hallucination_count",
        "missing_word_scores",
        "boundary_not_found_count",
        "timestamp_collapse_count",
        "duplicate_verse_count",
        "missing_verse_count",
    ):
        values = [chapter[key] for chapter in completed if chapter.get(key) is not None]
        averages[key] = sum(values) / len(values) if values else None
    averages["import_success_rate"] = len(completed) / len(chapters) if chapters else 0.0
    averages["qa_pass_rate"] = sum(1 for chapter in completed if chapter.get("qa_pass")) / len(completed) if completed else 0.0
    return {
        "provider": display_name,
        "configuration": {
            "provider": provider_key,
            "model": config.speech_transcription_model,
            "language": config.speech_language,
            "alignment": config.alignment_language,
            "translation": config.text_provider_translation,
            "batch_size": config.whisper_batch_size,
            "compute_type": config.whisper_compute_type,
        },
        "chapters": chapters,
        "averages": averages,
    }


def _write_provider_reports(slug: str, report: dict[str, Any]) -> None:
    json_path = ROUND2_DIR / f"{slug}.json"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    fields = [
        "book", "chapter", "status", "wer", "cer", "normalized_wer", "normalized_cer",
        "boundary_accuracy", "verse_confidence", "average_word_confidence",
        "processing_time_seconds", "peak_ram_mb", "peak_vram_mb", "cpu_usage_percent",
        "gpu_utilization_percent", "words_per_second", "audio_minutes_per_minute",
        "boundary_not_found_count", "timestamp_collapse_count", "duplicate_verse_count",
        "missing_verse_count", "english_hallucination_count", "missing_word_scores",
        "proper_biblical_name_accuracy", "repeated_phrase_detection", "qa_pass", "error",
    ]
    with (ROUND2_DIR / f"{slug}.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for chapter in report["chapters"]:
            writer.writerow({field: chapter.get(field) for field in fields})

    lines = [
        f"# {report['provider']} Round 2 Report",
        "",
        "## Configuration",
        "",
        "| Field | Value |",
        "| --- | --- |",
    ]
    lines.extend([f"| {key} | {value} |" for key, value in report["configuration"].items()])
    lines.extend([
        "",
        "## Chapter Results",
        "",
        "| Chapter | WER | CER | Boundary Accuracy | Verse Confidence | Time | Warnings |",
        "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ])
    for chapter in report["chapters"]:
        if chapter.get("status") != "completed":
            lines.append(f"| {chapter['book']} {chapter['chapter']} | n/a | n/a | n/a | n/a | {chapter.get('processing_time_seconds', 0):.2f}s | {chapter.get('error')} |")
            continue
        warnings = ", ".join(chapter["quality_audit"]["warnings"]) or "none"
        lines.append(f"| {chapter['book']} {chapter['chapter']} | {chapter['wer']:.3f} | {chapter['cer']:.3f} | {chapter['boundary_accuracy']:.3f} | {chapter['verse_confidence']:.3f} | {chapter['processing_time_seconds']:.2f}s | {warnings} |")
    (ROUND2_DIR / f"{slug}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    rows = "".join(
        f"<tr><td>{html.escape(chapter['book'])} {chapter['chapter']}</td><td>{chapter.get('status')}</td><td>{chapter.get('wer', 'n/a')}</td><td>{chapter.get('cer', 'n/a')}</td><td>{chapter.get('boundary_accuracy', 'n/a')}</td><td>{html.escape(str(chapter.get('error', '')))}</td></tr>"
        for chapter in report["chapters"]
    )
    (ROUND2_DIR / f"{slug}.html").write_text(
        f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(report['provider'])}</title></head><body><h1>{html.escape(report['provider'])} Round 2 Report</h1><pre>{html.escape(json.dumps(report['averages'], indent=2))}</pre><table border='1'><tr><th>Chapter</th><th>Status</th><th>WER</th><th>CER</th><th>Boundary Accuracy</th><th>Error</th></tr>{rows}</table></body></html>",
        encoding="utf-8",
    )


def _delta(new: float | None, old: float | None) -> float | None:
    if new is None or old is None:
        return None
    return old - new


def _write_comparison(baseline: dict[str, Any], reports: list[dict[str, Any]], generated_at: str) -> None:
    baseline_avg = baseline["averages"]
    rows = []
    for report in reports:
        avg = report["averages"]
        rows.append({
            "provider": report["provider"],
            "wer": avg.get("wer"),
            "wer_improvement": _delta(avg.get("wer"), baseline_avg.get("wer")),
            "cer": avg.get("cer"),
            "cer_improvement": _delta(avg.get("cer"), baseline_avg.get("cer")),
            "boundary_accuracy": avg.get("boundary_accuracy"),
            "verse_confidence": avg.get("verse_confidence"),
            "english_hallucinations": avg.get("english_hallucination_count"),
            "import_success_rate": avg.get("import_success_rate"),
            "qa_pass_rate": avg.get("qa_pass_rate"),
            "processing_time_seconds": avg.get("processing_time_seconds"),
        })

    with (ROUND2_DIR / "comparison_round2.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    md = ["# Round 2 Comparison", "", f"Generated: {generated_at}", "", "| Provider | WER | WER Improvement | CER | CER Improvement | Boundary Accuracy | Verse Confidence | Import Success | QA Pass |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for row in rows:
        md.append(f"| {row['provider']} | {_fmt(row['wer'])} | {_fmt(row['wer_improvement'])} | {_fmt(row['cer'])} | {_fmt(row['cer_improvement'])} | {_fmt(row['boundary_accuracy'])} | {_fmt(row['verse_confidence'])} | {_fmt(row['import_success_rate'])} | {_fmt(row['qa_pass_rate'])} |")
    (ROUND2_DIR / "comparison_round2.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    (ROUND2_DIR / "comparison_round2.html").write_text(
        "<!doctype html><html><head><meta charset='utf-8'><title>Round 2 Comparison</title></head><body><pre>"
        + html.escape(json.dumps(rows, indent=2))
        + "</pre></body></html>",
        encoding="utf-8",
    )

    leaderboard_entries = [
        {
            "provider": "WhisperX",
            "status": "Baseline",
            "model": "base",
            "average_wer": baseline_avg.get("wer"),
            "average_cer": baseline_avg.get("cer"),
            "average_boundary_accuracy": baseline_avg.get("boundary_accuracy"),
            "average_verse_confidence": baseline_avg.get("verse_confidence"),
        }
    ]
    for report in reports:
        avg = report["averages"]
        leaderboard_entries.append({
            "provider": report["provider"],
            "status": "Round 2",
            "model": report["configuration"]["model"],
            "average_wer": avg.get("wer"),
            "average_cer": avg.get("cer"),
            "average_boundary_accuracy": avg.get("boundary_accuracy"),
            "average_verse_confidence": avg.get("verse_confidence"),
            "import_success_rate": avg.get("import_success_rate"),
            "qa_pass_rate": avg.get("qa_pass_rate"),
        })
    (ROUND2_DIR / "leaderboard.json").write_text(json.dumps({"generated_at": generated_at, "entries": leaderboard_entries}, indent=2), encoding="utf-8")
    _write_assessment(baseline_avg, rows, reports, generated_at)


def _fmt(value: Any) -> str:
    return "n/a" if value is None else f"{value:.3f}" if isinstance(value, float) else str(value)


def _write_assessment(baseline_avg: dict[str, Any], rows: list[dict[str, Any]], reports: list[dict[str, Any]], generated_at: str) -> None:
    completed_rows = [row for row in rows if row.get("import_success_rate")]
    best_wer = min(completed_rows, key=lambda row: row["wer"]) if completed_rows else None
    best_boundary = max(completed_rows, key=lambda row: row["boundary_accuracy"]) if completed_rows else None
    whisperx_large = next((row for row in rows if row["provider"] == "WhisperX large-v3"), None)
    faster = next((row for row in rows if row["provider"] == "Faster-Whisper large-v3"), None)
    lines = [
        "# Round 2 Engineering Assessment",
        "",
        f"Generated: {generated_at}",
        "",
        "1. How much did WER improve?",
        f"   WhisperX large-v3: {_fmt(whisperx_large.get('wer_improvement') if whisperx_large else None)} absolute WER improvement versus baseline. Faster-Whisper large-v3: {_fmt(faster.get('wer_improvement') if faster else None)}.",
        "",
        "2. How much did CER improve?",
        f"   WhisperX large-v3: {_fmt(whisperx_large.get('cer_improvement') if whisperx_large else None)} absolute CER improvement versus baseline. Faster-Whisper large-v3: {_fmt(faster.get('cer_improvement') if faster else None)}.",
        "",
        "3. Did Boundary Accuracy improve?",
        f"   Baseline: {_fmt(baseline_avg.get('boundary_accuracy'))}. Best Round 2: {_fmt(best_boundary.get('boundary_accuracy') if best_boundary else None)} ({best_boundary.get('provider') if best_boundary else 'n/a'}).",
        "",
        "4. Did Verse Confidence improve?",
        f"   Baseline: {_fmt(baseline_avg.get('verse_confidence'))}. Round 2 values are recorded in comparison_round2.csv.",
        "",
        "5. Did English hallucinations decrease?",
        "   English hallucination counts are recorded per provider and chapter in the JSON/CSV reports.",
        "",
        "6. Which provider produced cleaner Swahili?",
        f"   Lowest measured WER provider: {best_wer.get('provider') if best_wer else 'n/a'}.",
        "",
        "7. Which provider produced better word timestamps?",
        "   No manually corrected golden timing reference is available, so absolute word timing error cannot be objectively ranked in this round.",
        "",
        "8. Which provider should advance to Round 3?",
        f"   Advance the lowest measured WER/CER provider with successful imports: {best_wer.get('provider') if best_wer else 'none'}."
        if best_wer
        else "   No provider completed successfully, so none can advance on measured quality.",
        "",
        "9. Was improvement primarily due to the larger model or the provider implementation?",
        "   Compare WhisperX large-v3 against baseline to isolate model size; compare Faster-Whisper large-v3 against WhisperX large-v3 to isolate provider implementation. The measured deltas are in comparison_round2.csv.",
    ]
    (ROUND2_DIR / "engineering_assessment_round2.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    _load_env_before_config()
    sys.path.insert(0, str(SCRIPTS_ROOT))

    from lib.config import CONFIG

    generated_at = datetime.now(timezone.utc).isoformat()
    baseline = json.loads((BASELINE_DIR / "baseline_report.json").read_text(encoding="utf-8"))
    whisperx_config = replace(
        CONFIG,
        speech_engine_provider="whisperx",
        speech_transcription_model="large-v3",
        whisper_model_size="large-v3",
        speech_language="sw",
        whisper_language="sw",
    )
    faster_config = replace(
        CONFIG,
        speech_engine_provider="faster_whisper",
        speech_transcription_model="large-v3",
        whisper_model_size="large-v3",
        speech_language="sw",
        whisper_language="sw",
    )

    requested_provider = os.environ.get("ROUND2_PROVIDER", "").strip().lower()
    provider_specs = [
        ("whisperx", "WhisperX large-v3", whisperx_config, "whisperx_large_v3"),
        ("faster_whisper", "Faster-Whisper large-v3", faster_config, "faster_whisper_large_v3"),
    ]
    if requested_provider:
        provider_specs = [spec for spec in provider_specs if spec[0] == requested_provider or spec[3] == requested_provider]

    reports = []
    for provider_key, display_name, provider_config, slug in provider_specs:
        report = _run_provider(provider_key, display_name, provider_config, slug)
        report["generated_at"] = generated_at
        _write_provider_reports(slug, report)
        reports.append(report)

    if len(reports) < 2:
        existing_reports = []
        for slug in ("whisperx_large_v3", "faster_whisper_large_v3"):
            path = ROUND2_DIR / f"{slug}.json"
            if path.exists():
                existing_reports.append(json.loads(path.read_text(encoding="utf-8")))
        reports = existing_reports or reports
    _write_comparison(baseline, reports, generated_at)
    print(f"Round 2 reports written to {ROUND2_DIR}", flush=True)


if __name__ == "__main__":
    main()
