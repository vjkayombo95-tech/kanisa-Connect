from __future__ import annotations

import json
from pathlib import Path

from ..corpus import BenchmarkChapter
from ..models import ModelSpec, Transcript
from .base import SpeechModelAdapter


class ManifestProvider(SpeechModelAdapter):
    """Loads captured model output so metrics can be repeated deterministically."""

    def __init__(self, spec: ModelSpec, root: str | Path = "evaluation/speech_lab/model_outputs") -> None:
        super().__init__(spec)
        self.root = Path(spec.metadata.get("output_root", root))

    def output_path(self, chapter: BenchmarkChapter) -> Path:
        return self.root / self.spec.id / f"{chapter.id}.json"

    def transcribe(self, chapter: BenchmarkChapter, audio_path: Path | None) -> Transcript:
        path = self.output_path(chapter)
        if not path.exists():
            raise FileNotFoundError(
                f"Missing model output for {self.spec.name} / {chapter.label}: {path}. "
                "Run the model externally or place a captured JSON transcript at this path."
            )
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        payload.setdefault("chapter_id", chapter.id)
        return Transcript.from_dict(payload)
