"""Validate audio files before transcription."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from lib.exceptions import AudioValidationError
from lib.logger import get_logger, log_stage, now_seconds
from lib.manifest import write_manifest
from lib.models import AudioMetadata, PipelineContext

LOGGER = get_logger("validate_audio")


def validate_audio(path: str | Path) -> AudioMetadata:
    """Validate an audio file and return technical metadata.

    Checks that the file exists, FFmpeg tooling is installed, and ffprobe can
    report duration, bitrate, sample rate, and channel count.
    """

    audio_path = Path(path).expanduser().resolve()
    LOGGER.info("Validating audio file: %s", audio_path)

    if not audio_path.exists():
        raise AudioValidationError(f"Audio file does not exist: {audio_path}")
    if not audio_path.is_file():
        raise AudioValidationError(f"Audio path is not a file: {audio_path}")
    if shutil.which("ffmpeg") is None:
        raise AudioValidationError("ffmpeg is not installed or is not on PATH")
    if shutil.which("ffprobe") is None:
        raise AudioValidationError("ffprobe is not installed or is not on PATH")

    probe = _probe_audio(audio_path)
    metadata = _metadata_from_probe(audio_path, probe)

    LOGGER.info(
        "Audio validated: duration=%.3fs bitrate=%s sample_rate=%s channels=%s",
        metadata.duration_seconds,
        metadata.bitrate_bps,
        metadata.sample_rate_hz,
        metadata.channels,
    )
    return metadata


def validate_audio_stage(context: PipelineContext, dry_run: bool = False) -> PipelineContext:
    """Validate audio for a pipeline context and persist stage progress."""

    started = now_seconds()
    log_stage(LOGGER, context, "VALIDATE", "Starting audio validation")
    if dry_run:
        context.status = "validated"
        log_stage(LOGGER, context, "VALIDATE", "Dry run skipped validation", 0.0)
        return context

    metadata = validate_audio(context.audio_path)
    context.metadata = metadata
    context.status = "validated"
    write_manifest(context)
    log_stage(
        LOGGER,
        context,
        "VALIDATE",
        "Audio validation completed",
        now_seconds() - started,
    )
    return context


def _probe_audio(audio_path: Path) -> dict[str, Any]:
    """Run ffprobe and return parsed JSON output."""

    command = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(audio_path),
    ]
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise AudioValidationError("ffprobe executable was not found") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise AudioValidationError(f"ffprobe failed for {audio_path}: {detail}") from exc

    try:
        data = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise AudioValidationError("ffprobe returned invalid JSON") from exc

    if not isinstance(data, dict):
        raise AudioValidationError("ffprobe returned an unexpected payload")
    return data


def _metadata_from_probe(audio_path: Path, probe: dict[str, Any]) -> AudioMetadata:
    """Convert ffprobe output into ``AudioMetadata``."""

    streams = probe.get("streams")
    if not isinstance(streams, list):
        raise AudioValidationError("ffprobe output did not include streams")

    audio_stream = next(
        (stream for stream in streams if stream.get("codec_type") == "audio"),
        None,
    )
    if audio_stream is None:
        raise AudioValidationError("No audio stream found")

    format_data = probe.get("format")
    if not isinstance(format_data, dict):
        format_data = {}

    duration_seconds = _parse_float(
        audio_stream.get("duration") or format_data.get("duration"),
        "duration",
    )
    bitrate_bps = _parse_optional_int(
        audio_stream.get("bit_rate") or format_data.get("bit_rate")
    )
    sample_rate_hz = _parse_int(audio_stream.get("sample_rate"), "sample rate")
    channels = _parse_int(audio_stream.get("channels"), "channels")

    if duration_seconds <= 0:
        raise AudioValidationError("Audio duration must be greater than zero")
    if sample_rate_hz <= 0:
        raise AudioValidationError("Audio sample rate must be greater than zero")
    if channels <= 0:
        raise AudioValidationError("Audio channel count must be greater than zero")

    return AudioMetadata(
        path=audio_path,
        duration_seconds=duration_seconds,
        bitrate_bps=bitrate_bps,
        sample_rate_hz=sample_rate_hz,
        channels=channels,
        codec_name=_optional_string(audio_stream.get("codec_name")),
        format_name=_optional_string(format_data.get("format_name")),
    )


def _parse_float(value: Any, label: str) -> float:
    """Parse a required float from ffprobe output."""

    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise AudioValidationError(f"Missing or invalid audio {label}") from exc


def _parse_int(value: Any, label: str) -> int:
    """Parse a required integer from ffprobe output."""

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise AudioValidationError(f"Missing or invalid audio {label}") from exc


def _parse_optional_int(value: Any) -> int | None:
    """Parse an optional integer from ffprobe output."""

    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _optional_string(value: Any) -> str | None:
    """Return ``value`` when it is a non-empty string."""

    return value if isinstance(value, str) and value else None


def main() -> int:
    """CLI entry point for audio validation."""

    parser = argparse.ArgumentParser(description="Validate an audio file.")
    parser.add_argument("path", help="Path to the audio file.")
    args = parser.parse_args()

    try:
        metadata = validate_audio(args.path)
    except AudioValidationError as exc:
        LOGGER.error("Audio validation failed: %s", exc)
        print(f"ERROR: {exc}")
        return 1

    print(json.dumps(metadata.to_dict(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
