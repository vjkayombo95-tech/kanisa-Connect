"""Environment file loading for the audio pipeline."""

from __future__ import annotations

import logging
import os
from pathlib import Path

try:
    from dotenv import dotenv_values, load_dotenv
except ImportError:  # pragma: no cover - fallback for environments before deps are installed
    dotenv_values = None
    load_dotenv = None


LOGGER = logging.getLogger("audio_environment")


def load_audio_environment(
    audio_root: Path,
    project_root: Path,
    *,
    override: bool = False,
) -> Path | None:
    """Load the first supported environment file and map Vite Supabase keys."""

    for path in _environment_candidates(audio_root, project_root):
        if not path.exists():
            continue

        loaded_values = _load_environment_file(path, override=override)
        _map_vite_supabase_keys(loaded_values, override=override)
        LOGGER.info("Loaded environment from:\n%s", path)
        return path

    return None


def _environment_candidates(audio_root: Path, project_root: Path) -> list[Path]:
    return [
        audio_root / ".env",
        project_root / ".env.local",
        project_root / ".env",
        project_root / ".env.staging.local",
        project_root / ".env.staging",
    ]


def _load_environment_file(path: Path, *, override: bool) -> dict[str, str]:
    if load_dotenv is not None and dotenv_values is not None:
        values = {
            key: value
            for key, value in dotenv_values(path).items()
            if key is not None and value is not None
        }
        load_dotenv(path, override=override)
        return values

    values = _parse_basic_env_file(path)
    for key, value in values.items():
        if override or key not in os.environ:
            os.environ[key] = value
    return values


def _map_vite_supabase_keys(values: dict[str, str], *, override: bool) -> None:
    _map_env_key(
        source="VITE_SUPABASE_URL",
        target="SUPABASE_URL",
        values=values,
        override=override,
    )
    _map_env_key(
        source="VITE_SUPABASE_ANON_KEY",
        target="SUPABASE_ANON_KEY",
        values=values,
        override=override,
    )


def _map_env_key(source: str, target: str, values: dict[str, str], *, override: bool) -> None:
    source_value = values.get(source) or os.environ.get(source)
    if not source_value:
        return
    if override or not os.environ.get(target):
        os.environ[target] = source_value


def _parse_basic_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key:
            values[key] = value
    return values
