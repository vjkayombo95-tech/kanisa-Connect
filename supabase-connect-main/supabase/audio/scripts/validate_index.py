"""Validate verse index artifacts before import."""

from __future__ import annotations

import argparse
from pathlib import Path

from build_index import build_verse_index
from lib.exceptions import AudioPipelineError, IndexValidationError
from lib.logger import get_logger, log_stage, now_seconds
from lib.manifest import write_manifest
from lib.models import PipelineContext, VerseIndex
from lib.qa import (
    write_dashboard,
    write_hash_report,
    write_html_report,
    write_summary_report,
)
from transcribe import transcribe_audio
from align import align_transcription

LOGGER = get_logger("validate_index")


def validate_index(index: VerseIndex) -> VerseIndex:
    """Validate verse-index completeness and timing consistency."""

    LOGGER.info("Starting index validation for %s", index.index_path)

    try:
        issues = _index_issues(index)
        if issues:
            raise IndexValidationError("; ".join(issues))
    except IndexValidationError:
        raise
    except Exception as exc:
        raise IndexValidationError(
            f"Index validation failed for {index.index_path}: {exc}"
        ) from exc

    LOGGER.info("Index validation passed: %s", index.index_path)
    return index


def validate_index_stage(
    context: PipelineContext,
    dry_run: bool = False,
) -> PipelineContext:
    """Validate the verse index for a pipeline context."""

    started = now_seconds()
    log_stage(LOGGER, context, "VALIDATE_INDEX", "Starting index validation")
    if dry_run:
        context.status = "index_validated"
        log_stage(
            LOGGER,
            context,
            "VALIDATE_INDEX",
            "Dry run skipped index validation",
            0.0,
        )
        return context
    if context.verse_index is None:
        raise IndexValidationError("Cannot validate without a verse index")

    issues = _index_issues(context.verse_index)
    _write_validation_reports(context, issues)
    if issues:
        raise IndexValidationError("; ".join(issues))
    context.status = "index_validated"
    write_manifest(context)
    log_stage(
        LOGGER,
        context,
        "VALIDATE_INDEX",
        "Index validation completed",
        now_seconds() - started,
    )
    return context


def main() -> int:
    """CLI entry point for index validation."""

    parser = argparse.ArgumentParser(description="Validate a verse index.")
    parser.add_argument("path", help="Path to the audio file.")
    args = parser.parse_args()

    try:
        transcription = transcribe_audio(Path(args.path))
        alignment = align_transcription(transcription)
        index = build_verse_index(alignment)
        validate_index(index)
    except AudioPipelineError as exc:
        LOGGER.error("Index validation stage failed: %s", exc)
        print(f"ERROR: {exc}")
        return 1
    except Exception as exc:
        LOGGER.exception("Unexpected index validation stage failure: %s", exc)
        print(f"ERROR: {exc}")
        return 1

    print(f"Validated index: {index.index_path}")
    return 0


def _index_issues(index: VerseIndex) -> list[str]:
    """Return validation issues for a verse index."""

    issues: list[str] = []
    if not index.index_path.exists():
        issues.append(f"Index artifact does not exist: {index.index_path}")
    if not index.verses:
        issues.append("Index does not contain any verse timings")
        return issues

    expected = 1
    previous: object | None = None
    for verse in index.verses:
        if not verse.verse_id:
            issues.append("Verse timing is missing verse_id")
            continue
        try:
            verse_number = int(verse.verse_id)
        except ValueError:
            issues.append(f"Verse id is not numeric: {verse.verse_id}")
            continue
        if verse_number != expected:
            issues.append(f"Missing verse {expected}; found verse {verse_number}")
            expected = verse_number
        if verse.start_seconds is None or verse.end_seconds is None:
            issues.append(f"Verse {verse_number} is missing start/end")
        elif verse.start_seconds < 0 or verse.end_seconds < 0:
            issues.append(f"Negative timing for verse {verse_number}")
        elif verse.end_seconds <= verse.start_seconds:
            issues.append(f"End must be after start for verse {verse_number}")
        elif previous is not None and verse.start_seconds < previous.end_seconds:
            issues.append(_format_overlap_issue(previous, verse))
        previous = verse
        expected += 1
    return issues


def _format_overlap_issue(previous: object, verse: object) -> str:
    overlap = previous.end_seconds - verse.start_seconds
    return (
        f"Verse {previous.verse_id}\n"
        f"end = {previous.end_seconds:.6f}\n"
        f"Verse {verse.verse_id}\n"
        f"start = {verse.start_seconds:.6f}\n"
        f"Overlap = {overlap:.6f} seconds"
    )


def _write_validation_reports(
    context: PipelineContext,
    issues: list[str],
) -> None:
    """Write all QA reports for a chapter index."""

    if context.verse_index is None:
        raise IndexValidationError("Cannot report without a verse index")

    summary_path = write_summary_report(context, issues)
    html_path = write_html_report(context, issues)
    hash_path = write_hash_report(context)
    dashboard_path = write_dashboard()
    context.report["index_validation"] = {
        "json": str(summary_path),
        "html": str(html_path),
        "hashes": str(hash_path),
        "dashboard": str(dashboard_path),
        "status": "failed" if issues else "passed",
    }


if __name__ == "__main__":
    raise SystemExit(main())
