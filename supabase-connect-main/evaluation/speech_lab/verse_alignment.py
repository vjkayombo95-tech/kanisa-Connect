from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from statistics import mean

from .metrics import levenshtein
from .models import CandidateVerse, Introduction, Transcript, VerseBoundary, WordTiming


@dataclass(frozen=True)
class CanonicalVerse:
    verse: int
    text: str


@dataclass(frozen=True)
class VerseAlignmentThresholds:
    token_match_threshold: float = 0.74
    compound_token_match_threshold: float = 0.82
    minimum_aligned_tokens: int = 2
    short_verse_minimum_aligned_tokens: int = 1
    minimum_verse_coverage: float = 0.35
    short_verse_minimum_coverage: float = 0.5
    short_verse_token_count: int = 4
    maximum_internal_gap_ms: int = 30000
    recovery_character_similarity: float = 0.55
    recovery_minimum_coverage: float = 0.24


@dataclass(frozen=True)
class _Token:
    text: str
    verse: int | None
    word_index: int | None = None


@dataclass(frozen=True)
class _AlignmentPair:
    reference_index: int | None
    recognized_index: int | None
    score: float


def align_transcript_to_verses(
    transcript: Transcript,
    canonical_verses: list[CanonicalVerse],
    *,
    thresholds: VerseAlignmentThresholds = VerseAlignmentThresholds(),
) -> Transcript:
    reference_tokens = _canonical_tokens(canonical_verses)
    recognized_tokens = _recognized_tokens(transcript.words)
    pairs = _align_tokens(reference_tokens, recognized_tokens)
    recognized_by_reference = {
        pair.reference_index: pair
        for pair in pairs
        if pair.reference_index is not None
        and pair.recognized_index is not None
        and pair.score >= thresholds.token_match_threshold
    }

    candidate_verses: list[CandidateVerse] = []
    verse_boundaries: list[VerseBoundary] = []
    words = [WordTiming(**word.__dict__) for word in transcript.words]
    for canonical in canonical_verses:
        verse_reference_indices = [
            index
            for index, token in enumerate(reference_tokens)
            if token.verse == canonical.verse
        ]
        matched_pairs = [
            recognized_by_reference[index]
            for index in verse_reference_indices
            if index in recognized_by_reference
        ]
        matched_word_indices = sorted(
            {
                recognized_tokens[pair.recognized_index].word_index
                for pair in matched_pairs
                if pair.recognized_index is not None
                and recognized_tokens[pair.recognized_index].word_index is not None
            }
        )
        reference_count = len(verse_reference_indices)
        matched_count = len(matched_pairs)
        coverage = matched_count / reference_count if reference_count else 0.0
        score = mean(pair.score for pair in matched_pairs) if matched_pairs else 0.0
        status, failure_reason, largest_gap = _verse_status(matched_word_indices, reference_count, coverage, transcript.words, thresholds)
        start_ms = None
        end_ms = None
        if status == "aligned":
            aligned_words = [transcript.words[index] for index in matched_word_indices]
            starts = [word.start_ms for word in aligned_words if word.start_ms is not None]
            ends = [word.end_ms for word in aligned_words if word.end_ms is not None]
            if starts and ends:
                start_ms = min(starts)
                end_ms = max(ends)
                for word_index in matched_word_indices:
                    words[word_index].verse = canonical.verse
                verse_boundaries.append(
                    VerseBoundary(
                        verse=canonical.verse,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        confidence=coverage,
                    )
                )
            else:
                status = "unresolved"
                failure_reason = "matched words have no usable timestamps"
        candidate_verses.append(
            CandidateVerse(
                verse=canonical.verse,
                text=canonical.text,
                canonical_verse_text=canonical.text,
                text_reference_mode="canonical_fallback",
                spoken_text_review_status="pending",
                start_ms=start_ms,
                end_ms=end_ms,
                alignment_score=score,
                matched_tokens=matched_count,
                reference_tokens=reference_count,
                status=status,
                failure_reason=failure_reason,
                largest_internal_gap_ms=largest_gap,
            )
        )

    candidate_verses, verse_boundaries, words = _recover_unresolved_between_neighbors(
        candidate_verses,
        canonical_verses,
        transcript.words,
        words,
        verse_boundaries,
        thresholds,
    )

    metadata = dict(transcript.metadata)
    introductions = detect_introductions(transcript.words, candidate_verses)
    metadata["verse_alignment"] = {
        "algorithm": "global token sequence alignment with fuzzy substitution scoring plus local neighbor-constrained recovery",
        "token_match_threshold": thresholds.token_match_threshold,
        "compound_token_match_threshold": thresholds.compound_token_match_threshold,
        "minimum_aligned_tokens": thresholds.minimum_aligned_tokens,
        "short_verse_minimum_aligned_tokens": thresholds.short_verse_minimum_aligned_tokens,
        "minimum_verse_coverage": thresholds.minimum_verse_coverage,
        "short_verse_minimum_coverage": thresholds.short_verse_minimum_coverage,
        "maximum_internal_gap_ms": thresholds.maximum_internal_gap_ms,
        "recovery_character_similarity": thresholds.recovery_character_similarity,
        "recovery_minimum_coverage": thresholds.recovery_minimum_coverage,
        "aligned_verses": sum(1 for verse in candidate_verses if verse.status in _ALIGNED_STATUSES),
        "recovered_verses": [verse.verse for verse in candidate_verses if verse.status == "recovered_between_neighbors"],
        "unresolved_verses": [verse.verse for verse in candidate_verses if verse.status not in _ALIGNED_STATUSES],
    }
    return Transcript(
        chapter_id=transcript.chapter_id,
        text=transcript.text,
        words=words,
        verse_boundaries=_monotonic_boundaries(verse_boundaries),
        verses=candidate_verses,
        introductions=introductions,
        metadata=metadata,
    )


def detect_introductions(words: list[WordTiming], candidate_verses: list[CandidateVerse]) -> list[Introduction]:
    first_verse = next((verse for verse in sorted(candidate_verses, key=lambda item: int(item.verse)) if verse.start_ms is not None), None)
    if first_verse is None:
        return []
    prefix_words = [
        word
        for word in words
        if word.start_ms is not None
        and word.end_ms is not None
        and word.end_ms <= first_verse.start_ms
    ]
    if not prefix_words:
        return []
    text = " ".join(word.word.strip(" .,;:!?") for word in prefix_words if word.word.strip(" .,;:!?"))
    if not text:
        return []
    intro_type = classify_introduction(text)
    return [
        Introduction(
            type=intro_type,
            text=text,
            start_ms=min(int(word.start_ms) for word in prefix_words if word.start_ms is not None),
            end_ms=max(int(word.end_ms) for word in prefix_words if word.end_ms is not None),
        )
    ]


def classify_introduction(text: str) -> str:
    normalized = normalize_token_text(text)
    if any(word in normalized for word in ("kitabu", "mwanzo", "matayo", "zaburi", "warumi")) and any(
        word in normalized for word in ("mlango", "sura", "chapter")
    ):
        return "chapter_title"
    if any(word in normalized for word in ("mahubiri", "maisha", "uumbaji", "mchungaji")):
        return "section_heading"
    if any(word in normalized for word in ("kitabu", "zaburi", "warumi", "matayo", "mwanzo")):
        return "book_title"
    return "other_non_verse"


def normalize_token_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    value = re.sub(r"[^\w\s']", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def tokenize(value: str) -> list[str]:
    normalized = normalize_token_text(value)
    return [token for token in normalized.split() if token]


def _canonical_tokens(verses: list[CanonicalVerse]) -> list[_Token]:
    return [
        _Token(token, verse.verse)
        for verse in verses
        for token in tokenize(verse.text)
    ]


def _recognized_tokens(words: list[WordTiming]) -> list[_Token]:
    tokens: list[_Token] = []
    for index, word in enumerate(words):
        for token in tokenize(word.word):
            tokens.append(_Token(token, None, index))
    return tokens


def _align_tokens(reference: list[_Token], recognized: list[_Token]) -> list[_AlignmentPair]:
    rows = len(reference) + 1
    columns = len(recognized) + 1
    costs = [[0.0] * columns for _ in range(rows)]
    moves = [[""] * columns for _ in range(rows)]
    for row in range(1, rows):
        costs[row][0] = row
        moves[row][0] = "delete"
    for column in range(1, columns):
        costs[0][column] = column
        moves[0][column] = "insert"
    for row in range(1, rows):
        for column in range(1, columns):
            similarity = token_similarity(reference[row - 1].text, recognized[column - 1].text)
            substitute_cost = 1.0 - similarity
            candidates = (
                (costs[row - 1][column - 1] + substitute_cost, "substitute"),
                (costs[row - 1][column] + 1.0, "delete"),
                (costs[row][column - 1] + 1.0, "insert"),
            )
            costs[row][column], moves[row][column] = min(candidates, key=lambda item: item[0])

    pairs: list[_AlignmentPair] = []
    row = len(reference)
    column = len(recognized)
    while row > 0 or column > 0:
        move = moves[row][column]
        if move == "substitute":
            pairs.append(
                _AlignmentPair(
                    reference_index=row - 1,
                    recognized_index=column - 1,
                    score=token_similarity(reference[row - 1].text, recognized[column - 1].text),
                )
            )
            row -= 1
            column -= 1
        elif move == "delete":
            pairs.append(_AlignmentPair(reference_index=row - 1, recognized_index=None, score=0.0))
            row -= 1
        else:
            pairs.append(_AlignmentPair(reference_index=None, recognized_index=column - 1, score=0.0))
            column -= 1
    return list(reversed(pairs))


def token_similarity(reference: str, recognized: str) -> float:
    if reference == recognized:
        return 1.0
    length = max(len(reference), len(recognized))
    if length == 0:
        return 1.0
    return 1.0 - (levenshtein(reference, recognized) / length)


_ALIGNED_STATUSES = {"aligned", "recovered_between_neighbors"}


def _verse_status(
    matched_word_indices: list[int],
    reference_count: int,
    coverage: float,
    words: list[WordTiming],
    thresholds: VerseAlignmentThresholds,
) -> tuple[str, str | None, int | None]:
    minimum_tokens = (
        thresholds.short_verse_minimum_aligned_tokens
        if reference_count <= thresholds.short_verse_token_count
        else thresholds.minimum_aligned_tokens
    )
    minimum_coverage = (
        thresholds.short_verse_minimum_coverage
        if reference_count <= thresholds.short_verse_token_count
        else thresholds.minimum_verse_coverage
    )
    largest_gap = _largest_internal_gap(matched_word_indices, words)
    if len(matched_word_indices) < minimum_tokens:
        return "low_confidence", f"matched token count below threshold {minimum_tokens}", largest_gap
    if coverage < minimum_coverage:
        return "low_confidence", f"coverage below threshold {minimum_coverage:.2f}", largest_gap
    timed_words = [words[index] for index in matched_word_indices if words[index].start_ms is not None and words[index].end_ms is not None]
    if len(timed_words) < minimum_tokens:
        return "unresolved", "matched words have insufficient timestamps", largest_gap
    if largest_gap is not None and largest_gap > thresholds.maximum_internal_gap_ms:
        return "unresolved", f"internal timestamp gap exceeds {thresholds.maximum_internal_gap_ms} ms", largest_gap
    return "aligned", None, largest_gap


def _recover_unresolved_between_neighbors(
    candidate_verses: list[CandidateVerse],
    canonical_verses: list[CanonicalVerse],
    source_words: list[WordTiming],
    output_words: list[WordTiming],
    verse_boundaries: list[VerseBoundary],
    thresholds: VerseAlignmentThresholds,
) -> tuple[list[CandidateVerse], list[VerseBoundary], list[WordTiming]]:
    by_verse = {verse.verse: verse for verse in candidate_verses}
    canonical_by_verse = {verse.verse: verse for verse in canonical_verses}
    boundaries_by_verse = {boundary.verse: boundary for boundary in verse_boundaries}
    index = 0
    while index < len(candidate_verses):
        if candidate_verses[index].status in _ALIGNED_STATUSES:
            index += 1
            continue
        block_start = index
        while index < len(candidate_verses) and candidate_verses[index].status not in _ALIGNED_STATUSES:
            index += 1
        block = candidate_verses[block_start:index]
        previous_verse = _previous_aligned(candidate_verses, block_start)
        next_verse = _next_aligned(candidate_verses, index)
        if not previous_verse or not next_verse or previous_verse.end_ms is None or next_verse.start_ms is None:
            continue
        window_indices = [
            word_index
            for word_index, word in enumerate(source_words)
            if word.start_ms is not None
            and word.end_ms is not None
            and word.start_ms >= previous_verse.end_ms
            and word.end_ms <= next_verse.start_ms
        ]
        cursor = 0
        for unresolved in block:
            canonical = canonical_by_verse[unresolved.verse]
            remaining_indices = window_indices[cursor:]
            match = _best_recovery_span(canonical, source_words, remaining_indices, thresholds)
            if not match:
                by_verse[unresolved.verse] = CandidateVerse(
                    **{
                        **unresolved.__dict__,
                        "failure_reason": unresolved.failure_reason or "no recovery span passed evidence thresholds",
                    }
                )
                continue
            start_index, end_index, score, matched_tokens, coverage = match
            matched_word_indices = remaining_indices[start_index : end_index + 1]
            largest_gap = _largest_internal_gap(matched_word_indices, source_words)
            if largest_gap is not None and largest_gap > thresholds.maximum_internal_gap_ms:
                continue
            starts = [source_words[word_index].start_ms for word_index in matched_word_indices if source_words[word_index].start_ms is not None]
            ends = [source_words[word_index].end_ms for word_index in matched_word_indices if source_words[word_index].end_ms is not None]
            if not starts or not ends:
                continue
            start_ms = min(starts)
            end_ms = max(ends)
            recovered = CandidateVerse(
                verse=unresolved.verse,
                text=unresolved.text,
                start_ms=start_ms,
                end_ms=end_ms,
                alignment_score=score,
                matched_tokens=matched_tokens,
                reference_tokens=unresolved.reference_tokens,
                status="recovered_between_neighbors",
                failure_reason=None,
                largest_internal_gap_ms=largest_gap,
            )
            by_verse[unresolved.verse] = recovered
            boundaries_by_verse[unresolved.verse] = VerseBoundary(
                verse=unresolved.verse,
                start_ms=start_ms,
                end_ms=end_ms,
                confidence=coverage,
            )
            for word_index in matched_word_indices:
                output_words[word_index].verse = unresolved.verse
            cursor += end_index + 1
    return (
        [by_verse[verse.verse] for verse in candidate_verses],
        list(boundaries_by_verse.values()),
        output_words,
    )


def _previous_aligned(verses: list[CandidateVerse], start_index: int) -> CandidateVerse | None:
    for index in range(start_index - 1, -1, -1):
        if verses[index].status in _ALIGNED_STATUSES and verses[index].end_ms is not None:
            return verses[index]
    return None


def _next_aligned(verses: list[CandidateVerse], start_index: int) -> CandidateVerse | None:
    for index in range(start_index, len(verses)):
        if verses[index].status in _ALIGNED_STATUSES and verses[index].start_ms is not None:
            return verses[index]
    return None


def _best_recovery_span(
    canonical: CanonicalVerse,
    words: list[WordTiming],
    word_indices: list[int],
    thresholds: VerseAlignmentThresholds,
) -> tuple[int, int, float, int, float] | None:
    reference_tokens = tokenize(canonical.text)
    if not reference_tokens or not word_indices:
        return None
    minimum_length = max(1, len(reference_tokens) // 4)
    maximum_length = min(len(word_indices), max(2, len(reference_tokens) * 3 + 8))
    best: tuple[int, int, float, int, float] | None = None
    best_rank: tuple[float, float, int] = (-1.0, -1.0, 0)
    canonical_normalized = normalize_token_text(canonical.text).replace(" ", "")
    for start in range(0, len(word_indices)):
        for end in range(start + minimum_length - 1, min(len(word_indices), start + maximum_length)):
            span_words = [words[index].word for index in word_indices[start : end + 1]]
            span_normalized = normalize_token_text(" ".join(span_words)).replace(" ", "")
            if not span_normalized:
                continue
            char_score = 1.0 - levenshtein(canonical_normalized, span_normalized) / max(
                len(canonical_normalized),
                len(span_normalized),
            )
            matched_tokens = _compound_matched_token_count(reference_tokens, tokenize(" ".join(span_words)), thresholds)
            coverage = matched_tokens / len(reference_tokens)
            rank = (char_score, coverage, -abs((end - start + 1) - len(reference_tokens)))
            if (
                char_score >= thresholds.recovery_character_similarity
                and coverage >= thresholds.recovery_minimum_coverage
                and matched_tokens >= _recovery_minimum_tokens(len(reference_tokens), thresholds)
                and rank > best_rank
            ):
                best = (start, end, char_score, matched_tokens, coverage)
                best_rank = rank
    return best


def _compound_matched_token_count(
    reference_tokens: list[str],
    recognized_tokens: list[str],
    thresholds: VerseAlignmentThresholds,
) -> int:
    matched = 0
    recognized_pool = list(recognized_tokens)
    for reference_index, reference in enumerate(reference_tokens):
        reference_variants = [reference]
        if reference_index + 1 < len(reference_tokens):
            reference_variants.append(reference + reference_tokens[reference_index + 1])
        best_index = None
        best_score = 0.0
        for recognized_index, recognized in enumerate(recognized_pool):
            score = max(token_similarity(variant, recognized) for variant in reference_variants)
            if reference in recognized and len(reference) >= 3:
                score = max(score, len(reference) / len(recognized))
            if score > best_score:
                best_score = score
                best_index = recognized_index
        if best_index is not None and best_score >= min(thresholds.token_match_threshold, thresholds.compound_token_match_threshold):
            matched += 1
            recognized_pool.pop(best_index)
    return matched


def _recovery_minimum_tokens(reference_count: int, thresholds: VerseAlignmentThresholds) -> int:
    return (
        thresholds.short_verse_minimum_aligned_tokens
        if reference_count <= thresholds.short_verse_token_count
        else thresholds.minimum_aligned_tokens
    )


def _largest_internal_gap(matched_word_indices: list[int], words: list[WordTiming]) -> int | None:
    timed_words = [
        words[index]
        for index in matched_word_indices
        if words[index].start_ms is not None and words[index].end_ms is not None
    ]
    largest_gap: int | None = None
    previous_end = None
    for word in timed_words:
        if previous_end is not None and word.start_ms is not None:
            gap = word.start_ms - previous_end
            largest_gap = gap if largest_gap is None else max(largest_gap, gap)
        previous_end = word.end_ms
    return largest_gap


def _monotonic_boundaries(boundaries: list[VerseBoundary]) -> list[VerseBoundary]:
    ordered = sorted(boundaries, key=lambda boundary: boundary.verse)
    monotonic: list[VerseBoundary] = []
    previous_start = -1
    previous_end = -1
    for boundary in ordered:
        if boundary.start_ms < previous_start or boundary.end_ms < previous_end or boundary.end_ms <= boundary.start_ms:
            continue
        monotonic.append(boundary)
        previous_start = boundary.start_ms
        previous_end = boundary.end_ms
    return monotonic
