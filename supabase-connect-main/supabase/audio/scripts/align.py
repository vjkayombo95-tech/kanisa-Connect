"""Alignment stage interface for Kanisa Connect audio."""

from __future__ import annotations

import argparse
from pathlib import Path

from lib.config import CONFIG
from lib.exceptions import AlignmentError
from lib.filesystem import artifact_path, read_json, write_json
from lib.logger import get_logger, log_stage, now_seconds
from lib.manifest import write_manifest
from lib.models import AlignmentResult, PipelineContext, TranscriptionResult, VerseTiming
from speech import StandardTranscript, TranscriptSegment, WordTimestamp, get_speech_engine
from transcribe import transcribe_audio

LOGGER = get_logger("align")


def align_transcription(transcription: TranscriptionResult) -> AlignmentResult:
    """Align a transcription with the configured speech engine."""

    LOGGER.info("Starting alignment stage for %s", transcription.audio_path)

    try:
        alignment_path = artifact_path(CONFIG.alignments_dir, transcription.audio_path, ".alignment.json")
        engine = get_speech_engine()
        aligned_transcript = _standard_transcript_from_result(transcription)
        if not aligned_transcript.words:
            aligned_transcript = engine.process(transcription.audio_path)
        result = AlignmentResult(
            audio_path=transcription.audio_path,
            transcript_path=transcription.transcript_path,
            alignment_path=alignment_path,
            timings=_segment_timings(aligned_transcript),
            engine=str(
                engine.model_info().get(
                    "alignment_engine",
                    CONFIG.speech_engine_provider,
                )
            ),
        )
        payload = result.to_dict()
        payload["segments"] = aligned_transcript.segment_dicts()
        payload["word_segments"] = aligned_transcript.word_dicts()
        payload["standard_transcript"] = aligned_transcript.to_dict()
        payload["speech_engine"] = engine.model_info()
        write_json(alignment_path, payload)
    except Exception as exc:
        if isinstance(exc, AlignmentError):
            raise
        raise AlignmentError(
            f"Alignment failed for {transcription.audio_path}: {exc}"
        ) from exc

    LOGGER.info("Alignment artifact written: %s", alignment_path)
    return result


def align_chapter(context: PipelineContext) -> AlignmentResult:
    """Align a chapter and save the canonical book/chapter alignment artifact."""

    if context.transcription is None:
        raise AlignmentError("Cannot align without a transcription result")

    engine = get_speech_engine()
    aligned_transcript = _standard_transcript_from_result(context.transcription)
    if not aligned_transcript.words:
        aligned_transcript = engine.process(context.audio_path)
    alignment_path = _chapter_alignment_path(context)
    result = AlignmentResult(
        audio_path=context.audio_path,
        transcript_path=context.transcription.transcript_path,
        alignment_path=alignment_path,
        timings=_segment_timings(aligned_transcript),
        engine=str(
            engine.model_info().get(
                "alignment_engine",
                CONFIG.speech_engine_provider,
            )
        ),
    )
    payload = result.to_dict()
    payload.update(
        {
            "book": context.book,
            "chapter": context.chapter,
            "segments": aligned_transcript.segment_dicts(),
            "word_segments": aligned_transcript.word_dicts(),
            "standard_transcript": aligned_transcript.to_dict(),
            "speech_engine": engine.model_info(),
        }
    )
    write_json(alignment_path, payload)
    return result


def align_stage(context: PipelineContext, dry_run: bool = False) -> PipelineContext:
    """Run alignment for a pipeline context."""

    started = now_seconds()
    log_stage(LOGGER, context, "ALIGN", "Starting alignment")
    if dry_run:
        context.status = "aligned"
        log_stage(LOGGER, context, "ALIGN", "Dry run skipped alignment", 0.0)
        return context
    if context.transcription is None:
        raise AlignmentError("Cannot align without a transcription result")

    context.alignment = align_chapter(context)
    context.status = "aligned"
    write_manifest(context)
    log_stage(LOGGER, context, "ALIGN", "Alignment completed", now_seconds() - started)
    return context


def main() -> int:
    """CLI entry point for alignment."""

    parser = argparse.ArgumentParser(description="Align transcription with the configured speech engine.")
    parser.add_argument("path", help="Path to the audio file.")
    args = parser.parse_args()

    try:
        transcription = transcribe_audio(Path(args.path))
        result = align_transcription(transcription)
    except AlignmentError as exc:
        LOGGER.error("Alignment stage failed: %s", exc)
        print(f"ERROR: {exc}")
        return 1
    except Exception as exc:
        LOGGER.exception("Unexpected alignment stage failure: %s", exc)
        print(f"ERROR: {exc}")
        return 1

    print(f"Alignment: {result.alignment_path}")
    return 0


def _segment_timings(transcript: StandardTranscript) -> list[VerseTiming]:
    """Convert aligned segments into coarse timing records."""

    timings: list[VerseTiming] = []
    for index, segment in enumerate(transcript.segments, start=1):
        timings.append(
            VerseTiming(
                verse_id=f"segment-{index}",
                start_seconds=float(segment.start),
                end_seconds=float(segment.end),
                text=segment.text,
                confidence=segment.confidence or 0.0,
            )
        )
    return timings


def _standard_transcript_from_result(result: TranscriptionResult) -> StandardTranscript:
    """Convert the legacy transcription result into the provider-neutral schema."""

    artifact_transcript = _standard_transcript_from_artifact(result.transcript_path)
    if artifact_transcript is not None:
        return artifact_transcript

    segments: list[TranscriptSegment] = []
    for segment in result.segments:
        if not isinstance(segment, dict):
            continue
        segments.append(
            TranscriptSegment(
                start=float(segment.get("start", 0.0)),
                end=float(segment.get("end", 0.0)),
                text=str(segment.get("text", "")),
                confidence=(
                    float(segment["confidence"])
                    if segment.get("confidence") is not None
                    else None
                ),
            )
        )
    return StandardTranscript(
        language=result.language,
        text=result.text,
        segments=segments,
        metadata={"source": "transcription_result"},
    )


def _standard_transcript_from_artifact(path: Path) -> StandardTranscript | None:
    """Load a standard transcript embedded in a transcript artifact."""

    if not path.exists():
        return None
    data = read_json(path)
    raw = data.get("standard_transcript")
    if not isinstance(raw, dict):
        return None
    return _standard_transcript_from_dict(raw)


def _standard_transcript_from_dict(data: dict[str, object]) -> StandardTranscript:
    """Convert a transcript JSON payload into the standard schema."""

    segments: list[TranscriptSegment] = []
    raw_segments = data.get("segments", [])
    if isinstance(raw_segments, list):
        for segment in raw_segments:
            if not isinstance(segment, dict):
                continue
            segments.append(
                TranscriptSegment(
                    start=float(segment.get("start", 0.0)),
                    end=float(segment.get("end", 0.0)),
                    text=str(segment.get("text", "")),
                    confidence=(
                        float(segment["confidence"])
                        if segment.get("confidence") is not None
                        else None
                    ),
                    metadata=(
                        dict(segment["metadata"])
                        if isinstance(segment.get("metadata"), dict)
                        else {}
                    ),
                )
            )

    words: list[WordTimestamp] = []
    raw_words = data.get("words", data.get("word_timestamps", []))
    if isinstance(raw_words, list):
        for word in raw_words:
            if not isinstance(word, dict):
                continue
            words.append(
                WordTimestamp(
                    text=str(word.get("text", word.get("word", ""))).strip(),
                    start=float(word.get("start", 0.0)),
                    end=float(word.get("end", 0.0)),
                    confidence=(
                        float(word["confidence"])
                        if word.get("confidence") is not None
                        else (
                            float(word["score"])
                            if word.get("score") is not None
                            else None
                        )
                    ),
                    speaker=(
                        str(word["speaker"]) if word.get("speaker") is not None else None
                    ),
                    metadata=(
                        dict(word["metadata"])
                        if isinstance(word.get("metadata"), dict)
                        else {}
                    ),
                )
            )

    return StandardTranscript(
        language=str(data.get("language", "")),
        text=str(data.get("text", "")),
        segments=segments,
        words=words,
        metadata=dict(data.get("metadata", {})) if isinstance(data.get("metadata"), dict) else {},
    )


def _chapter_alignment_path(context: PipelineContext) -> Path:
    """Return ``alignments/{book}/{chapter}.json`` for a pipeline context."""

    book = context.book.replace(" ", "_")
    return CONFIG.alignments_dir / book / f"{context.chapter}.json"


if __name__ == "__main__":
    raise SystemExit(main())
