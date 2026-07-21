from __future__ import annotations

import json
from pathlib import Path

from .corpus import BENCHMARK_CORPUS, BenchmarkChapter, chapter_by_id
from .models import Transcript


class GoldenReferenceManager:
    """Stores manually corrected benchmark transcripts outside production indexes."""

    def __init__(self, root: str | Path = "evaluation/speech_lab/golden") -> None:
        self.root = Path(root)

    def path_for(self, chapter: BenchmarkChapter | str) -> Path:
        chapter_id = chapter if isinstance(chapter, str) else chapter.id
        return self.root / f"{chapter_id}.golden.json"

    def exists(self, chapter: BenchmarkChapter | str) -> bool:
        return self.path_for(chapter).exists()

    def load(self, chapter: BenchmarkChapter | str) -> Transcript:
        path = self.path_for(chapter)
        with path.open("r", encoding="utf-8") as handle:
            return Transcript.from_dict(json.load(handle))

    def save(self, transcript: Transcript) -> Path:
        chapter_by_id(transcript.chapter_id)
        self.root.mkdir(parents=True, exist_ok=True)
        path = self.path_for(transcript.chapter_id)
        with path.open("w", encoding="utf-8") as handle:
            json.dump(transcript.to_dict(), handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        return path

    def missing_references(self, corpus: tuple[BenchmarkChapter, ...] = BENCHMARK_CORPUS) -> list[BenchmarkChapter]:
        return [chapter for chapter in corpus if not self.exists(chapter)]

    def initialize_placeholders(self) -> list[Path]:
        paths: list[Path] = []
        for chapter in BENCHMARK_CORPUS:
            if self.exists(chapter):
                continue
            paths.append(
                self.save(
                    Transcript(
                        chapter_id=chapter.id,
                        text="",
                        metadata={
                            "label": chapter.label,
                            "status": "placeholder",
                            "instructions": "Replace text, words, and verse_boundaries with manually corrected golden data.",
                        },
                    )
                )
            )
        return paths
