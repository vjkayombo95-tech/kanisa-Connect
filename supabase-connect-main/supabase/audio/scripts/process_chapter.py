"""Orchestrate the full chapter audio processing pipeline."""

from __future__ import annotations

import argparse
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Generic, TypeVar

from align import align_stage
from build_index import build_index_stage
from import_index import import_index_stage
from lib.config import CONFIG
from lib.exceptions import AudioPipelineError, AudioValidationError
from lib.filesystem import artifact_path, read_json
from lib.logger import get_logger, log_stage, now_seconds
from lib.manifest import load_manifest, write_manifest
from lib.models import (
    AlignmentResult,
    AudioMetadata,
    PipelineContext,
    TranscriptionResult,
    VerseIndex,
    VerseTiming,
)
from providers.audio_provider import get_audio_provider
from lib.retry import retry_transient
from lib.state import update_pipeline_state
from transcribe import transcribe_stage
from validate_audio import validate_audio_stage
from validate_index import validate_index, validate_index_stage
from providers.text_provider import validate_configured_text_provider

LOGGER = get_logger("process_chapter")
T = TypeVar("T")


@dataclass(frozen=True)
class Stage(Generic[T]):
    """Isolated pipeline stage wrapper."""

    name: str
    action: Callable[[PipelineContext], PipelineContext]
    transient: bool = False


def process_chapter(
    path: str | Path | None = None,
    *,
    book: str,
    chapter: int,
    content_type: str = "bible",
    language: str | None = None,
    force: bool = False,
    resume: bool = True,
    dry_run: bool = False,
) -> dict[str, object]:
    """Run the chapter pipeline with manifest resume support."""

    language = language or CONFIG.whisper_language
    audio_path = _resolve_audio_path(path, book, chapter, content_type)
    context = PipelineContext(
        book=_display_book(book),
        chapter=chapter,
        content_type=content_type,
        audio_path=audio_path,
    )
    context.manifest = load_manifest(context.book, context.chapter)
    log_stage(LOGGER, context, "PIPELINE", "Processing chapter audio")

    try:
        validate_configured_text_provider()
        if resume and not force:
            _hydrate_context_from_manifest(context)

        upstream_reran = False
        for stage in _stages(language=language, dry_run=dry_run):
            if (
                not upstream_reran
                and _should_skip(stage.name, context, force=force, resume=resume)
            ):
                log_stage(LOGGER, context, stage.name, "Skipping completed stage")
                continue
            context = _run_stage(stage, context)
            upstream_reran = True

        context.mark_finished("imported")
        if not dry_run:
            write_manifest(context, imported=True)
            update_pipeline_state(context)
    except AudioPipelineError as exc:
        context.mark_finished("failed", str(exc))
        if not dry_run:
            update_pipeline_state(context)
        log_stage(LOGGER, context, "PIPELINE", f"Processing stopped: {exc}")
        raise

    log_stage(
        LOGGER,
        context,
        "PIPELINE",
        "Chapter processing completed",
        context.processing_time_seconds or 0.0,
    )
    return context.to_dict()


def _stages(language: str, dry_run: bool) -> list[Stage[PipelineContext]]:
    """Return the ordered pipeline stages."""

    return [
        Stage("VALIDATE", lambda ctx: validate_audio_stage(ctx, dry_run=dry_run)),
        Stage(
            "TRANSCRIBE",
            lambda ctx: transcribe_stage(ctx, language=language, dry_run=dry_run),
            transient=True,
        ),
        Stage("ALIGN", lambda ctx: align_stage(ctx, dry_run=dry_run), transient=True),
        Stage(
            "BUILD_INDEX",
            lambda ctx: build_index_stage(ctx, dry_run=dry_run),
            transient=True,
        ),
        Stage("VALIDATE_INDEX", lambda ctx: validate_index_stage(ctx, dry_run=dry_run)),
        Stage("IMPORT", lambda ctx: import_index_stage(ctx, dry_run=dry_run), transient=True),
    ]


def _run_stage(stage: Stage[PipelineContext], context: PipelineContext) -> PipelineContext:
    """Run one stage, retrying only transient operations."""

    started = now_seconds()
    log_stage(LOGGER, context, stage.name, "Stage started")

    def operation() -> PipelineContext:
        return stage.action(context)

    try:
        if stage.transient:
            result = retry_transient(
                operation,
                logger=LOGGER,
                operation_name=stage.name,
            )
        else:
            result = operation()
    except AudioValidationError:
        log_stage(
            LOGGER,
            context,
            stage.name,
            "Validation failed; not retrying",
            now_seconds() - started,
        )
        raise
    except AudioPipelineError:
        log_stage(LOGGER, context, stage.name, "Stage failed", now_seconds() - started)
        raise
    except Exception as exc:
        log_stage(
            LOGGER,
            context,
            stage.name,
            f"Unexpected stage failure: {exc}",
            now_seconds() - started,
        )
        raise AudioPipelineError(f"{stage.name} failed: {exc}") from exc

    log_stage(LOGGER, context, stage.name, "Stage completed", now_seconds() - started)
    return result


def _should_skip(
    stage_name: str,
    context: PipelineContext,
    *,
    force: bool,
    resume: bool,
) -> bool:
    """Return whether a stage can be skipped from manifest progress."""

    if force or not resume:
        return False
    manifest = context.manifest
    if stage_name == "VALIDATE":
        return bool(manifest.get("metadata"))
    if stage_name == "TRANSCRIBE":
        return bool(manifest.get("transcription")) and _existing_transcription_matches_language(context)
    if stage_name == "ALIGN":
        return bool(manifest.get("alignment")) and _alignment_is_current(context)
    if stage_name == "BUILD_INDEX":
        return (
            bool(manifest.get("verse_index"))
            and _index_is_current(context)
            and _existing_index_is_valid(context)
        )
    if stage_name == "VALIDATE_INDEX":
        return (
            bool(manifest.get("verse_index"))
            and _index_is_current(context)
            and _existing_index_is_valid(context)
            and _qa_reports_exist(context)
        )
    if stage_name == "IMPORT":
        return bool(manifest.get("imported"))
    return False


def _existing_index_is_valid(context: PipelineContext) -> bool:
    """Return whether the resumed verse index artifact still passes validation."""

    try:
        validate_index(_load_index(context))
    except Exception as exc:
        log_stage(
            LOGGER,
            context,
            "RESUME",
            f"Existing verse index is invalid; rebuilding: {exc}",
        )
        return False
    return True


def _alignment_is_current(context: PipelineContext) -> bool:
    transcript_path = artifact_path(CONFIG.transcripts_dir, context.audio_path, ".transcript.json")
    alignment_path = CONFIG.alignments_dir / context.book.replace(" ", "_") / f"{context.chapter}.json"
    return _artifact_is_current(alignment_path, transcript_path, context, "alignment")


def _index_is_current(context: PipelineContext) -> bool:
    alignment_path = CONFIG.alignments_dir / context.book.replace(" ", "_") / f"{context.chapter}.json"
    index_path = CONFIG.indexes_dir / context.book.replace(" ", "_") / f"{context.chapter}.json"
    return _artifact_is_current(index_path, alignment_path, context, "index")


def _artifact_is_current(
    artifact_path: Path,
    dependency_path: Path,
    context: PipelineContext,
    label: str,
) -> bool:
    if not artifact_path.exists() or not dependency_path.exists():
        return False
    if artifact_path.stat().st_mtime < dependency_path.stat().st_mtime:
        log_stage(
            LOGGER,
            context,
            "RESUME",
            f"Existing {label} artifact is older than its dependency; rebuilding",
        )
        return False
    return True


def can_skip_completed_chapter(book: str, chapter: int) -> bool:
    """Return whether a completed chapter can be safely skipped in resume mode."""

    manifest = load_manifest(_display_book(book), chapter)
    if not manifest.get("imported"):
        return False
    audio_path = Path(str(manifest.get("audio_path", ""))) if manifest.get("audio_path") else Path()
    context = PipelineContext(
        book=_display_book(book),
        chapter=chapter,
        content_type=str(manifest.get("content_type", "bible")),
        audio_path=audio_path,
        manifest=manifest,
    )
    return _existing_index_is_valid(context) and _qa_reports_exist(context)


def _existing_transcription_matches_language(context: PipelineContext) -> bool:
    """Return whether the cached transcript was produced for the configured language."""

    try:
        transcription = _load_transcription(context.audio_path)
    except Exception as exc:
        log_stage(
            LOGGER,
            context,
            "RESUME",
            f"Existing transcript is unavailable; rebuilding: {exc}",
        )
        return False
    if transcription.language != CONFIG.whisper_language:
        log_stage(
            LOGGER,
            context,
            "RESUME",
            "Existing transcript language "
            f"{transcription.language!r} does not match configured language "
            f"{CONFIG.whisper_language!r}; rebuilding",
        )
        return False
    return True


def _qa_reports_exist(context: PipelineContext) -> bool:
    stem = f"{context.book.replace(' ', '_')}_{context.chapter}"
    return all(
        path.exists()
        for path in (
            CONFIG.reports_dir / "summary" / f"{stem}.json",
            CONFIG.reports_dir / "html" / f"{stem}.html",
        )
    )


def _hydrate_context_from_manifest(context: PipelineContext) -> None:
    """Load completed artifacts needed to resume later stages."""

    manifest = context.manifest
    if not manifest:
        return

    if manifest.get("audio_path"):
        context.audio_path = Path(str(manifest["audio_path"]))
    if manifest.get("metadata"):
        context.metadata = _load_metadata(context.audio_path)
    if manifest.get("transcription"):
        context.transcription = _load_transcription(context.audio_path)
    if manifest.get("alignment"):
        context.alignment = _load_alignment(context)
    if manifest.get("verse_index"):
        context.verse_index = _load_index(context)


def _load_metadata(audio_path: Path) -> AudioMetadata | None:
    """Load metadata from the transcription artifact when available."""

    transcript_path = artifact_path(CONFIG.transcripts_dir, audio_path, ".transcript.json")
    if not transcript_path.exists():
        return None
    data = read_json(transcript_path).get("audio_metadata")
    if not isinstance(data, dict):
        return None
    return AudioMetadata(
        path=Path(str(data["path"])),
        duration_seconds=float(data["duration_seconds"]),
        bitrate_bps=(
            int(data["bitrate_bps"]) if data.get("bitrate_bps") is not None else None
        ),
        sample_rate_hz=int(data["sample_rate_hz"]),
        channels=int(data["channels"]),
        codec_name=data.get("codec_name"),
        format_name=data.get("format_name"),
    )


def _load_transcription(audio_path: Path) -> TranscriptionResult:
    """Load a transcription artifact for resume processing."""

    path = artifact_path(CONFIG.transcripts_dir, audio_path, ".transcript.json")
    data = read_json(path)
    return TranscriptionResult(
        audio_path=Path(str(data["audio_path"])),
        transcript_path=Path(str(data["transcript_path"])),
        language=str(data.get("language", "en")),
        text=str(data.get("text", "")),
        segments=list(data.get("segments", [])),
        engine=str(data.get("engine", "whisperx")),
    )


def _load_alignment(context: PipelineContext) -> AlignmentResult:
    """Load an alignment artifact for resume processing."""

    path = CONFIG.alignments_dir / context.book.replace(" ", "_") / f"{context.chapter}.json"
    if not path.exists():
        path = artifact_path(CONFIG.alignments_dir, context.audio_path, ".alignment.json")
    data = read_json(path)
    timings = [_timing_from_dict(item) for item in data.get("timings", [])]
    return AlignmentResult(
        audio_path=Path(str(data["audio_path"])),
        transcript_path=Path(str(data["transcript_path"])),
        alignment_path=Path(str(data["alignment_path"])),
        timings=timings,
        engine=str(data.get("engine", "whisperx-forced-aligner")),
    )


def _load_index(context: PipelineContext) -> VerseIndex:
    """Load a verse index artifact for resume processing."""

    path = CONFIG.indexes_dir / context.book.replace(" ", "_") / f"{context.chapter}.json"
    if not path.exists():
        path = artifact_path(CONFIG.indexes_dir, context.audio_path, ".index.json")
    data = read_json(path)
    verses = [_index_timing_from_dict(item) for item in data.get("verses", [])]
    metadata = data.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
    metadata.setdefault("book", context.book)
    metadata.setdefault("chapter", context.chapter)
    return VerseIndex(
        audio_path=Path(str(data.get("audio_path", context.audio_path))),
        index_path=Path(str(data.get("index_path", path))),
        verses=verses,
        metadata=metadata,
    )


def _timing_from_dict(data: object) -> VerseTiming:
    """Convert a JSON timing object into ``VerseTiming``."""

    if not isinstance(data, dict):
        raise AudioPipelineError("Invalid timing entry in artifact")
    return VerseTiming(
        verse_id=str(data["verse_id"]),
        start_seconds=float(data["start_seconds"]),
        end_seconds=float(data["end_seconds"]),
        text=str(data.get("text", "")),
        confidence=(
            float(data["confidence"]) if data.get("confidence") is not None else None
        ),
    )


def _index_timing_from_dict(data: object) -> VerseTiming:
    """Convert either legacy or production index timing JSON into ``VerseTiming``."""

    if not isinstance(data, dict):
        raise AudioPipelineError("Invalid verse timing entry in index artifact")
    if "verse_id" in data:
        return _timing_from_dict(data)
    return VerseTiming(
        verse_id=str(data["verse"]),
        start_seconds=float(data["start"]),
        end_seconds=float(data["end"]),
        text=str(data.get("text", "")),
        confidence=(
            float(data["confidence"])
            if data.get("confidence") is not None
            else None
        ),
        duration=float(data.get("duration", 0.0) or 0.0),
        word_count=int(data.get("word_count", 0) or 0),
    )


def _resolve_audio_path(
    path: str | Path | None,
    book: str,
    chapter: int,
    content_type: str,
) -> Path:
    """Resolve the audio file path from CLI input or a conventional location."""

    if path:
        return Path(path).expanduser().resolve()
    manifest = load_manifest(_display_book(book), chapter)
    if manifest.get("audio_path"):
        return Path(str(manifest["audio_path"]))
    return get_audio_provider().resolve(book, chapter, content_type).path


def _display_book(book: str) -> str:
    """Normalize a CLI book value for manifests and reports."""

    return book.replace("_", " ").strip().title()


def main() -> int:
    """CLI entry point for chapter processing."""

    parser = argparse.ArgumentParser(description="Process one chapter audio file.")
    parser.add_argument("path", nargs="?", help="Optional path to the chapter audio file.")
    parser.add_argument("--book", required=True, help="Book name, for example genesis.")
    parser.add_argument("--chapter", required=True, type=int, help="Chapter number.")
    parser.add_argument("--content-type", default="bible", help="Content source type.")
    parser.add_argument("--language", default=CONFIG.whisper_language, help="Language hint.")
    parser.add_argument("--force", action="store_true", help="Ignore manifest progress.")
    parser.add_argument("--resume", action="store_true", help="Resume from manifest progress.")
    parser.add_argument("--dry-run", action="store_true", help="Show flow without writing artifacts.")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose console logging.")
    args = parser.parse_args()

    if args.verbose:
        LOGGER.setLevel("DEBUG")

    try:
        result = process_chapter(
            args.path,
            book=args.book,
            chapter=args.chapter,
            content_type=args.content_type,
            language=args.language,
            force=args.force,
            resume=True if not args.force else args.resume,
            dry_run=args.dry_run,
        )
    except AudioPipelineError as exc:
        LOGGER.error("Processing stopped: %s", exc)
        print(f"ERROR: {exc}")
        return 1

    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
