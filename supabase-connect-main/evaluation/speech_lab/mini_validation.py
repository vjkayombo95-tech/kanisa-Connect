from __future__ import annotations

import csv
import json
import shutil
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .biblica_reference import DEFAULT_REFERENCE_ROOT, BiblicaChapter, BiblicaReferenceLoader, BiblicaVerse
from .corpus import chapter_by_id
from .models import Transcript
from .providers.faster_whisper_provider import FasterWhisperProvider, default_compute_type, detect_device, is_model_cached, resolve_audio_path
from .psa23_diagnostic import score_text
from .psa23_large_model import local_candidate_cache_dir
from .spoken_review import read_xlsx
from .verse_alignment import CanonicalVerse, align_transcript_to_verses


VAD_OPTIONS = {"vad_filter": True, "vad_parameters": {"min_silence_duration_ms": 500, "speech_pad_ms": 200}}
DEFAULT_TIMING_WORKBOOK = Path("evaluation/speech_lab/golden/golden_reference_bible_swahili_import_ready.xlsx")
DEFAULT_OUTPUT_DIR = Path("evaluation/speech_lab/reports")
DEFAULT_MODEL_OUTPUTS = Path("evaluation/speech_lab/model_outputs/mini-validation")
DEFAULT_SUBSET_ROOT = Path("evaluation/speech_lab/reference_sources/biblica_open_kiswahili/subsets")


MODEL_CONFIGS = {
    "medium_vad_tuned": {
        "model_id": "Systran/faster-whisper-medium",
        "model_label": "Faster Whisper Medium VAD Tuned",
        "output_slug": "medium-vad-tuned",
    },
    "large-v3": {
        "model_id": "Systran/faster-whisper-large-v3",
        "model_label": "Faster Whisper Large-v3",
        "output_slug": "large-v3",
        "local_cache_name": "large-v3",
    },
    "large-v3-turbo": {
        "model_id": "deepdml/faster-whisper-large-v3-turbo-ct2",
        "model_label": "Faster Whisper Large-v3 Turbo CT2",
        "output_slug": "large-v3-turbo",
        "local_cache_name": "large-v3-turbo",
    },
}


class MiniValidationError(RuntimeError):
    pass


def run_mini_validation(
    *,
    chapters: list[str],
    verse_range: tuple[int, int],
    models: list[str] | None = None,
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    model_outputs_root: str | Path = DEFAULT_MODEL_OUTPUTS,
    subset_root: str | Path = DEFAULT_SUBSET_ROOT,
    timing_workbook: str | Path = DEFAULT_TIMING_WORKBOOK,
    dry_run: bool = False,
    skip_existing: bool = False,
    overwrite: bool = False,
) -> dict[str, Any]:
    selected_models = models or ["medium_vad_tuned", "large-v3", "large-v3-turbo"]
    preflight = mini_preflight(chapters=chapters, verse_range=verse_range, models=selected_models, timing_workbook=timing_workbook)
    subset_paths = create_reference_subsets(chapters=chapters, verse_range=verse_range, output_root=subset_root, overwrite=overwrite)
    if dry_run:
        return {
            "dry_run": True,
            "preflight": preflight,
            "subset_paths": [str(path) for path in subset_paths],
            "planned_outputs": planned_outputs(chapters, verse_range, selected_models, model_outputs_root, output_dir),
        }
    rows: list[dict[str, Any]] = []
    verse_rows: list[dict[str, Any]] = []
    started = time.perf_counter()
    for chapter_id in chapters:
        sample = sample_id(chapter_id, verse_range)
        reference = load_subset_reference(Path(subset_root) / f"{sample}.json")
        for model in selected_models:
            transcript_path = ensure_sample_transcript(
                chapter_id=chapter_id,
                sample=sample,
                model=model,
                timing_workbook=timing_workbook,
                model_outputs_root=model_outputs_root,
                skip_existing=skip_existing,
                overwrite=overwrite,
            )
            row, per_verse = score_sample(model, sample, transcript_path, reference)
            rows.append(row)
            verse_rows.extend(per_verse)
    for row in rows:
        row.update(_comparison_fields(row, rows))
    summary_rows = sorted(rows, key=lambda row: (row["sample"], row["wer"], row["cer"], -row["coverage"]))
    confidence = classify_all_samples(summary_rows)
    outputs = write_mini_reports(
        rows=summary_rows,
        verse_rows=verse_rows,
        confidence=confidence,
        preflight=preflight,
        output_dir=output_dir,
        overwrite=overwrite,
    )
    return {
        "dry_run": False,
        "actual_runtime_seconds": time.perf_counter() - started,
        "preflight": preflight,
        "confidence": confidence,
        "rows": summary_rows,
        "verse_rows": verse_rows,
        "outputs": {key: str(path) for key, path in outputs.items()},
    }


def mini_preflight(
    *,
    chapters: list[str],
    verse_range: tuple[int, int],
    models: list[str],
    timing_workbook: str | Path = DEFAULT_TIMING_WORKBOOK,
) -> dict[str, Any]:
    timings = load_timing_rows(timing_workbook)
    device = detect_device()
    compute_type = default_compute_type(device)
    candidates = []
    total_audio_seconds = 0.0
    for chapter_id in chapters:
        start_ms, end_ms = sample_timing(chapter_id, verse_range, timings)
        total_audio_seconds += (end_ms - start_ms) / 1000
    for model in models:
        config = model_config(model)
        cached = model_cached(model)
        candidates.append(
            {
                "model": model,
                "model_id": config["model_id"],
                "cached": cached,
                "safe_to_run": cached,
                "skip_reason": "" if cached else "model_not_cached_no_download_allowed",
            }
        )
    return {
        "generated_at": now(),
        "chapters": chapters,
        "verse_range": list(verse_range),
        "sample_count": len(chapters),
        "model_count": len(models),
        "total_audio_seconds": total_audio_seconds,
        "estimated_runtime_seconds": total_audio_seconds * len(models) * 2.2,
        "expected_cpu_load": "high_single_process_cpu_int8",
        "expected_new_disk_bytes": 2_000_000 * len(chapters) * len(models),
        "free_disk_bytes": shutil.disk_usage(Path.cwd()).free,
        "device": device,
        "compute_type": compute_type,
        "candidates": candidates,
    }


def create_reference_subsets(
    *,
    chapters: list[str],
    verse_range: tuple[int, int],
    output_root: str | Path = DEFAULT_SUBSET_ROOT,
    overwrite: bool = False,
) -> list[Path]:
    loader = BiblicaReferenceLoader(DEFAULT_REFERENCE_ROOT)
    output = Path(output_root)
    output.mkdir(parents=True, exist_ok=True)
    paths = []
    start, end = verse_range
    for chapter_id in chapters:
        chapter = loader.chapter(chapter_id)
        subset = {
            **chapter.to_dict(),
            "chapter_id": sample_id(chapter_id, verse_range),
            "source_chapter_id": chapter_id,
            "reference_type": "biblica_candidate",
            "verse_range": [start, end],
            "verses": [asdict(verse) for verse in chapter.verses if start <= verse.verse <= end],
        }
        path = output / f"{subset['chapter_id']}.json"
        if path.exists() and not overwrite:
            paths.append(path)
            continue
        path.write_text(json.dumps(subset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        paths.append(path)
    return paths


def ensure_sample_transcript(
    *,
    chapter_id: str,
    sample: str,
    model: str,
    timing_workbook: str | Path,
    model_outputs_root: str | Path,
    skip_existing: bool,
    overwrite: bool,
) -> Path:
    output = Path(model_outputs_root) / model_config(model)["output_slug"] / f"{sample}.json"
    if output.exists() and (skip_existing or transcript_matches(output, model, sample)):
        return output
    if output.exists() and not overwrite:
        output = unique_path(output)
    if not model_cached(model):
        raise MiniValidationError(f"Model is not cached; refusing download for mini validation: {model}")
    timings = load_timing_rows(timing_workbook)
    start_ms, end_ms = sample_timing(chapter_id, parse_range_from_sample(sample), timings)
    options = {
        **VAD_OPTIONS,
        "clip_timestamps": [start_ms / 1000, end_ms / 1000],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    provider = FasterWhisperProvider(model_name=model_source(model), language="sw", transcription_options=options)
    transcript = provider.transcribe(chapter_by_id(chapter_id), resolve_audio_path(chapter_id))
    transcript.chapter_id = sample
    metadata = dict(transcript.metadata)
    metadata.update(
        {
            "sample_id": sample,
            "source_chapter_id": chapter_id,
            "verse_range": list(parse_range_from_sample(sample)),
            "model_key": model,
            "model_id": model_config(model)["model_id"],
            "model_label": model_config(model)["model_label"],
            "reference_type": "biblica_candidate",
            "generated_at": now(),
            "effective_transcription_options": options,
            "word_timestamps": True,
            "no_download": True,
        }
    )
    transcript.metadata = metadata
    output.write_text(json.dumps(transcript.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def score_sample(model: str, sample: str, transcript_path: str | Path, reference: list[CanonicalVerse]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    transcript = load_transcript(transcript_path)
    aligned = align_transcript_to_verses(transcript, reference)
    reference_text = " ".join(verse.text for verse in reference)
    score = score_text(reference_text, transcript.text)
    aligned_statuses = {"aligned", "recovered_between_neighbors"}
    unresolved = [verse.verse for verse in aligned.verses if verse.status not in aligned_statuses]
    coverage_values = [
        verse.matched_tokens / verse.reference_tokens
        for verse in aligned.verses
        if verse.reference_tokens and verse.status in aligned_statuses
    ]
    row = {
        "sample": sample,
        "source_chapter_id": sample.rsplit("_", 2)[0],
        "model": model,
        "reference_type": "biblica_candidate",
        "wer": score["wer"],
        "cer": score["cer"],
        "coverage": sum(coverage_values) / len(coverage_values) if coverage_values else 0.0,
        "verse_resolution": (len(aligned.verses) - len(unresolved)) / len(aligned.verses),
        "unresolved_verses": ",".join(str(verse) for verse in unresolved),
        "runtime_seconds": transcript.metadata.get("transcription_runtime_seconds", 0),
        "transcript_path": str(transcript_path),
    }
    verse_rows = []
    for verse in reference:
        assigned = " ".join(word.word for word in aligned.words if word.verse == verse.verse)
        verse_score = score_text(verse.text, assigned)
        candidate = next(item for item in aligned.verses if item.verse == verse.verse)
        verse_rows.append(
            {
                "sample": sample,
                "model": model,
                "verse": verse.verse,
                "wer": verse_score["wer"],
                "cer": verse_score["cer"],
                "alignment_status": candidate.status,
                "assigned_asr_text": assigned,
            }
        )
    return row, verse_rows


def classify_sample(rows: list[dict[str, Any]]) -> str:
    by_model = {row["model"]: row for row in rows}
    medium = by_model.get("medium_vad_tuned")
    large = by_model.get("large-v3")
    turbo = by_model.get("large-v3-turbo")
    if not medium or not large:
        return "inconclusive"
    wer_gain = medium["wer"] - large["wer"]
    cer_gain = medium["cer"] - large["cer"]
    coverage_gain = large["coverage"] - medium["coverage"]
    if wer_gain <= 0:
        return "weak_generalization"
    improved_verses = 0
    total = 0
    for verse in range(1, 11):
        m = next((row for row in rows if row["model"] == "medium_vad_tuned" and row.get("verse") == verse), None)
        l = next((row for row in rows if row["model"] == "large-v3" and row.get("verse") == verse), None)
        if m and l:
            total += 1
            improved_verses += int(l["wer"] < m["wer"])
    if wer_gain >= 0.10 and cer_gain >= 0 and coverage_gain >= 0:
        return "strong_generalization"
    if wer_gain > 0 and (cer_gain >= 0 or coverage_gain >= 0):
        return "moderate_generalization"
    return "weak_generalization"


def classify_all_samples(rows: list[dict[str, Any]]) -> dict[str, Any]:
    samples = sorted({row["sample"] for row in rows})
    sample_classes = {}
    large_beats_medium = 0
    turbo_close = 0
    for sample in samples:
        sample_rows = [row for row in rows if row["sample"] == sample]
        sample_classes[sample] = classify_sample(sample_rows)
        by_model = {row["model"]: row for row in sample_rows}
        if by_model.get("large-v3") and by_model.get("medium_vad_tuned") and by_model["large-v3"]["wer"] < by_model["medium_vad_tuned"]["wer"]:
            large_beats_medium += 1
        if by_model.get("large-v3") and by_model.get("large-v3-turbo"):
            large_wer = by_model["large-v3"]["wer"]
            turbo_wer = by_model["large-v3-turbo"]["wer"]
            if large_wer == 0 or ((turbo_wer - large_wer) / large_wer) <= 0.15:
                turbo_close += 1
    if large_beats_medium == len(samples) and turbo_close == len(samples):
        overall = "strong_generalization"
    elif large_beats_medium >= 2:
        overall = "moderate_generalization"
    elif large_beats_medium == 1:
        overall = "weak_generalization"
    else:
        overall = "inconclusive"
    return {"overall": overall, "sample_classes": sample_classes, "large_beats_medium_count": large_beats_medium, "turbo_close_count": turbo_close}


def write_mini_reports(
    *,
    rows: list[dict[str, Any]],
    verse_rows: list[dict[str, Any]],
    confidence: dict[str, Any],
    preflight: dict[str, Any],
    output_dir: str | Path,
    overwrite: bool = False,
) -> dict[str, Path]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    json_path = unique_path(output / "mini_validation_summary.json") if not overwrite else output / "mini_validation_summary.json"
    csv_path = json_path.with_suffix(".csv")
    md_path = json_path.with_suffix(".md")
    payload = {"preflight": preflight, "confidence": confidence, "rows": rows, "verse_rows": verse_rows}
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(csv_path, rows)
    md_path.write_text(mini_markdown(rows, confidence, preflight), encoding="utf-8")
    return {"json": json_path, "csv": csv_path, "markdown": md_path}


def mini_markdown(rows: list[dict[str, Any]], confidence: dict[str, Any], preflight: dict[str, Any]) -> str:
    lines = [
        "# Mini Large-Model Validation",
        "",
        f"Overall confidence: `{confidence['overall']}`",
        "",
        "| Sample | Model | WER | CER | Coverage | Resolution | Runtime |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in rows:
        lines.append(f"| {row['sample']} | {row['model']} | {row['wer']:.4f} | {row['cer']:.4f} | {row['coverage']:.4f} | {row['verse_resolution']:.4f} | {float(row['runtime_seconds']):.2f} |")
    best_by_sample = []
    for sample in sorted({row["sample"] for row in rows}):
        sample_rows = [row for row in rows if row["sample"] == sample]
        best = min(sample_rows, key=lambda item: (item["wer"], item["cer"]))
        best_by_sample.append((sample, best))
    lines.extend(["", "## Answers", ""])
    lines.append(f"- Large-v3 beat Medium in {confidence['large_beats_medium_count']} of {len(best_by_sample)} subsets.")
    lines.append(f"- Turbo stayed within 15% of Large-v3 in {confidence['turbo_close_count']} of {len(best_by_sample)} subsets.")
    lines.append(f"- Most benefited subset: `{min(best_by_sample, key=lambda item: item[1]['wer'])[0]}`.")
    lines.append(f"- Full benchmark justified: {'yes' if confidence['overall'] in {'strong_generalization', 'moderate_generalization'} else 'not yet'}.")
    lines.append(f"- Estimated mini-validation CPU runtime before execution: {preflight['estimated_runtime_seconds']:.1f}s.")
    lines.append("- Estimated full benchmark CPU cost should be projected from these cached-model runtimes before running full chapters.")
    return "\n".join(lines) + "\n"


def load_timing_rows(path: str | Path) -> dict[tuple[str, int], dict[str, Any]]:
    workbook = read_xlsx(Path(path))
    rows = workbook["golden_references"]
    headers = [str(rows[0][index]).strip() for index in sorted(rows[0])]
    result: dict[tuple[str, int], dict[str, Any]] = {}
    for raw in rows[1:]:
        row = {headers[index - 1]: raw.get(index, "") for index in range(1, len(headers) + 1)}
        if not row.get("chapter_id"):
            continue
        result[(str(row["chapter_id"]), int(row["verse"]))] = row
    return result


def sample_timing(chapter_id: str, verse_range: tuple[int, int], timings: dict[tuple[str, int], dict[str, Any]]) -> tuple[int, int]:
    start, end = verse_range
    first = timings[(chapter_id, start)]
    last = timings[(chapter_id, end)]
    return int(first["verse_start_ms"]), int(last["verse_end_ms"])


def load_subset_reference(path: Path) -> list[CanonicalVerse]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [CanonicalVerse(verse=int(item["verse"]), text=str(item["text"])) for item in payload["verses"]]


def model_source(model: str) -> str:
    config = model_config(model)
    if "local_cache_name" in config:
        local = Path("evaluation/speech_lab/model_cache") / str(config["local_cache_name"])
        if local.exists():
            return str(local)
    return str(config["model_id"])


def model_cached(model: str) -> bool:
    config = model_config(model)
    if "local_cache_name" in config and (Path("evaluation/speech_lab/model_cache") / str(config["local_cache_name"]) / "config.json").exists():
        return True
    return is_model_cached(str(config["model_id"]))


def model_config(model: str) -> dict[str, Any]:
    if model not in MODEL_CONFIGS:
        raise MiniValidationError(f"Unsupported mini-validation model: {model}")
    return MODEL_CONFIGS[model]


def transcript_matches(path: Path, model: str, sample: str) -> bool:
    payload = json.loads(path.read_text(encoding="utf-8"))
    metadata = payload.get("metadata", {})
    return metadata.get("model_key") == model and metadata.get("sample_id") == sample and metadata.get("reference_type") == "biblica_candidate"


def load_transcript(path: str | Path) -> Transcript:
    return Transcript.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


def _comparison_fields(row: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    sample_rows = [item for item in rows if item["sample"] == row["sample"]]
    medium = next((item for item in sample_rows if item["model"] == "medium_vad_tuned"), None)
    large = next((item for item in sample_rows if item["model"] == "large-v3"), None)
    if row["model"] == "large-v3" and medium:
        return {"wer_improvement_vs_medium": medium["wer"] - row["wer"], "cer_improvement_vs_medium": medium["cer"] - row["cer"]}
    if row["model"] == "large-v3-turbo" and large:
        return {"wer_delta_vs_large_v3": row["wer"] - large["wer"], "relative_wer_delta_vs_large_v3": (row["wer"] - large["wer"]) / large["wer"] if large["wer"] else None}
    return {}


def sample_id(chapter_id: str, verse_range: tuple[int, int]) -> str:
    return f"{chapter_id}_{verse_range[0]}_{verse_range[1]}"


def parse_range_from_sample(sample: str) -> tuple[int, int]:
    parts = sample.rsplit("_", 2)
    return int(parts[1]), int(parts[2])


def planned_outputs(chapters: list[str], verse_range: tuple[int, int], models: list[str], model_outputs_root: str | Path, output_dir: str | Path) -> dict[str, Any]:
    return {
        "reports": {
            "json": str(Path(output_dir) / "mini_validation_summary.json"),
            "csv": str(Path(output_dir) / "mini_validation_summary.csv"),
            "markdown": str(Path(output_dir) / "mini_validation_summary.md"),
        },
        "transcripts": [
            str(Path(model_outputs_root) / model_config(model)["output_slug"] / f"{sample_id(chapter, verse_range)}.json")
            for chapter in chapters
            for model in models
        ],
    }


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    index = 1
    while True:
        candidate = path.with_name(f"{path.stem}-{index}{path.suffix}")
        if not candidate.exists():
            return candidate
        index += 1


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = sorted({key for row in rows for key in row}) if rows else ["empty"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
