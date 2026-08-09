"""Build verse index artifacts from alignment results."""

from __future__ import annotations

import argparse
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from align import align_transcription
from lib.config import CONFIG
from lib.exceptions import AudioPipelineError, IndexBuildError
from lib.filesystem import artifact_path, read_json, write_json
from lib.logger import get_logger, log_stage, now_seconds
from lib.manifest import write_manifest
from lib.models import AlignmentResult, PipelineContext, VerseIndex, VerseTiming
from providers.text_provider import BibleVerse, get_text_provider
from transcribe import transcribe_audio

LOGGER = get_logger("build_index")
BOUNDARY_TOKEN_MIN = 3
BOUNDARY_TOKEN_MAX = 6
BOUNDARY_FUZZY_THRESHOLD = 0.72


@dataclass(frozen=True)
class BoundaryMatch:
    """Result of locating a verse opening in aligned words."""

    verse_number: int
    start_index: int | None
    query_tokens: list[str]
    expected_opening_text: str
    closest_aligned_text: str
    similarity_score: float
    reason: str


@dataclass(frozen=True)
class VerseBoundaryResult:
    """Verse timings plus QA diagnostics for boundary matching."""

    timings: list[VerseTiming]
    qa: list[dict[str, Any]]


@dataclass(frozen=True)
class NormalizedBoundaryResult:
    """Normalized timings plus diagnostics about boundary adjustments."""

    timings: list[VerseTiming]
    qa: list[dict[str, Any]]


def build_verse_index(
    alignment: AlignmentResult,
    metadata: dict[str, Any] | None = None,
) -> VerseIndex:
    """Build a verse index from alignment timings."""

    LOGGER.info("Starting verse index build for %s", alignment.audio_path)

    try:
        index_path = artifact_path(CONFIG.indexes_dir, alignment.audio_path, ".index.json")
        normalized_result = _normalize_verse_boundaries(alignment.timings)
        _log_verse_boundaries(normalized_result.timings)
        _validate_generated_boundaries(normalized_result.timings)
        normalized_metadata = metadata or {"source": "alignment"}
        normalized_metadata.setdefault("boundary_normalization_qa", normalized_result.qa)
        index = VerseIndex(
            audio_path=alignment.audio_path,
            index_path=index_path,
            verses=normalized_result.timings,
            metadata=normalized_metadata,
        )
        write_json(index_path, index.to_dict())
    except Exception as exc:
        if isinstance(exc, IndexBuildError):
            raise
        raise IndexBuildError(
            f"Index build failed for {alignment.audio_path}: {exc}"
        ) from exc

    LOGGER.info("Index artifact written: %s", index_path)
    return index


def build_chapter_index(context: PipelineContext) -> VerseIndex:
    """Build ``indexes/{book}/{chapter}.json`` from text and word timestamps."""

    if context.alignment is None:
        raise IndexBuildError("Cannot build verse index without alignment")

    verses = _load_official_chapter_text(context)
    words = _load_word_timestamps(context.alignment.alignment_path)
    boundary_result = _build_verse_timings(verses, words)
    normalized_result = _normalize_verse_boundaries(boundary_result.timings)
    timings = normalized_result.timings
    _log_verse_boundaries(timings)
    _validate_generated_boundaries(timings)
    index_path = _chapter_index_path(context)
    metadata = {
        "book": context.book,
        "chapter": context.chapter,
        "source": "official-text-and-speech-engine-word-timestamps",
        "verse_boundary_qa": boundary_result.qa,
        "boundary_normalization_qa": normalized_result.qa,
    }
    verse_index = VerseIndex(
        audio_path=context.audio_path,
        index_path=index_path,
        verses=timings,
        metadata=metadata,
    )
    write_json(
        index_path,
        {
            "book": context.book,
            "chapter": context.chapter,
            "audio_path": str(context.audio_path),
            "alignment_path": str(context.alignment.alignment_path),
            "metadata": metadata,
            "verses": [
                {
                    "verse": int(timing.verse_id),
                    "start": timing.start_seconds,
                    "end": timing.end_seconds,
                    "confidence": timing.confidence,
                    "duration": timing.duration,
                    "word_count": timing.word_count,
                    "text": timing.text,
                }
                for timing in timings
            ],
        },
    )
    return verse_index


def build_index_stage(context: PipelineContext, dry_run: bool = False) -> PipelineContext:
    """Build a verse index for a pipeline context."""

    started = now_seconds()
    log_stage(LOGGER, context, "BUILD_INDEX", "Starting index build")
    if dry_run:
        context.status = "indexed"
        log_stage(LOGGER, context, "BUILD_INDEX", "Dry run skipped index build", 0.0)
        return context
    if context.alignment is None:
        raise IndexBuildError("Cannot build verse index without alignment")

    context.verse_index = build_chapter_index(context)
    context.status = "indexed"
    write_manifest(context)
    log_stage(
        LOGGER,
        context,
        "BUILD_INDEX",
        "Index build completed",
        now_seconds() - started,
    )
    return context


def main() -> int:
    """CLI entry point for building an index."""

    parser = argparse.ArgumentParser(description="Build a verse index.")
    parser.add_argument("path", help="Path to the audio file.")
    args = parser.parse_args()

    try:
        transcription = transcribe_audio(Path(args.path))
        alignment = align_transcription(transcription)
        index = build_verse_index(alignment)
    except AudioPipelineError as exc:
        LOGGER.error("Index build stage failed: %s", exc)
        print(f"ERROR: {exc}")
        return 1
    except Exception as exc:
        LOGGER.exception("Unexpected index build stage failure: %s", exc)
        print(f"ERROR: {exc}")
        return 1

    print(f"Index: {index.index_path}")
    return 0


def _load_official_chapter_text(context: PipelineContext) -> list[BibleVerse]:
    """Load official chapter text from the configured text provider."""

    return get_text_provider().get_chapter(context.book, context.chapter)


def _load_word_timestamps(alignment_path: Path) -> list[dict[str, Any]]:
    """Load word-level timestamps from an alignment artifact."""

    data = read_json(alignment_path)
    raw_words = data.get("word_segments", [])
    if not isinstance(raw_words, list) or not raw_words:
        raise IndexBuildError(f"Alignment artifact has no word timestamps: {alignment_path}")
    words: list[dict[str, Any]] = []
    for word in raw_words:
        if not isinstance(word, dict):
            continue
        if "word" not in word or "start" not in word or "end" not in word:
            continue
        words.append(
            {
                "word": str(word["word"]),
                "start": float(word["start"]),
                "end": float(word["end"]),
                "score": float(word.get("score", 0.0) or 0.0),
            }
        )
    if not words:
        raise IndexBuildError(f"Alignment artifact has no complete word timestamps: {alignment_path}")
    return words


def _map_words_to_verses(
    verses: list[BibleVerse],
    words: list[dict[str, Any]],
) -> list[VerseTiming]:
    """Map sequential word timestamps to official verse spans."""

    return _normalize_verse_boundaries(_build_verse_timings(verses, words).timings).timings


def _build_verse_timings(
    verses: list[BibleVerse],
    words: list[dict[str, Any]],
) -> VerseBoundaryResult:
    """Map verse text to aligned words using robust boundary matching."""

    if not words:
        raise IndexBuildError("Cannot build verse index without aligned words")

    normalized_words = [_normalize_word(str(word["word"])) for word in words]
    matches: list[BoundaryMatch] = []
    cursor = 0
    for verse in verses:
        verse_number = verse.verse
        verse_text = verse.text
        verse_tokens = _normalized_tokens(verse_text)
        verse_tokens = [token for token in verse_tokens if token]
        if not verse_tokens:
            matches.append(
                BoundaryMatch(
                    verse_number=verse_number,
                    start_index=None,
                    query_tokens=[],
                    expected_opening_text="",
                    closest_aligned_text="",
                    similarity_score=0.0,
                    reason="Verse has no indexable words",
                )
            )
            continue

        match = _find_verse_boundary(
            verse_number=verse_number,
            verse_tokens=verse_tokens,
            normalized_words=normalized_words,
            words=words,
            cursor=cursor,
        )
        matches.append(match)
        if match.start_index is not None:
            cursor = max(cursor, match.start_index + 1)

    timings = _timings_from_boundary_matches(verses, words, matches)
    qa = [_boundary_match_to_qa(match) for match in matches if match.reason != "exact"]
    return VerseBoundaryResult(timings=timings, qa=qa)

def _find_verse_boundary(
    *,
    verse_number: int,
    verse_tokens: list[str],
    normalized_words: list[str],
    words: list[dict[str, Any]],
    cursor: int,
) -> BoundaryMatch:
    """Locate a verse opening by exact sequence, fuzzy match, then rolling window."""

    query_tokens = verse_tokens[: min(BOUNDARY_TOKEN_MAX, len(verse_tokens))]
    candidate_lengths = _candidate_lengths(query_tokens)
    expected_opening_text = " ".join(query_tokens[: max(candidate_lengths, default=len(query_tokens))])

    exact = _best_exact_sequence(normalized_words, query_tokens, candidate_lengths, cursor, len(normalized_words))
    if exact is not None:
        start_index, length = exact
        return BoundaryMatch(
            verse_number=verse_number,
            start_index=start_index,
            query_tokens=query_tokens[:length],
            expected_opening_text=" ".join(query_tokens[:length]),
            closest_aligned_text=_aligned_text(words, start_index, length),
            similarity_score=1.0,
            reason="exact",
        )

    fuzzy = _best_fuzzy_sequence(normalized_words, query_tokens, candidate_lengths, cursor, len(normalized_words))
    if fuzzy and fuzzy[2] >= BOUNDARY_FUZZY_THRESHOLD:
        start_index, length, score = fuzzy
        return BoundaryMatch(
            verse_number=verse_number,
            start_index=start_index,
            query_tokens=query_tokens[:length],
            expected_opening_text=" ".join(query_tokens[:length]),
            closest_aligned_text=_aligned_text(words, start_index, length),
            similarity_score=score,
            reason="fuzzy",
        )

    window_size = CONFIG.boundary_rolling_window_tokens
    window_start = cursor
    window_end = min(len(normalized_words), cursor + window_size)
    rolling = _best_fuzzy_sequence(normalized_words, query_tokens, candidate_lengths, window_start, window_end)
    if rolling and rolling[2] >= BOUNDARY_FUZZY_THRESHOLD:
        start_index, length, score = rolling
        return BoundaryMatch(
            verse_number=verse_number,
            start_index=start_index,
            query_tokens=query_tokens[:length],
            expected_opening_text=" ".join(query_tokens[:length]),
            closest_aligned_text=_aligned_text(words, start_index, length),
            similarity_score=score,
            reason="rolling_window_fuzzy",
        )

    closest = fuzzy or rolling
    if closest:
        start_index, length, score = closest
        closest_text = _aligned_text(words, start_index, length)
    else:
        length = min(candidate_lengths, default=1)
        score = 0.0
        closest_text = _aligned_text(words, cursor, length)
    return BoundaryMatch(
        verse_number=verse_number,
        start_index=None,
        query_tokens=query_tokens[: min(candidate_lengths, default=len(query_tokens))],
        expected_opening_text=expected_opening_text,
        closest_aligned_text=closest_text,
        similarity_score=score,
        reason="boundary_not_found",
    )


def _timings_from_boundary_matches(
    verses: list[BibleVerse],
    words: list[dict[str, Any]],
    matches: list[BoundaryMatch],
) -> list[VerseTiming]:
    timings: list[VerseTiming] = []
    fallback_cursor = 0
    for index, verse in enumerate(verses):
        match = matches[index]
        start_index = match.start_index
        confidence_multiplier = max(0.0, min(1.0, match.similarity_score))
        if start_index is None:
            start_index = min(fallback_cursor, len(words) - 1)
            end_index = start_index
            confidence_multiplier = 0.0
        else:
            next_start = _next_matched_start(matches, index, start_index)
            if next_start is not None:
                end_index = max(start_index, next_start - 1)
            else:
                token_count = max(1, len(_normalized_tokens(verse.text)))
                end_index = min(len(words) - 1, start_index + token_count - 1)
        fallback_cursor = min(len(words) - 1, end_index + 1)
        timings.append(
            VerseTiming(
                verse_id=str(verse.verse),
                start_seconds=float(words[start_index]["start"]),
                end_seconds=float(words[end_index]["end"]),
                text=verse.text,
                confidence=round(
                    _average_score(words[start_index : end_index + 1]) * confidence_multiplier,
                    6,
                ),
                word_count=max(1, end_index - start_index + 1),
            )
        )
    return timings


def _normalize_verse_boundaries(timings: list[VerseTiming]) -> NormalizedBoundaryResult:
    """Normalize adjacent verse boundaries so generated indexes are monotonic."""

    if len(timings) < 2:
        return NormalizedBoundaryResult(timings=timings, qa=[])

    starts = [float(timing.start_seconds) for timing in timings]
    ends = [float(timing.end_seconds) for timing in timings]
    qa: list[dict[str, Any]] = []
    min_duration = max(float(CONFIG.minimum_verse_duration_seconds), 0.000001)
    epsilon = 0.000001

    for index in range(len(timings) - 1):
        current = timings[index]
        next_timing = timings[index + 1]
        current_start = starts[index]
        current_end = ends[index]
        next_start = starts[index + 1]
        next_end = ends[index + 1]
        raw_boundary = (current_end + next_start) / 2.0
        lower = current_start + min_duration
        upper = next_end - min_duration
        feasible = lower <= upper
        if feasible:
            shared_boundary = min(max(raw_boundary, lower), upper)
        else:
            shared_boundary = (current_start + next_end) / 2.0
            shared_boundary = min(max(shared_boundary, current_start + epsilon), next_end - epsilon)

        if abs(current_end - shared_boundary) > epsilon or abs(next_start - shared_boundary) > epsilon:
            overlap = max(0.0, current_end - next_start)
            gap = max(0.0, next_start - current_end)
            qa.append(
                {
                    "current_verse": current.verse_id,
                    "next_verse": next_timing.verse_id,
                    "current_end_before": round(current_end, 6),
                    "next_start_before": round(next_start, 6),
                    "shared_boundary": round(shared_boundary, 6),
                    "overlap_seconds": round(overlap, 6),
                    "gap_seconds": round(gap, 6),
                    "minimum_duration_preserved": feasible,
                }
            )
        ends[index] = shared_boundary
        starts[index + 1] = shared_boundary

    normalized = [
        VerseTiming(
            verse_id=timing.verse_id,
            start_seconds=round(starts[index], 6),
            end_seconds=round(ends[index], 6),
            text=timing.text,
            confidence=timing.confidence,
            word_count=timing.word_count,
        )
        for index, timing in enumerate(timings)
    ]
    return NormalizedBoundaryResult(timings=normalized, qa=qa)


def _log_verse_boundaries(timings: list[VerseTiming]) -> None:
    """Log every generated boundary and adjacent overlap diagnostics."""

    for timing in timings:
        LOGGER.info(
            "Verse %s\nstart=%.3f\nend=%.3f\nduration=%.3f",
            timing.verse_id,
            timing.start_seconds,
            timing.end_seconds,
            timing.duration,
        )
    for diagnostic in _overlap_diagnostics(timings):
        LOGGER.error(
            "OVERLAP\nCurrent verse %s\nCurrent end %.6f\nNext verse %s\nNext start %.6f\nOverlap %.6f seconds",
            diagnostic["current_verse"],
            diagnostic["current_end"],
            diagnostic["next_verse"],
            diagnostic["next_start"],
            diagnostic["overlap_seconds"],
        )


def _validate_generated_boundaries(timings: list[VerseTiming]) -> None:
    """Fail BUILD_INDEX before writing JSON if generated boundaries are invalid."""

    issues: list[str] = []
    previous: VerseTiming | None = None
    for timing in timings:
        if timing.start_seconds < 0 or timing.end_seconds < 0:
            issues.append(
                f"Verse {timing.verse_id} has negative timing: "
                f"start={timing.start_seconds:.6f}, end={timing.end_seconds:.6f}"
            )
        if timing.end_seconds <= timing.start_seconds:
            issues.append(
                f"Verse {timing.verse_id} is not positive duration: "
                f"start={timing.start_seconds:.6f}, end={timing.end_seconds:.6f}"
            )
        elif timing.duration < CONFIG.minimum_verse_duration_seconds:
            issues.append(
                f"Verse {timing.verse_id} is shorter than minimum duration: "
                f"duration={timing.duration:.6f}, "
                f"minimum={CONFIG.minimum_verse_duration_seconds:.6f}"
            )
        if previous is not None:
            if timing.start_seconds < previous.start_seconds:
                issues.append(
                    f"Verse {timing.verse_id} start is not increasing: "
                    f"previous start={previous.start_seconds:.6f}, start={timing.start_seconds:.6f}"
                )
            if timing.end_seconds < previous.end_seconds:
                issues.append(
                    f"Verse {timing.verse_id} end is not increasing: "
                    f"previous end={previous.end_seconds:.6f}, end={timing.end_seconds:.6f}"
                )
            if previous.end_seconds > timing.start_seconds:
                issues.append(_format_overlap_issue(previous, timing))
        previous = timing
    if issues:
        raise IndexBuildError("Generated verse boundaries failed internal validation:\n" + "\n".join(issues))


def _overlap_diagnostics(timings: list[VerseTiming]) -> list[dict[str, float | str]]:
    diagnostics: list[dict[str, float | str]] = []
    for current, next_timing in zip(timings, timings[1:]):
        if current.end_seconds > next_timing.start_seconds:
            diagnostics.append(
                {
                    "current_verse": current.verse_id,
                    "current_end": round(current.end_seconds, 6),
                    "next_verse": next_timing.verse_id,
                    "next_start": round(next_timing.start_seconds, 6),
                    "overlap_seconds": round(current.end_seconds - next_timing.start_seconds, 6),
                }
            )
    return diagnostics


def _format_overlap_issue(current: VerseTiming, next_timing: VerseTiming) -> str:
    overlap = current.end_seconds - next_timing.start_seconds
    return (
        f"Verse {current.verse_id}\n"
        f"end = {current.end_seconds:.6f}\n"
        f"Verse {next_timing.verse_id}\n"
        f"start = {next_timing.start_seconds:.6f}\n"
        f"Overlap = {overlap:.6f} seconds"
    )


def _tokenize(text: str) -> list[str]:
    """Tokenize verse text into comparable words."""

    return re.findall(r"[a-z0-9']+", _normalize_text(text))


def _normalize_word(word: str) -> str:
    """Normalize a word for comparing official text to transcript words."""

    tokens = _tokenize(word)
    return tokens[0] if tokens else ""


def _normalized_tokens(text: str) -> list[str]:
    """Return normalized comparable tokens for text."""

    return [_normalize_word(token) for token in _tokenize(text) if _normalize_word(token)]


def _normalize_text(text: str) -> str:
    """Normalize text before token comparison."""

    normalized = unicodedata.normalize("NFKD", text.lower())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = normalized.replace("\u2018", "'").replace("\u2019", "'").replace("\u02bc", "'")
    normalized = normalized.replace("\u201c", " ").replace("\u201d", " ").replace('"', " ")
    normalized = re.sub(r"[^\w\s']", " ", normalized, flags=re.UNICODE)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _candidate_lengths(query_tokens: list[str]) -> list[int]:
    upper = min(BOUNDARY_TOKEN_MAX, len(query_tokens))
    lower = min(BOUNDARY_TOKEN_MIN, upper)
    if upper < BOUNDARY_TOKEN_MIN:
        return list(range(upper, 0, -1))
    return list(range(upper, lower - 1, -1))


def _best_exact_sequence(
    words: list[str],
    query_tokens: list[str],
    lengths: list[int],
    start: int,
    end: int,
) -> tuple[int, int] | None:
    for index in range(start, max(start, end)):
        for length in lengths:
            if index + length > end:
                continue
            if words[index : index + length] == query_tokens[:length]:
                return index, length
    return None


def _best_fuzzy_sequence(
    words: list[str],
    query_tokens: list[str],
    lengths: list[int],
    start: int,
    end: int,
) -> tuple[int, int, float] | None:
    best: tuple[int, int, float] | None = None
    for index in range(start, max(start, end)):
        for length in lengths:
            if index + length > end:
                continue
            score = _similarity(query_tokens[:length], words[index : index + length])
            if best is None or score > best[2] or (score == best[2] and index < best[0]):
                best = (index, length, score)
    return best


def _similarity(expected: list[str], actual: list[str]) -> float:
    return SequenceMatcher(None, " ".join(expected), " ".join(actual)).ratio()


def _aligned_text(words: list[dict[str, Any]], start: int, length: int) -> str:
    if not words:
        return ""
    start = max(0, min(start, len(words) - 1))
    end = min(len(words), start + max(1, length))
    return " ".join(str(word.get("word", "")) for word in words[start:end]).strip()


def _next_matched_start(
    matches: list[BoundaryMatch],
    index: int,
    current_start: int,
) -> int | None:
    for next_match in matches[index + 1 :]:
        if next_match.start_index is not None and next_match.start_index > current_start:
            return next_match.start_index
    return None


def _boundary_match_to_qa(match: BoundaryMatch) -> dict[str, Any]:
    return {
        "verse_number": match.verse_number,
        "expected_opening_text": match.expected_opening_text,
        "closest_aligned_text": match.closest_aligned_text,
        "similarity_score": round(match.similarity_score, 6),
        "reason": match.reason,
    }


def _average_score(words: list[dict[str, Any]]) -> float:
    """Return average WhisperX confidence score for aligned verse words."""

    scores = [float(word.get("score", 0.0) or 0.0) for word in words]
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 6)


def _chapter_index_path(context: PipelineContext) -> Path:
    """Return ``indexes/{book}/{chapter}.json`` for a pipeline context."""

    return CONFIG.indexes_dir / context.book.replace(" ", "_") / f"{context.chapter}.json"


if __name__ == "__main__":
    raise SystemExit(main())
