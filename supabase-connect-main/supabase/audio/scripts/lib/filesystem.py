"""Filesystem helpers used by pipeline scripts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def ensure_directory(path: Path) -> Path:
    """Create ``path`` when needed and return it."""

    path.mkdir(parents=True, exist_ok=True)
    return path


def artifact_path(directory: Path, audio_path: Path, suffix: str) -> Path:
    """Return a stable artifact path for an audio file and suffix."""

    ensure_directory(directory)
    return directory / f"{audio_path.stem}{suffix}"


def write_json(path: Path, payload: dict[str, Any]) -> Path:
    """Write ``payload`` as formatted UTF-8 JSON."""

    ensure_directory(path.parent)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return path


def read_json(path: Path) -> dict[str, Any]:
    """Read a JSON object from ``path``."""

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return data


def slug(value: str) -> str:
    """Return a filesystem-friendly slug for manifest/report names."""

    normalized = value.strip().replace(" ", "_")
    return "".join(char for char in normalized if char.isalnum() or char in "_-")
