"""Quality-assurance reporting helpers for the audio pipeline."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

from .config import CONFIG
from .filesystem import ensure_directory, read_json, slug, write_json
from .models import ChapterStatistics, PipelineContext, VerseIndex, VerseTiming


def compute_chapter_statistics(
    context: PipelineContext,
    issues: list[str] | None = None,
) -> ChapterStatistics:
    """Compute chapter-level QA statistics from the current context."""

    if context.verse_index is None:
        raise ValueError("Cannot compute statistics without a verse index")

    verses = context.verse_index.verses
    confidences = [verse.confidence for verse in verses]
    missing = missing_verse_numbers(verses)
    overlapping = overlapping_verse_ids(verses)
    low_confidence = [
        verse.verse_id
        for verse in verses
        if verse.confidence < CONFIG.qa_minimum_confidence
    ]
    warning_confidence = [
        verse.verse_id
        for verse in verses
        if CONFIG.qa_minimum_confidence <= verse.confidence < CONFIG.qa_warning_confidence
    ]
    structural_issues = len(missing) + len(overlapping)
    alignment_errors = structural_issues + len(low_confidence)
    status = "PASS"
    if issues or alignment_errors:
        status = "FAIL"
    elif warning_confidence:
        status = "WARN"

    return ChapterStatistics(
        book=context.book,
        chapter=context.chapter,
        audio_duration=context.metadata.duration_seconds if context.metadata else 0.0,
        processing_duration=context.processing_time_seconds or 0.0,
        verse_count=len(verses),
        word_count=sum(verse.word_count for verse in verses),
        average_confidence=_average(confidences),
        minimum_confidence=min(confidences) if confidences else 0.0,
        maximum_confidence=max(confidences) if confidences else 0.0,
        missing_verses=len(missing),
        overlapping_verses=len(overlapping),
        alignment_errors=alignment_errors,
        status=status,
    )


def missing_verse_numbers(verses: list[VerseTiming]) -> list[int]:
    """Return missing verse numbers in a sequential verse index."""

    numbers = [_verse_number(verse) for verse in verses]
    numbers = sorted(number for number in numbers if number is not None)
    if not numbers:
        return []
    expected = set(range(1, max(numbers) + 1))
    return sorted(expected.difference(numbers))


def overlapping_verse_ids(verses: list[VerseTiming]) -> list[str]:
    """Return verse ids whose timings overlap the prior verse."""

    overlaps: list[str] = []
    previous_end = -1.0
    for verse in sorted(verses, key=lambda item: item.start_seconds):
        if verse.start_seconds < previous_end:
            overlaps.append(verse.verse_id)
        previous_end = max(previous_end, verse.end_seconds)
    return overlaps


def overlap_details(verses: list[VerseTiming]) -> list[dict[str, Any]]:
    """Return detailed adjacent overlap diagnostics."""

    details: list[dict[str, Any]] = []
    for previous, verse in zip(verses, verses[1:]):
        if previous.end_seconds > verse.start_seconds:
            details.append(
                {
                    "current_verse": previous.verse_id,
                    "current_end": round(previous.end_seconds, 6),
                    "next_verse": verse.verse_id,
                    "next_start": round(verse.start_seconds, 6),
                    "overlap_seconds": round(previous.end_seconds - verse.start_seconds, 6),
                }
            )
    return details


def write_summary_report(context: PipelineContext, issues: list[str]) -> Path:
    """Write ``reports/summary/{book}_{chapter}.json``."""

    stats = compute_chapter_statistics(context, issues)
    path = CONFIG.reports_dir / "summary" / f"{slug(context.book)}_{context.chapter}.json"
    payload = stats.to_dict()
    payload.update(
        {
            "missing_verse_numbers": missing_verse_numbers(context.verse_index.verses)
            if context.verse_index
            else [],
            "overlapping_verse_ids": overlapping_verse_ids(context.verse_index.verses)
            if context.verse_index
            else [],
            "overlap_details": overlap_details(context.verse_index.verses)
            if context.verse_index
            else [],
            "verse_boundary_qa": _verse_boundary_qa(context.verse_index)
            if context.verse_index
            else [],
            "issues": issues,
            "generated": datetime.now(timezone.utc).isoformat(),
        }
    )
    write_json(path, payload)
    context.report["summary"] = str(path)
    return path


def write_hash_report(context: PipelineContext) -> Path:
    """Write SHA256 hashes for the chapter's pipeline artifacts."""

    path = CONFIG.reports_dir / "hashes" / f"{slug(context.book)}_{context.chapter}.json"
    payload = {
        "audio": sha256_file(context.audio_path),
        "transcript": sha256_file(
            context.transcription.transcript_path if context.transcription else None
        ),
        "alignment": sha256_file(
            context.alignment.alignment_path if context.alignment else None
        ),
        "index": sha256_file(context.verse_index.index_path if context.verse_index else None),
        "generated": datetime.now(timezone.utc).isoformat(),
    }
    write_json(path, payload)
    context.report["hashes"] = str(path)
    return path


def sha256_file(path: Path | None) -> str | None:
    """Return a file's SHA256 hash or ``None`` when absent."""

    if path is None or not path.exists():
        return None
    hasher = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def write_html_report(context: PipelineContext, issues: list[str]) -> Path:
    """Write ``reports/html/{book}_{chapter}.html`` with rich QA details."""

    if context.verse_index is None:
        raise ValueError("Cannot write HTML report without a verse index")
    stats = compute_chapter_statistics(context, issues)
    path = CONFIG.reports_dir / "html" / f"{slug(context.book)}_{context.chapter}.html"
    ensure_directory(path.parent)
    path.write_text(_render_html(context, stats, issues), encoding="utf-8")
    context.report["html"] = str(path)
    return path


def write_dashboard() -> Path:
    """Aggregate summary reports into ``reports/dashboard.json``."""

    summary_dir = CONFIG.reports_dir / "summary"
    summaries = []
    if summary_dir.exists():
        for path in summary_dir.glob("*.json"):
            summaries.append(read_json(path))

    total_processing = sum(float(item.get("processing_duration", 0.0)) for item in summaries)
    confidences = [
        float(item.get("average_confidence", 0.0))
        for item in summaries
        if item.get("average_confidence") is not None
    ]
    books = {str(item.get("book")) for item in summaries if item.get("book")}
    payload = {
        "books_processed": len(books),
        "chapters_processed": len(summaries),
        "chapters_failed": sum(1 for item in summaries if item.get("status") == "FAIL"),
        "total_processing_time": round(total_processing, 3),
        "average_confidence": round(_average(confidences), 6),
        "generated": datetime.now(timezone.utc).isoformat(),
    }
    path = CONFIG.reports_dir / "dashboard.json"
    write_json(path, payload)
    return path


def verify_hash_report(hash_path: Path) -> list[str]:
    """Verify one hash report against its referenced chapter artifacts."""

    issues: list[str] = []
    if not hash_path.exists():
        return [f"Missing hash report: {hash_path}"]
    hashes = read_json(hash_path)
    manifest_path = _manifest_for_hash_report(hash_path)
    manifest = read_json(manifest_path) if manifest_path.exists() else {}
    paths = _artifact_paths_from_manifest(manifest)
    for key, artifact_path in paths.items():
        expected = hashes.get(key)
        actual = sha256_file(artifact_path)
        if artifact_path is None or not artifact_path.exists():
            issues.append(f"Missing {key} artifact for {hash_path.stem}")
        elif expected != actual:
            issues.append(f"Hash mismatch for {key}: {artifact_path}")
    return issues


def _artifact_paths_from_manifest(manifest: dict[str, Any]) -> dict[str, Path | None]:
    """Return expected artifact paths for a manifest."""

    book = str(manifest.get("book", "")).replace(" ", "_")
    chapter = manifest.get("chapter")
    audio = manifest.get("audio_path")
    if not book or chapter is None:
        return {"audio": Path(str(audio)) if audio else None}
    audio_path = Path(str(audio)) if audio else None
    return {
        "audio": audio_path,
        "transcript": (
            CONFIG.transcripts_dir / f"{audio_path.stem}.transcript.json"
            if audio_path
            else None
        ),
        "alignment": CONFIG.alignments_dir / book / f"{chapter}.json",
        "index": CONFIG.indexes_dir / book / f"{chapter}.json",
    }


def _manifest_for_hash_report(hash_path: Path) -> Path:
    """Return the manifest path matching a hash-report filename."""

    return CONFIG.reports_dir / "manifests" / hash_path.name


def _render_html(
    context: PipelineContext,
    stats: ChapterStatistics,
    issues: list[str],
) -> str:
    """Render a plain HTML + CSS QA report."""

    verses = context.verse_index.verses if context.verse_index else []
    flagged = [
        verse
        for verse in verses
        if CONFIG.qa_flag_low_confidence
        and verse.confidence < CONFIG.qa_warning_confidence
    ]
    missing = missing_verse_numbers(verses)
    overlaps = overlapping_verse_ids(verses)
    rows = "\n".join(_verse_row(verse, overlaps) for verse in verses)
    bars = "\n".join(_confidence_bar(verse) for verse in verses)
    flagged_items = _items(
        [
            f"Verse {verse.verse_id}: confidence {verse.confidence:.3f}"
            for verse in flagged
        ],
        "No low-confidence verses.",
    )
    missing_items = _items([f"Verse {number}" for number in missing], "No missing verses.")
    overlap_items = _items(_format_overlap_details(verses), "No overlaps.")
    issue_items = _items(issues, "No validation issues.")
    boundary_items = _items(_format_boundary_qa(context.verse_index), "No verse boundary issues.")
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{escape(context.book)} {context.chapter} QA Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 32px; color: #1f2933; }}
    table {{ border-collapse: collapse; width: 100%; margin: 16px 0; }}
    th, td {{ border: 1px solid #d7dde5; padding: 8px; text-align: left; }}
    th {{ background: #edf2f7; }}
    .status {{ font-weight: 700; }}
    .bar {{ background: #e5e7eb; height: 14px; margin: 6px 0; }}
    .fill {{ background: #2f855a; height: 14px; }}
    .warn .fill {{ background: #b7791f; }}
    .fail .fill {{ background: #c53030; }}
    .flag {{ color: #9b2c2c; font-weight: 700; }}
    .section {{ margin-top: 28px; }}
  </style>
</head>
<body>
  <h1>{escape(context.book)} {context.chapter} QA Report</h1>
  <p class="status">Status: {escape(stats.status)}</p>
  <div class="section">
    <h2>Summary</h2>
    <table>
      <tr><th>Audio duration</th><td>{stats.audio_duration:.2f}s</td></tr>
      <tr><th>Processing duration</th><td>{stats.processing_duration:.2f}s</td></tr>
      <tr><th>Verses</th><td>{stats.verse_count}</td></tr>
      <tr><th>Words</th><td>{stats.word_count}</td></tr>
      <tr><th>Average confidence</th><td>{stats.average_confidence:.3f}</td></tr>
      <tr><th>Minimum confidence</th><td>{stats.minimum_confidence:.3f}</td></tr>
      <tr><th>Maximum confidence</th><td>{stats.maximum_confidence:.3f}</td></tr>
      <tr><th>Missing verses</th><td>{stats.missing_verses}</td></tr>
      <tr><th>Overlapping verses</th><td>{stats.overlapping_verses}</td></tr>
      <tr><th>Alignment errors</th><td>{stats.alignment_errors}</td></tr>
    </table>
  </div>
  <div class="section">
    <h2>Confidence Graph</h2>
    {bars}
  </div>
  <div class="section">
    <h2>Verse Statistics</h2>
    <table>
      <tr><th>Verse</th><th>Start</th><th>End</th><th>Duration</th><th>Words</th><th>Confidence</th><th>Text</th></tr>
      {rows}
    </table>
  </div>
  <div class="section"><h2>Flagged Verses</h2><ul>{flagged_items}</ul></div>
  <div class="section"><h2>Missing Verses</h2><ul>{missing_items}</ul></div>
  <div class="section"><h2>Overlap Warnings</h2><ul>{overlap_items}</ul></div>
  <div class="section"><h2>Verse Boundary QA</h2><ul>{boundary_items}</ul></div>
  <div class="section"><h2>Validation Issues</h2><ul>{issue_items}</ul></div>
  <div class="section">
    <h2>Processing Information</h2>
    <table>
      <tr><th>Audio</th><td>{escape(str(context.audio_path))}</td></tr>
      <tr><th>Transcript</th><td>{escape(str(context.transcription.transcript_path if context.transcription else ""))}</td></tr>
      <tr><th>Alignment</th><td>{escape(str(context.alignment.alignment_path if context.alignment else ""))}</td></tr>
      <tr><th>Index</th><td>{escape(str(context.verse_index.index_path if context.verse_index else ""))}</td></tr>
    </table>
  </div>
</body>
</html>
"""


def _verse_row(verse: VerseTiming, overlaps: list[str]) -> str:
    """Render one verse statistics table row."""

    css_class = "flag" if verse.verse_id in overlaps or verse.confidence < CONFIG.qa_warning_confidence else ""
    return (
        f"<tr class=\"{css_class}\"><td>{escape(verse.verse_id)}</td>"
        f"<td>{verse.start_seconds:.2f}</td><td>{verse.end_seconds:.2f}</td>"
        f"<td>{verse.duration:.2f}</td><td>{verse.word_count}</td>"
        f"<td>{verse.confidence:.3f}</td><td>{escape(verse.text)}</td></tr>"
    )


def _confidence_bar(verse: VerseTiming) -> str:
    """Render one confidence graph row."""

    percent = max(0.0, min(100.0, verse.confidence * 100))
    css_class = "fail" if verse.confidence < CONFIG.qa_minimum_confidence else "warn" if verse.confidence < CONFIG.qa_warning_confidence else ""
    return (
        f"<div class=\"{css_class}\">Verse {escape(verse.verse_id)} "
        f"({verse.confidence:.3f})<div class=\"bar\"><div class=\"fill\" "
        f"style=\"width: {percent:.1f}%\"></div></div></div>"
    )


def _items(items: list[str], empty: str) -> str:
    """Render list items for HTML reports."""

    values = items or [empty]
    return "".join(f"<li>{escape(str(item))}</li>" for item in values)


def _verse_boundary_qa(index: VerseIndex) -> list[dict[str, Any]]:
    qa_items = index.metadata.get("verse_boundary_qa", [])
    if not isinstance(qa_items, list):
        return []
    return [item for item in qa_items if isinstance(item, dict)]


def _format_boundary_qa(index: VerseIndex | None) -> list[str]:
    if index is None:
        return []
    items = []
    for item in _verse_boundary_qa(index):
        items.append(
            "Verse {verse}: {reason}; expected '{expected}', closest '{closest}', similarity {score}".format(
                verse=item.get("verse_number", ""),
                reason=item.get("reason", ""),
                expected=item.get("expected_opening_text", ""),
                closest=item.get("closest_aligned_text", ""),
                score=item.get("similarity_score", ""),
            )
        )
    return items


def _format_overlap_details(verses: list[VerseTiming]) -> list[str]:
    return [
        (
            f"Verse {item['current_verse']} end = {item['current_end']}; "
            f"Verse {item['next_verse']} start = {item['next_start']}; "
            f"Overlap = {item['overlap_seconds']} seconds"
        )
        for item in overlap_details(verses)
    ]


def _average(values: list[float]) -> float:
    """Return the arithmetic mean with a safe empty default."""

    return round(sum(values) / len(values), 6) if values else 0.0


def _verse_number(verse: VerseTiming) -> int | None:
    """Return an integer verse id when possible."""

    try:
        return int(verse.verse_id)
    except ValueError:
        return None
