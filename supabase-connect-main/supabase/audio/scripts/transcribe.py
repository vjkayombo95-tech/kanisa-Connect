"""Transcription stage interface for Kanisa Connect audio."""

from __future__ import annotations

import argparse
from pathlib import Path
from dataclasses import replace

from lib.config import CONFIG
from lib.exceptions import TranscriptionError
from lib.filesystem import artifact_path, write_json
from lib.logger import get_logger, log_stage, now_seconds
from lib.manifest import write_manifest
from lib.models import AudioMetadata, PipelineContext, TranscriptionResult
from speech.factory import create_speech_engine, get_speech_engine
from validate_audio import validate_audio

LOGGER = get_logger("transcribe")


def transcribe_audio(
    audio_path: str | Path,
    metadata: AudioMetadata | None = None,
    language: str | None = None,
) -> TranscriptionResult:
    """Transcribe an audio file with the configured speech engine."""

    path = Path(audio_path).expanduser().resolve()
    LOGGER.info("Starting transcription stage for %s", path)

    try:
        audio_metadata = metadata or validate_audio(path)
        engine = _speech_engine_for_language(language)
        transcript = engine.process(path)
        transcript_path = artifact_path(CONFIG.transcripts_dir, path, ".transcript.json")
        result = TranscriptionResult(
            audio_path=path,
            transcript_path=transcript_path,
            language=str(language or transcript.language),
            text=transcript.text,
            segments=transcript.segment_dicts(),
            engine=str(
                engine.model_info().get(
                    "transcription_engine",
                    CONFIG.speech_engine_provider,
                )
            ),
        )
        payload = result.to_dict()
        payload["audio_metadata"] = audio_metadata.to_dict()
        payload["standard_transcript"] = transcript.to_dict()
        payload["speech_engine"] = engine.model_info()
        write_json(transcript_path, payload)
    except Exception as exc:
        if isinstance(exc, TranscriptionError):
            raise
        raise TranscriptionError(f"Transcription failed for {path}: {exc}") from exc

    LOGGER.info("Transcription artifact written: %s", transcript_path)
    return result


def _speech_engine_for_language(language: str | None):
    """Return the configured engine, honoring explicit legacy language hints."""

    if language is None or language == CONFIG.speech_language:
        return get_speech_engine()
    return create_speech_engine(
        replace(
            CONFIG,
            speech_language=language,
            whisper_language=language,
        )
    )


def transcribe_stage(
    context: PipelineContext,
    language: str | None = None,
    dry_run: bool = False,
) -> PipelineContext:
    """Run the transcription stage for a pipeline context."""

    started = now_seconds()
    log_stage(LOGGER, context, "TRANSCRIBE", "Starting transcription")
    if dry_run:
        context.status = "transcribed"
        log_stage(LOGGER, context, "TRANSCRIBE", "Dry run skipped transcription", 0.0)
        return context

    try:
        context.transcription = transcribe_audio(
            context.audio_path,
            metadata=context.metadata,
            language=language,
        )
        context.status = "transcribed"
        write_manifest(context)
    except Exception as exc:
        if isinstance(exc, TranscriptionError):
            raise
        raise TranscriptionError(
            f"Transcription stage failed for {context.book} {context.chapter}: {exc}"
        ) from exc

    log_stage(
        LOGGER,
        context,
        "TRANSCRIBE",
        "Transcription completed",
        now_seconds() - started,
    )
    return context


def main() -> int:
    """CLI entry point for transcription."""

    parser = argparse.ArgumentParser(description="Transcribe an audio file.")
    parser.add_argument("path", help="Path to the audio file.")
    parser.add_argument("--language", default=CONFIG.speech_language, help="Language hint.")
    args = parser.parse_args()

    try:
        result = transcribe_audio(args.path, language=args.language)
    except TranscriptionError as exc:
        LOGGER.error("Transcription stage failed: %s", exc)
        print(f"ERROR: {exc}")
        return 1

    print(f"Transcript: {result.transcript_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
