"""Manifest persistence for chapter pipeline progress."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import CONFIG
from .filesystem import read_json, slug, write_json
from .models import PipelineContext


def manifest_path(book: str, chapter: int) -> Path:
    """Return the canonical manifest path for a chapter."""

    return CONFIG.reports_dir / "manifests" / f"{slug(book)}_{chapter}.json"


def load_manifest(book: str, chapter: int) -> dict[str, Any]:
    """Load a chapter manifest, returning an empty mapping when absent."""

    path = manifest_path(book, chapter)
    if not path.exists():
        return {}
    return read_json(path)


def write_manifest(context: PipelineContext, imported: bool = False) -> PipelineContext:
    """Write a manifest representing the latest successful pipeline stage."""

    manifest = {
        "book": context.book,
        "chapter": context.chapter,
        "content_type": context.content_type,
        "audio_path": str(context.audio_path),
        "status": context.status,
        "metadata": context.metadata is not None,
        "transcription": context.transcription is not None,
        "alignment": context.alignment is not None,
        "verse_index": context.verse_index is not None,
        "imported": imported,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    write_json(manifest_path(context.book, context.chapter), manifest)
    context.manifest = manifest
    return context
