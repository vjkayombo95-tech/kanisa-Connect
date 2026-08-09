from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BenchmarkChapter:
    book: str
    chapter: int
    osis_book: str

    @property
    def id(self) -> str:
        return f"{self.osis_book}_{self.chapter:03d}"

    @property
    def label(self) -> str:
        return f"{self.book} {self.chapter}"


BENCHMARK_CORPUS: tuple[BenchmarkChapter, ...] = (
    BenchmarkChapter(book="Genesis", chapter=1, osis_book="GEN"),
    BenchmarkChapter(book="Psalm", chapter=23, osis_book="PSA"),
    BenchmarkChapter(book="Matthew", chapter=5, osis_book="MAT"),
    BenchmarkChapter(book="John", chapter=3, osis_book="JHN"),
    BenchmarkChapter(book="Romans", chapter=8, osis_book="ROM"),
)


def chapter_by_id(chapter_id: str) -> BenchmarkChapter:
    for chapter in BENCHMARK_CORPUS:
        if chapter.id == chapter_id:
            return chapter
    raise KeyError(f"Unknown benchmark chapter: {chapter_id}")
