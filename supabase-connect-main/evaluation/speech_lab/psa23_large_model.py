from __future__ import annotations

import csv
import importlib
import json
import os
import shutil
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .comparison import load_transcripts
from .corpus import chapter_by_id
from .models import Transcript
from .providers.faster_whisper_provider import FasterWhisperProvider, default_compute_type, detect_device, is_model_cached, resolve_audio_path
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
    load_reference_sources,
    load_spoken_review_workbook,
    remove_introduction_words,
    score_text,
)
from .psa23_forensics import score_optimization_transcript
from .verse_alignment import align_transcript_to_verses


VAD_OPTIONS = {"vad_filter": True, "vad_parameters": {"min_silence_duration_ms": 500, "speech_pad_ms": 200}}
FREE_SPACE_MARGIN_BYTES = 1_500_000_000
MIN_AVAILABLE_MEMORY_BYTES = 2_000_000_000
BASELINE_WER = 0.4891304347826087
LOCAL_MODEL_CACHE_ROOT = Path("evaluation/speech_lab/model_cache")


@dataclass(frozen=True)
class LargeModelCandidate:
    name: str
    model_id: str
    model_label: str
    output_dir: Path
    estimated_download_bytes: int
    reusable_transcript: Path | None = None


CANDIDATES: dict[str, LargeModelCandidate] = {
    "medium_vad_tuned": LargeModelCandidate(
        name="medium_vad_tuned",
        model_id="Systran/faster-whisper-medium",
        model_label="Faster Whisper Medium VAD Tuned",
        output_dir=Path("evaluation/speech_lab/model_outputs/faster-whisper-medium-vad-tuned"),
        estimated_download_bytes=1_600_000_000,
        reusable_transcript=Path("evaluation/speech_lab/model_outputs/faster-whisper-medium-psa23-optimization/medium_vad_tuned.json"),
    ),
    "large-v3": LargeModelCandidate(
        name="large-v3",
        model_id="Systran/faster-whisper-large-v3",
        model_label="Faster Whisper Large-v3",
        output_dir=Path("evaluation/speech_lab/model_outputs/faster-whisper-large-v3-psa23"),
        estimated_download_bytes=3_200_000_000,
    ),
    "large-v3-turbo": LargeModelCandidate(
        name="large-v3-turbo",
        model_id="deepdml/faster-whisper-large-v3-turbo-ct2",
        model_label="Faster Whisper Large-v3 Turbo CT2",
        output_dir=Path("evaluation/speech_lab/model_outputs/faster-whisper-large-v3-turbo-psa23"),
        estimated_download_bytes=1_700_000_000,
    ),
}


class LargeModelComparisonError(RuntimeError):
    pass


def run_preflight(
    *,
    models: list[str],
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    device: str | None = None,
    compute_type: str | None = None,
    skip_download: bool = False,
    allow_download: bool = False,
    write_report: bool = True,
    overwrite: bool = False,
) -> dict[str, Any]:
    selected_device = device or detect_device()
    selected_compute = compute_type or default_compute_type(selected_device)
    free_disk = shutil.disk_usage(Path.cwd()).free
    available_memory = _available_memory()
    hf_cache = _hf_cache_dir()
    cache_size = _directory_size(hf_cache) if hf_cache.exists() else 0
    rows = []
    for name in models:
        candidate = candidate_by_name(name)
        cached = is_candidate_cached(candidate)
        estimated = 0 if cached else candidate.estimated_download_bytes
        remaining_after_download = free_disk - estimated
        has_model_access = cached or allow_download or candidate.reusable_transcript is not None
        safe_to_run = (
            has_model_access
            and remaining_after_download >= FREE_SPACE_MARGIN_BYTES
            and available_memory >= MIN_AVAILABLE_MEMORY_BYTES
            and _provider_supports_model(candidate.model_id)
        )
        rows.append(
            {
                "candidate": candidate.name,
                "model_id": candidate.model_id,
                "model_label": candidate.model_label,
                "cached": cached,
                "estimated_download_bytes": candidate.estimated_download_bytes,
                "required_download_bytes": estimated,
                "free_disk_bytes": free_disk,
                "remaining_after_download_bytes": remaining_after_download,
                "hf_cache_dir": str(hf_cache),
                "hf_cache_size_bytes": cache_size,
                "available_memory_bytes": available_memory,
                "device": selected_device,
                "compute_type": selected_compute,
                "allow_download": allow_download,
                "skip_download": skip_download,
                "safe_to_run": safe_to_run,
                "skip_reason": _skip_reason(
                    cached=cached,
                    allow_download=allow_download,
                    skip_download=skip_download,
                    candidate=candidate,
                    remaining_after_download=remaining_after_download,
                    available_memory=available_memory,
                    provider_supported=_provider_supports_model(candidate.model_id),
                ),
            }
        )
    payload = {"generated_at": _now(), "preflight": rows}
    if write_report:
        output = _unique_path(Path(output_dir) / "psa23_large_model_preflight.json", overwrite=overwrite)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        payload["report_path"] = str(output)
    return payload


def run_large_model_compare(
    *,
    spoken_workbook: str | Path = DEFAULT_WORKBOOK,
    models: list[str],
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    model_outputs_root: str | Path = DEFAULT_MODEL_OUTPUTS,
    audio: str | Path | None = None,
    device: str | None = None,
    compute_type: str | None = None,
    allow_download: bool = False,
    skip_download: bool = False,
    dry_run: bool = False,
    preflight_only: bool = False,
    overwrite: bool = False,
) -> dict[str, Any]:
    preflight = run_preflight(
        models=models,
        output_dir=output_dir,
        device=device,
        compute_type=compute_type,
        skip_download=skip_download,
        allow_download=allow_download,
        write_report=not dry_run,
        overwrite=overwrite,
    )
    audio_path = resolve_audio_path(CHAPTER_ID, audio)
    if dry_run or preflight_only:
        return {"dry_run": dry_run, "preflight_only": preflight_only, "audio": str(audio_path), "preflight": preflight}

    references = load_reference_sources(spoken_workbook, DEFAULT_BIBLICA)
    spoken_verses, intros, _validation = load_spoken_review_workbook(spoken_workbook)
    selected_device = device or detect_device()
    selected_compute = compute_type or default_compute_type(selected_device)
    rows: list[dict[str, Any]] = []
    verse_rows: list[dict[str, Any]] = []
    transcript_paths: dict[str, str] = {}
    preflight_by_name = {row["candidate"]: row for row in preflight["preflight"]}
    for name in models:
        candidate = candidate_by_name(name)
        pre = preflight_by_name[candidate.name]
        if pre["skip_reason"] and candidate.reusable_transcript is None:
            rows.append(_skipped_row(candidate, pre["skip_reason"]))
            continue
        transcript_path = ensure_candidate_transcript(
            candidate=candidate,
            audio_path=audio_path,
            device=selected_device,
            compute_type=selected_compute,
            allow_download=allow_download,
            skip_download=skip_download,
            overwrite=overwrite,
        )
        transcript_paths[candidate.name] = str(transcript_path)
        row, per_verse = score_candidate(candidate, transcript_path, references["human_spoken"], spoken_verses, intros, pre)
        rows.append(row)
        verse_rows.extend(per_verse)
    ranked = rank_rows(rows)
    outputs = write_large_model_reports(
        rows=ranked,
        verse_rows=verse_rows,
        preflight=preflight,
        transcript_paths=transcript_paths,
        output_dir=output_dir,
        overwrite=overwrite,
    )
    return {
        "preflight": preflight,
        "transcript_paths": transcript_paths,
        "ranking": ranked,
        "verse_rows": verse_rows,
        "outputs": {key: str(path) for key, path in outputs.items()},
    }


def ensure_candidate_transcript(
    *,
    candidate: LargeModelCandidate,
    audio_path: Path,
    device: str,
    compute_type: str,
    allow_download: bool,
    skip_download: bool,
    overwrite: bool,
) -> Path:
    if candidate.reusable_transcript is not None:
        if not candidate.reusable_transcript.exists():
            raise LargeModelComparisonError(f"Reusable baseline transcript missing: {candidate.reusable_transcript}")
        if not transcript_metadata_matches(candidate.reusable_transcript, candidate):
            raise LargeModelComparisonError(f"Reusable transcript metadata does not match requested candidate: {candidate.reusable_transcript}")
        return candidate.reusable_transcript
    existing = candidate.output_dir / f"{CHAPTER_ID}.json"
    if existing.exists() and transcript_metadata_matches(existing, candidate):
        return existing
    cached = is_candidate_cached(candidate)
    if not cached and (skip_download or not allow_download):
        raise LargeModelComparisonError(f"Model is not cached and download is not allowed: {candidate.model_id}")
    model_source = candidate.model_id
    if not cached and allow_download:
        model_source = str(download_candidate_to_local_cache(candidate))
    elif local_candidate_cache_dir(candidate).exists():
        model_source = str(local_candidate_cache_dir(candidate))
    output = _unique_path(candidate.output_dir / f"{CHAPTER_ID}.json", overwrite=overwrite)
    output.parent.mkdir(parents=True, exist_ok=True)
    provider = FasterWhisperProvider(
        model_name=model_source,
        device=device,
        compute_type=compute_type,
        language="sw",
        transcription_options=VAD_OPTIONS,
    )
    transcript = provider.transcribe(chapter_by_id(CHAPTER_ID), audio_path)
    metadata = dict(transcript.metadata)
    metadata.update(
        {
            "candidate": candidate.name,
            "model_id": candidate.model_id,
            "model_label": candidate.model_label,
            "effective_transcription_options": VAD_OPTIONS,
            "generated_at": _now(),
            "word_timestamps": True,
            "cache_metadata": {
                "cached_before_run": cached,
                "model_source": model_source,
                "local_cache_dir": str(local_candidate_cache_dir(candidate)),
            },
        }
    )
    transcript.metadata = metadata
    output.write_text(json.dumps(transcript.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


def transcript_metadata_matches(path: str | Path, candidate: LargeModelCandidate) -> bool:
    transcript = load_transcripts(path)[0]
    metadata = transcript.metadata
    if candidate.name == "medium_vad_tuned":
        return (
            metadata.get("resolved_model_name") == candidate.model_id
            and metadata.get("language") == "sw"
            and metadata.get("transcription_options") == VAD_OPTIONS
            and metadata.get("optimization_config") == "medium_vad_tuned"
        )
    return metadata.get("model_id") == candidate.model_id and metadata.get("effective_transcription_options") == VAD_OPTIONS


def score_candidate(
    candidate: LargeModelCandidate,
    transcript_path: str | Path,
    human_reference: ReferenceSource,
    spoken_verses: list[SpokenVerse],
    introductions: list[SpokenIntroduction],
    preflight_row: dict[str, Any],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    raw = load_transcripts(transcript_path)[0]
    cleaned = remove_introduction_words(raw, introductions)
    aligned = align_transcript_to_verses(cleaned, human_reference.verses)
    clean_score = score_text(human_reference.text, cleaned.text)
    raw_score = score_text(human_reference.text, raw.text)
    aligned_statuses = {"aligned", "recovered_between_neighbors"}
    unresolved = [verse.verse for verse in aligned.verses if verse.status not in aligned_statuses]
    coverage_values = [
        verse.matched_tokens / verse.reference_tokens
        for verse in aligned.verses
        if verse.reference_tokens and verse.status in aligned_statuses
    ]
    high_conf = [value for value in coverage_values if value >= 0.5]
    duration = raw.metadata.get("duration_seconds")
    runtime = raw.metadata.get("transcription_runtime_seconds") or raw.metadata.get("runtime_seconds") or 0
    per_verse = []
    for verse in EXPECTED_VERSES:
        assigned = " ".join(word.word for word in aligned.words if word.verse == verse)
        ref = next(item.text for item in human_reference.verses if item.verse == verse)
        score = score_text(ref, assigned)
        candidate_verse = next(item for item in aligned.verses if item.verse == verse)
        timing = next(item for item in spoken_verses if item.verse == verse)
        per_verse.append(
            {
                "candidate": candidate.name,
                "verse": verse,
                "reference_text": ref,
                "assigned_asr_text": assigned,
                "wer": score["wer"],
                "cer": score["cer"],
                "insertions": score["insertions"],
                "deletions": score["deletions"],
                "substitutions": score["substitutions"],
                "alignment_status": candidate_verse.status,
                "confidence": candidate_verse.alignment_score,
                "predicted_start_ms": candidate_verse.start_ms,
                "predicted_end_ms": candidate_verse.end_ms,
                "human_start_ms": timing.verse_start_ms,
                "human_end_ms": timing.verse_end_ms,
                "start_drift_ms": None if candidate_verse.start_ms is None else candidate_verse.start_ms - timing.verse_start_ms,
                "end_drift_ms": None if candidate_verse.end_ms is None else candidate_verse.end_ms - timing.verse_end_ms,
            }
        )
    row = {
        "candidate": candidate.name,
        "model_id": candidate.model_id,
        "model_label": candidate.model_label,
        "transcript_path": str(transcript_path),
        "cleaned_wer": clean_score["wer"],
        "raw_wer": raw_score["wer"],
        "cer": clean_score["cer"],
        "insertions": clean_score["insertions"],
        "deletions": clean_score["deletions"],
        "substitutions": clean_score["substitutions"],
        "reference_word_count": clean_score["reference_word_count"],
        "hypothesis_word_count": clean_score["hypothesis_word_count"],
        "verse_resolution_rate": (len(aligned.verses) - len(unresolved)) / len(aligned.verses),
        "token_alignment_coverage": sum(coverage_values) / len(coverage_values) if coverage_values else 0.0,
        "high_confidence_alignment_rate": len(high_conf) / len(coverage_values) if coverage_values else 0.0,
        "unresolved_verse_count": len(unresolved),
        "missing_verse_count": len([verse for verse in EXPECTED_VERSES if verse not in {boundary.verse for boundary in aligned.verse_boundaries}]),
        "duplicated_verse_count": _duplicated_verse_count(aligned),
        "runtime_seconds": runtime,
        "real_time_factor": (runtime / duration) if duration else None,
        "model_cache_size_bytes": preflight_row.get("hf_cache_size_bytes"),
        "available_memory_bytes": preflight_row.get("available_memory_bytes"),
        "device": preflight_row.get("device"),
        "compute_type": preflight_row.get("compute_type"),
        "absolute_wer_improvement_vs_medium_vad_tuned": BASELINE_WER - clean_score["wer"],
        "relative_wer_improvement_vs_medium_vad_tuned": (BASELINE_WER - clean_score["wer"]) / BASELINE_WER,
        "decision_classification": classify_decision(clean_score["wer"]),
        "resource_cost_justified": resource_cost_justified(clean_score["wer"]),
    }
    return row, per_verse


def rank_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    measurable = [row for row in rows if "cleaned_wer" in row]
    skipped = [row for row in rows if "cleaned_wer" not in row]
    ranked = sorted(
        measurable,
        key=lambda row: (
            row["cleaned_wer"],
            row["cer"],
            -row["verse_resolution_rate"],
            -row["token_alignment_coverage"],
            row["runtime_seconds"],
        ),
    )
    for index, row in enumerate(ranked, start=1):
        row["rank"] = index
    return ranked + skipped


def classify_decision(cleaned_wer: float) -> str:
    rel = (BASELINE_WER - cleaned_wer) / BASELINE_WER
    if cleaned_wer < 0.35 or rel >= 0.25:
        return "substantial_improvement"
    if rel >= 0.10:
        return "moderate_improvement"
    if rel > 0:
        return "marginal_improvement"
    return "no_improvement"


def resource_cost_justified(cleaned_wer: float) -> str:
    decision = classify_decision(cleaned_wer)
    if decision == "substantial_improvement":
        return "research_yes_production_validate"
    if decision == "moderate_improvement":
        return "research_validate"
    return "keep_medium_vad_tuned"


def write_large_model_reports(
    *,
    rows: list[dict[str, Any]],
    verse_rows: list[dict[str, Any]],
    preflight: dict[str, Any],
    transcript_paths: dict[str, str],
    output_dir: str | Path,
    overwrite: bool,
) -> dict[str, Path]:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    json_path = _unique_path(out / "psa23_large_model_comparison.json", overwrite=overwrite)
    csv_path = json_path.with_suffix(".csv")
    md_path = json_path.with_suffix(".md")
    verse_csv = _unique_path(out / "psa23_large_model_verse_comparison.csv", overwrite=overwrite)
    payload = {"preflight": preflight, "transcript_paths": transcript_paths, "ranking": rows, "verse_rows": verse_rows}
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _write_csv(csv_path, rows)
    _write_csv(verse_csv, verse_rows)
    md_path.write_text(_large_model_markdown(rows, verse_rows, preflight), encoding="utf-8")
    return {"json": json_path, "csv": csv_path, "markdown": md_path, "verse_csv": verse_csv}


def candidate_by_name(name: str) -> LargeModelCandidate:
    key = name.replace("_", "-")
    aliases = {"large_v3": "large-v3", "large_v3_turbo": "large-v3-turbo", "medium-vad-tuned": "medium_vad_tuned"}
    normalized = aliases.get(name, aliases.get(key, name))
    if normalized not in CANDIDATES:
        raise LargeModelComparisonError(f"Unsupported PSA_023 large-model candidate: {name}")
    return CANDIDATES[normalized]


def is_candidate_cached(candidate: LargeModelCandidate) -> bool:
    if candidate.reusable_transcript is not None and candidate.reusable_transcript.exists():
        return True
    local_dir = local_candidate_cache_dir(candidate)
    if (local_dir / "config.json").exists():
        return True
    return is_model_cached(candidate.model_id)


def local_candidate_cache_dir(candidate: LargeModelCandidate) -> Path:
    safe = candidate.name.replace("_", "-")
    return LOCAL_MODEL_CACHE_ROOT / safe


def download_candidate_to_local_cache(candidate: LargeModelCandidate) -> Path:
    target = local_candidate_cache_dir(candidate)
    target.mkdir(parents=True, exist_ok=True)
    try:
        huggingface_hub = importlib.import_module("huggingface_hub")
    except ImportError as exc:
        raise LargeModelComparisonError("huggingface_hub is required to download missing models") from exc
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    kwargs = {
        "repo_id": candidate.model_id,
        "local_dir": str(target),
    }
    try:
        huggingface_hub.snapshot_download(local_dir_use_symlinks=False, **kwargs)
    except TypeError:
        huggingface_hub.snapshot_download(**kwargs)
    if not (target / "config.json").exists():
        raise LargeModelComparisonError(f"Model download did not produce config.json: {target}")
    return target


def _skipped_row(candidate: LargeModelCandidate, reason: str) -> dict[str, Any]:
    return {"candidate": candidate.name, "model_id": candidate.model_id, "skipped": True, "skip_reason": reason}


def _skip_reason(
    *,
    cached: bool,
    allow_download: bool,
    skip_download: bool,
    candidate: LargeModelCandidate,
    remaining_after_download: int,
    available_memory: int,
    provider_supported: bool,
) -> str:
    if candidate.reusable_transcript is not None:
        return ""
    if not provider_supported:
        return "provider_identifier_not_supported"
    if not cached and skip_download:
        return "model_not_cached_skip_download"
    if not cached and not allow_download:
        return "model_not_cached_download_not_allowed"
    if remaining_after_download < FREE_SPACE_MARGIN_BYTES:
        return "insufficient_free_disk_after_estimated_download"
    if available_memory < MIN_AVAILABLE_MEMORY_BYTES:
        return "available_memory_below_safe_threshold"
    return ""


def _provider_supports_model(model_id: str) -> bool:
    return bool(model_id)


def _available_memory() -> int:
    try:
        psutil = importlib.import_module("psutil")
        return int(psutil.virtual_memory().available)
    except Exception:
        pass
    try:
        import ctypes

        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]

        status = MEMORYSTATUSEX()
        status.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            return int(status.ullAvailPhys)
    except Exception:
        return 0
    return 0


def _hf_cache_dir() -> Path:
    import os

    return Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))


def _directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for item in path.rglob("*"):
        try:
            if item.is_file():
                total += item.stat().st_size
        except OSError:
            continue
    return total


def _duplicated_verse_count(transcript: Transcript) -> int:
    seen = set()
    duplicated = set()
    for boundary in transcript.verse_boundaries:
        if boundary.verse in seen:
            duplicated.add(boundary.verse)
        seen.add(boundary.verse)
    return len(duplicated)


def _large_model_markdown(rows: list[dict[str, Any]], verse_rows: list[dict[str, Any]], preflight: dict[str, Any]) -> str:
    lines = [
        "# PSA_023 Large Model Comparison",
        "",
        "| Rank | Candidate | WER | Raw WER | CER | Rel Improvement | Runtime | Coverage | Decision |",
        "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for row in rows:
        if row.get("skipped"):
            lines.append(f"| - | {row['candidate']} | - | - | - | - | - | - | skipped: {row['skip_reason']} |")
            continue
        lines.append(
            f"| {row['rank']} | {row['candidate']} | {row['cleaned_wer']:.4f} | {row['raw_wer']:.4f} | "
            f"{row['cer']:.4f} | {row['relative_wer_improvement_vs_medium_vad_tuned']:.4f} | "
            f"{float(row['runtime_seconds']):.2f} | {row['token_alignment_coverage']:.4f} | {row['decision_classification']} |"
        )
    problem = [row for row in verse_rows if int(row["verse"]) in {3, 5, 6}]
    lines.extend(["", "## Problem Verses", ""])
    lines.append("| Candidate | Verse | WER | CER | Ins | Del | Sub | Status |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    for row in problem:
        lines.append(
            f"| {row['candidate']} | {row['verse']} | {row['wer']:.4f} | {row['cer']:.4f} | "
            f"{row['insertions']} | {row['deletions']} | {row['substitutions']} | {row['alignment_status']} |"
        )
    below = [row for row in rows if not row.get("skipped") and row["cleaned_wer"] < 0.35]
    best = next((row for row in rows if not row.get("skipped")), None)
    lines.extend(
        [
            "",
            "## Answers",
            "",
            f"- WER below 0.35 achieved: {'yes' if below else 'no'}.",
            f"- Best measured candidate: `{best['candidate']}`." if best else "- No measured candidate completed.",
            "- Ranking uses cleaned exact-spoken WER, then CER, verse resolution, coverage, and runtime.",
            "- Production recommendation requires more than a tiny single-chapter gain.",
        ]
    )
    return "\n".join(lines) + "\n"


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = sorted({key for row in rows for key in row}) if rows else ["empty"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _unique_path(path: Path, *, overwrite: bool) -> Path:
    if overwrite or not path.exists():
        return path
    index = 1
    while True:
        candidate = path.with_name(f"{path.stem}-{index}{path.suffix}")
        if not candidate.exists():
            return candidate
        index += 1


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
