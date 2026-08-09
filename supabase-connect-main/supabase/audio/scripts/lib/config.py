"""Configuration loading and path helpers for the audio pipeline."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .environment import load_audio_environment
from .exceptions import ConfigurationError


@dataclass(frozen=True)
class PipelineConfig:
    """Filesystem configuration used by all audio pipeline stages."""

    root_dir: Path
    config_path: Path
    source_dir: Path
    transcripts_dir: Path
    alignments_dir: Path
    indexes_dir: Path
    reports_dir: Path
    logs_dir: Path
    models_dir: Path
    cache_dir: Path
    temp_dir: Path
    retries: int
    backoff_seconds: float
    overwrite: bool
    whisper_model_size: str
    whisper_batch_size: int
    whisper_compute_type: str
    whisper_language: str
    alignment_language: str | None
    alignment_model_dir: Path | None
    speech_engine_provider: str
    speech_transcription_model: str
    speech_alignment_model: str | None
    speech_language: str
    speech_provider_options: dict[str, Any]
    qa_minimum_confidence: float
    qa_warning_confidence: float
    qa_flag_low_confidence: bool
    boundary_rolling_window_tokens: int
    minimum_verse_duration_seconds: float
    audio_provider: str
    audio_provider_base_dir: Path
    text_provider: str
    text_provider_translation: str
    supabase_url: str | None
    supabase_key: str | None


def get_audio_root() -> Path:
    """Return the root directory for ``supabase/audio``."""

    return Path(__file__).resolve().parents[2]


def get_config(config_path: Path | None = None) -> PipelineConfig:
    """Load pipeline configuration from YAML with production defaults."""

    root_dir = get_audio_root()
    project_root = root_dir.parents[1]
    load_audio_environment(root_dir, project_root)
    path = config_path or root_dir / "config.yaml"
    raw_config = _load_yaml(path)
    paths = _mapping(raw_config.get("paths", {}), "paths")
    processing = _mapping(raw_config.get("processing", {}), "processing")
    whisper = _mapping(raw_config.get("whisper", {}), "whisper")
    alignment = _mapping(raw_config.get("alignment", {}), "alignment")
    speech_engine = _mapping(raw_config.get("speech_engine", {}), "speech_engine")
    qa = _mapping(raw_config.get("qa", {}), "qa")
    indexing = _mapping(raw_config.get("indexing", {}), "indexing")
    audio_provider = _provider_config(raw_config.get("audio_provider", {}), "audio_provider")
    text_provider = _provider_config(raw_config.get("text_provider", {}), "text_provider")
    audio_provider.update(_mapping(raw_config.get("audio_provider_options", {}), "audio_provider_options"))
    text_provider.update(_mapping(raw_config.get("text_provider_options", {}), "text_provider_options"))
    supabase = _mapping(raw_config.get("supabase", {}), "supabase")

    reports_dir = _resolve(root_dir, paths.get("reports", "reports"))
    audio_provider_name = _provider_name(audio_provider, "file")
    text_provider_name = _provider_name(text_provider, "file")
    speech_provider_options = _mapping(
        speech_engine.get("provider_options", {}),
        "speech_engine.provider_options",
    )
    speech_provider = str(speech_engine.get("provider", "whisperx")).strip().lower() or "whisperx"
    speech_transcription_model = str(
        speech_engine.get("transcription_model", whisper.get("model_size", "base"))
    )
    speech_alignment_model = _optional_string(speech_engine.get("alignment_model"))
    speech_language = str(speech_engine.get("language", whisper.get("language", "sw")))
    return PipelineConfig(
        root_dir=root_dir,
        config_path=path,
        source_dir=_resolve(root_dir, paths.get("source", "source")),
        transcripts_dir=_resolve(root_dir, paths.get("transcripts", "transcripts")),
        alignments_dir=_resolve(root_dir, paths.get("alignments", "alignments")),
        indexes_dir=_resolve(root_dir, paths.get("indexes", "indexes")),
        reports_dir=reports_dir,
        logs_dir=reports_dir / "logs",
        models_dir=_resolve(root_dir, paths.get("models", "models")),
        cache_dir=_resolve(root_dir, paths.get("cache", "cache")),
        temp_dir=_resolve(root_dir, paths.get("temp", "temp")),
        retries=_int(processing.get("retries", 3), "processing.retries"),
        backoff_seconds=_float(
            processing.get("backoff_seconds", 2),
            "processing.backoff_seconds",
        ),
        overwrite=_bool(processing.get("overwrite", False)),
        whisper_model_size=str(whisper.get("model_size", "base")),
        whisper_batch_size=_int(whisper.get("batch_size", 8), "whisper.batch_size"),
        whisper_compute_type=str(whisper.get("compute_type", "float32")),
        whisper_language=speech_language,
        alignment_language=_optional_string(alignment.get("language")),
        alignment_model_dir=(
            _resolve(root_dir, alignment["model_dir"])
            if _optional_string(alignment.get("model_dir"))
            else None
        ),
        speech_engine_provider=speech_provider,
        speech_transcription_model=speech_transcription_model,
        speech_alignment_model=speech_alignment_model,
        speech_language=speech_language,
        speech_provider_options=speech_provider_options,
        qa_minimum_confidence=_float(
            qa.get("minimum_confidence", 0.90),
            "qa.minimum_confidence",
        ),
        qa_warning_confidence=_float(
            qa.get("warning_confidence", 0.95),
            "qa.warning_confidence",
        ),
        qa_flag_low_confidence=_bool(qa.get("flag_low_confidence", True)),
        boundary_rolling_window_tokens=_int(
            indexing.get("boundary_rolling_window_tokens", 80),
            "indexing.boundary_rolling_window_tokens",
        ),
        minimum_verse_duration_seconds=_float(
            indexing.get("minimum_verse_duration_seconds", 0.05),
            "indexing.minimum_verse_duration_seconds",
        ),
        audio_provider=audio_provider_name,
        audio_provider_base_dir=Path(str(audio_provider.get("base_dir", paths.get("source", "source")))),
        text_provider=text_provider_name,
        text_provider_translation=str(text_provider.get("translation", "CPDV")),
        supabase_url=(
            _optional_string(supabase.get("url"))
            or _optional_string(os.getenv("SUPABASE_URL"))
        ),
        supabase_key=(
            _optional_string(supabase.get("key"))
            or _optional_string(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
            or _optional_string(os.getenv("SUPABASE_ANON_KEY"))
        ),
    )


def _load_yaml(path: Path) -> dict[str, Any]:
    """Load a YAML config file, returning an empty mapping when absent."""

    if not path.exists():
        return {}
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        raise ConfigurationError(f"Invalid YAML config: {path}") from exc
    if not isinstance(data, dict):
        raise ConfigurationError(f"Config root must be a mapping: {path}")
    return data


def _mapping(value: Any, label: str) -> dict[str, Any]:
    """Validate a config section as a mapping."""

    if not isinstance(value, dict):
        raise ConfigurationError(f"Config section must be a mapping: {label}")
    return value


def _provider_config(value: Any, label: str) -> dict[str, Any]:
    """Validate provider config, accepting scalar shorthand."""

    if isinstance(value, str):
        return {"name": value}
    if value is None:
        return {}
    return _mapping(value, label)


def _provider_name(value: dict[str, Any], default: str) -> str:
    """Return a provider name from either shorthand or mapping config."""

    raw = value.get("name", value.get("type", default))
    return str(raw).strip().lower() or default


def _optional_string(value: Any) -> str | None:
    """Return a non-empty string or None."""

    if value is None:
        return None
    parsed = str(value).strip()
    return parsed or None


def _resolve(root_dir: Path, value: Any) -> Path:
    """Resolve a configured path relative to the audio root."""

    path = Path(str(value))
    return path if path.is_absolute() else root_dir / path


def _int(value: Any, label: str) -> int:
    """Parse an integer config value."""

    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ConfigurationError(f"Invalid integer config value: {label}") from exc
    if parsed < 0:
        raise ConfigurationError(f"Config value cannot be negative: {label}")
    return parsed


def _float(value: Any, label: str) -> float:
    """Parse a floating-point config value."""

    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ConfigurationError(f"Invalid numeric config value: {label}") from exc
    if parsed < 0:
        raise ConfigurationError(f"Config value cannot be negative: {label}")
    return parsed


def _bool(value: Any) -> bool:
    """Parse a boolean config value."""

    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


CONFIG = get_config()
