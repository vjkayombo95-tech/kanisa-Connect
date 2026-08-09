"""Import verse indexes into downstream storage."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from align import align_transcription
from build_index import build_verse_index
from lib.exceptions import AudioPipelineError, IndexImportError
from lib.filesystem import write_json
from lib.logger import get_logger, log_stage, now_seconds
from lib.manifest import write_manifest
from lib.models import PipelineContext, VerseIndex
from lib.qa import write_dashboard, write_hash_report
from transcribe import transcribe_audio
from validate_index import validate_index

LOGGER = get_logger("import_index")


def import_index(index: VerseIndex) -> dict[str, Any]:
    """Finalize a validated verse index without importing to Supabase."""

    LOGGER.info("Starting index import for %s", index.index_path)

    try:
        validate_index(index)
        write_json(
            index.index_path,
            {
                "book": index.metadata.get("book"),
                "chapter": index.metadata.get("chapter"),
                "audio_path": str(index.audio_path),
                "metadata": index.metadata,
                "verses": [
                    {
                        "verse": int(verse.verse_id),
                        "start": verse.start_seconds,
                        "end": verse.end_seconds,
                        "confidence": verse.confidence,
                        "duration": verse.duration,
                        "word_count": verse.word_count,
                        "text": verse.text,
                    }
                    for verse in index.verses
                ],
            },
        )
        result: dict[str, Any] = {
            "status": "written",
            "index_path": str(index.index_path),
            "verse_count": len(index.verses),
        }
    except Exception as exc:
        if isinstance(exc, IndexImportError):
            raise
        raise IndexImportError(f"Index import failed for {index.index_path}: {exc}") from exc

    LOGGER.info(
        "Index finalization completed: %s verses from %s",
        result["verse_count"],
        index.index_path,
    )
    return result


def import_index_stage(context: PipelineContext, dry_run: bool = False) -> PipelineContext:
    """Import the validated verse index for a pipeline context."""

    started = now_seconds()
    log_stage(LOGGER, context, "IMPORT", "Starting index finalization")
    if dry_run:
        context.report["import"] = {"status": "dry-run"}
        context.status = "imported"
        log_stage(LOGGER, context, "IMPORT", "Dry run skipped import", 0.0)
        return context
    if context.verse_index is None:
        raise IndexImportError("Cannot import without a verse index")

    context.report["import"] = import_index(context.verse_index)
    write_hash_report(context)
    write_dashboard()
    context.status = "imported"
    write_manifest(context, imported=True)
    log_stage(LOGGER, context, "IMPORT", "Index finalization completed", now_seconds() - started)
    return context


def main() -> int:
    """CLI entry point for index finalization."""

    parser = argparse.ArgumentParser(description="Finalize a verse index JSON artifact.")
    parser.add_argument("path", help="Path to the audio file.")
    args = parser.parse_args()

    try:
        transcription = transcribe_audio(Path(args.path))
        alignment = align_transcription(transcription)
        index = build_verse_index(alignment)
        result = import_index(index)
    except AudioPipelineError as exc:
        LOGGER.error("Index import stage failed: %s", exc)
        print(f"ERROR: {exc}")
        return 1
    except Exception as exc:
        LOGGER.exception("Unexpected index import stage failure: %s", exc)
        print(f"ERROR: {exc}")
        return 1

    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
