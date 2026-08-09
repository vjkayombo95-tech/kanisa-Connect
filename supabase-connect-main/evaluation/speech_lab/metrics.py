from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from statistics import median

from .models import Transcript, VerseBoundary, WordTiming


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    value = re.sub(r"[^\w\s']", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


def levenshtein(reference: list[str] | str, hypothesis: list[str] | str) -> int:
    ref = list(reference)
    hyp = list(hypothesis)
    previous = list(range(len(hyp) + 1))
    for i, ref_item in enumerate(ref, start=1):
        current = [i]
        for j, hyp_item in enumerate(hyp, start=1):
            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + (0 if ref_item == hyp_item else 1),
                )
            )
        previous = current
    return previous[-1]


class WERCalculator:
    def calculate(self, reference: str, hypothesis: str) -> float:
        ref_words = normalize_text(reference).split()
        hyp_words = normalize_text(hypothesis).split()
        if not ref_words:
            return 0.0 if not hyp_words else 1.0
        return levenshtein(ref_words, hyp_words) / len(ref_words)


class CERCalculator:
    def calculate(self, reference: str, hypothesis: str) -> float:
        ref_chars = normalize_text(reference).replace(" ", "")
        hyp_chars = normalize_text(hypothesis).replace(" ", "")
        if not ref_chars:
            return 0.0 if not hyp_chars else 1.0
        return levenshtein(ref_chars, hyp_chars) / len(ref_chars)


def token_similarity_score(reference: str, hypothesis: str) -> float | None:
    ref_words = normalize_text(reference).split()
    hyp_words = normalize_text(hypothesis).split()
    if not ref_words and not hyp_words:
        return 1.0
    if not ref_words or not hyp_words:
        return 0.0
    distance = levenshtein(ref_words, hyp_words)
    return 1.0 - distance / max(len(ref_words), len(hyp_words))


def word_order_similarity(reference: str, hypothesis: str) -> float | None:
    ref_words = normalize_text(reference).split()
    hyp_words = normalize_text(hypothesis).split()
    if not ref_words and not hyp_words:
        return 1.0
    if not ref_words or not hyp_words:
        return 0.0
    hyp_positions: dict[str, list[int]] = {}
    for index, word in enumerate(hyp_words):
        hyp_positions.setdefault(word, []).append(index)
    sequence: list[int] = []
    for word in ref_words:
        positions = hyp_positions.get(word)
        if positions:
            sequence.append(positions.pop(0))
    if not sequence:
        return 0.0
    longest = _longest_increasing_subsequence_length(sequence)
    return longest / len(ref_words)


def _longest_increasing_subsequence_length(values: list[int]) -> int:
    tails: list[int] = []
    for value in values:
        left = 0
        right = len(tails)
        while left < right:
            middle = (left + right) // 2
            if tails[middle] < value:
                left = middle + 1
            else:
                right = middle
        if left == len(tails):
            tails.append(value)
        else:
            tails[left] = value
    return len(tails)


def spoken_reference_text(candidate: Transcript) -> tuple[str | None, str]:
    if not candidate.verses:
        return None, "legacy_unknown"
    modes = {getattr(verse, "text_reference_mode", "legacy_unknown") for verse in candidate.verses}
    if modes == {"exact_spoken"} and all(getattr(verse, "spoken_reference_text", None) for verse in candidate.verses):
        return " ".join(str(getattr(verse, "spoken_reference_text")).strip() for verse in sorted(candidate.verses, key=lambda item: int(item.verse))), "exact_spoken"
    if "exact_spoken" in modes:
        return None, "canonical_fallback"
    return None, "canonical_fallback"


class BoundaryAccuracyCalculator:
    def __init__(self, tolerance_ms: int = 250) -> None:
        self.tolerance_ms = tolerance_ms

    def calculate(self, reference: list[VerseBoundary], hypothesis: list[VerseBoundary]) -> float:
        if not reference:
            return 0.0
        by_verse = {int(item.verse): item for item in hypothesis}
        correct = 0
        for expected in reference:
            actual = by_verse.get(int(expected.verse))
            if not actual:
                continue
            start_ok = abs(actual.start_ms - expected.start_ms) <= self.tolerance_ms
            end_ok = abs(actual.end_ms - expected.end_ms) <= self.tolerance_ms
            correct += int(start_ok and end_ok)
        return correct / len(reference)


class AlignmentAccuracyCalculator:
    def __init__(self, tolerance_ms: int = 250) -> None:
        self.tolerance_ms = tolerance_ms

    def calculate(self, reference: list[WordTiming], hypothesis: list[WordTiming]) -> float:
        reference_with_time = [item for item in reference if item.start_ms is not None and item.end_ms is not None]
        hypothesis_with_time = [item for item in hypothesis if item.start_ms is not None and item.end_ms is not None]
        if not reference_with_time:
            return 0.0
        correct = 0
        for expected, actual in zip(reference_with_time, hypothesis_with_time):
            if normalize_text(expected.word) != normalize_text(actual.word):
                continue
            start_ok = abs((actual.start_ms or 0) - (expected.start_ms or 0)) <= self.tolerance_ms
            end_ok = abs((actual.end_ms or 0) - (expected.end_ms or 0)) <= self.tolerance_ms
            correct += int(start_ok and end_ok)
        return correct / len(reference_with_time)


def average_word_confidence(words: list[WordTiming]) -> float | None:
    values = [item.confidence for item in words if item.confidence is not None]
    return sum(values) / len(values) if values else None


def verse_confidence(boundaries: list[VerseBoundary]) -> float | None:
    values = [item.confidence for item in boundaries if item.confidence is not None]
    return sum(values) / len(values) if values else None


BOUNDARY_TOLERANCES_MS = (250, 500, 1000, 2000)


def verse_timing_diagnostics(golden: Transcript, candidate: Transcript) -> dict[str, object]:
    reference_by_verse = {int(boundary.verse): boundary for boundary in golden.verse_boundaries}
    candidate_by_verse: dict[int, VerseBoundary] = {}
    duplicated: set[int] = set()
    for boundary in candidate.verse_boundaries:
        verse_number = int(boundary.verse)
        if verse_number in candidate_by_verse:
            duplicated.add(verse_number)
        else:
            candidate_by_verse[verse_number] = boundary
    candidate_verse_payloads = {int(verse.verse): verse for verse in candidate.verses}
    differences: list[dict[str, float | int]] = []
    per_verse_diagnostics: list[dict[str, object]] = []
    start_drifts: list[float] = []
    end_drifts: list[float] = []
    for verse, reference in reference_by_verse.items():
        candidate_boundary = candidate_by_verse.get(verse)
        candidate_verse = candidate_verse_payloads.get(verse)
        if not candidate_boundary:
            per_verse_diagnostics.append(
                _missing_boundary_diagnostic(verse, reference, candidate_verse)
            )
            continue
        start_drift = candidate_boundary.start_ms - reference.start_ms
        end_drift = candidate_boundary.end_ms - reference.end_ms
        start_drifts.append(start_drift)
        end_drifts.append(end_drift)
        tolerance_results = _tolerance_results(start_drift, end_drift)
        differences.append(
            {
                "verse": verse,
                "reference_start_ms": reference.start_ms,
                "candidate_start_ms": candidate_boundary.start_ms,
                "start_drift_ms": start_drift,
                "reference_end_ms": reference.end_ms,
                "candidate_end_ms": candidate_boundary.end_ms,
                "end_drift_ms": end_drift,
            }
        )
        per_verse_diagnostics.append(
            {
                "verse": verse,
                "alignment_status": candidate_verse.status if candidate_verse else "aligned",
                "coverage": _candidate_coverage(candidate_verse),
                "matched_tokens": candidate_verse.matched_tokens if candidate_verse else None,
                "reference_tokens": candidate_verse.reference_tokens if candidate_verse else None,
                "candidate_start_ms": candidate_boundary.start_ms,
                "golden_start_ms": reference.start_ms,
                "start_drift_ms": start_drift,
                "candidate_end_ms": candidate_boundary.end_ms,
                "golden_end_ms": reference.end_ms,
                "end_drift_ms": end_drift,
                "passes_500_ms": tolerance_results["500"]["combined"],
                "passes_1000_ms": tolerance_results["1000"]["combined"],
                "passes_2000_ms": tolerance_results["2000"]["combined"],
                "failure_reason": _boundary_failure_reason(start_drift, end_drift, 250),
            }
        )
    missing = sorted(set(reference_by_verse) - set(candidate_by_verse))
    unresolved = sorted(int(verse.verse) for verse in candidate.verses if verse.status not in _ALIGNED_STATUSES)
    aligned_verses = [verse for verse in candidate.verses if verse.status in _ALIGNED_STATUSES]
    coverage_values = [
        verse.matched_tokens / verse.reference_tokens
        for verse in aligned_verses
        if verse.reference_tokens
    ]
    return {
        "mean_start_drift_ms": _mean_abs(start_drifts),
        "median_start_drift_ms": _median_abs(start_drifts),
        "mean_end_drift_ms": _mean_abs(end_drifts),
        "median_end_drift_ms": _median_abs(end_drifts),
        "per_verse_timing_differences": differences,
        "missing_verses": missing,
        "duplicated_verses": sorted(duplicated),
        "unresolved_verses": unresolved,
        "alignment_coverage": sum(coverage_values) / len(coverage_values) if coverage_values else None,
        "boundary_accuracy_by_tolerance": boundary_accuracy_by_tolerance(reference_by_verse, candidate_by_verse),
        "per_verse_boundary_diagnostics": per_verse_diagnostics,
        "verse_resolution_rate": verse_resolution_rate(reference_by_verse, candidate_by_verse),
        "high_confidence_alignment_rate": high_confidence_alignment_rate(aligned_verses),
    }


_ALIGNED_STATUSES = {"aligned", "recovered_between_neighbors"}


def boundary_accuracy_by_tolerance(
    reference_by_verse: dict[int, VerseBoundary],
    candidate_by_verse: dict[int, VerseBoundary],
) -> dict[str, dict[str, float]]:
    denominator = len(reference_by_verse)
    if not denominator:
        return {str(tolerance): {"start": 0.0, "end": 0.0, "combined": 0.0} for tolerance in BOUNDARY_TOLERANCES_MS}
    results: dict[str, dict[str, float]] = {}
    for tolerance in BOUNDARY_TOLERANCES_MS:
        start_correct = 0
        end_correct = 0
        combined_correct = 0
        for verse, reference in reference_by_verse.items():
            candidate = candidate_by_verse.get(verse)
            if not candidate:
                continue
            start_ok = abs(candidate.start_ms - reference.start_ms) <= tolerance
            end_ok = abs(candidate.end_ms - reference.end_ms) <= tolerance
            start_correct += int(start_ok)
            end_correct += int(end_ok)
            combined_correct += int(start_ok and end_ok)
        results[str(tolerance)] = {
            "start": start_correct / denominator,
            "end": end_correct / denominator,
            "combined": combined_correct / denominator,
            "start_correct": start_correct,
            "end_correct": end_correct,
            "combined_correct": combined_correct,
            "denominator": denominator,
        }
    return results


def verse_resolution_rate(
    reference_by_verse: dict[int, VerseBoundary],
    candidate_by_verse: dict[int, VerseBoundary],
) -> float | None:
    if not reference_by_verse:
        return None
    return len(set(reference_by_verse) & set(candidate_by_verse)) / len(reference_by_verse)


def high_confidence_alignment_rate(candidate_verses) -> float | None:
    aligned = [verse for verse in candidate_verses if verse.reference_tokens]
    if not aligned:
        return None
    high_confidence = [
        verse
        for verse in aligned
        if verse.reference_tokens and (verse.matched_tokens / verse.reference_tokens) >= 0.5
    ]
    return len(high_confidence) / len(aligned)


def _tolerance_results(start_drift: float, end_drift: float) -> dict[str, dict[str, bool]]:
    return {
        str(tolerance): {
            "start": abs(start_drift) <= tolerance,
            "end": abs(end_drift) <= tolerance,
            "combined": abs(start_drift) <= tolerance and abs(end_drift) <= tolerance,
        }
        for tolerance in BOUNDARY_TOLERANCES_MS
    }


def _missing_boundary_diagnostic(verse: int, reference: VerseBoundary, candidate_verse) -> dict[str, object]:
    return {
        "verse": verse,
        "alignment_status": candidate_verse.status if candidate_verse else "missing",
        "coverage": _candidate_coverage(candidate_verse),
        "matched_tokens": candidate_verse.matched_tokens if candidate_verse else None,
        "reference_tokens": candidate_verse.reference_tokens if candidate_verse else None,
        "candidate_start_ms": None,
        "golden_start_ms": reference.start_ms,
        "start_drift_ms": None,
        "candidate_end_ms": None,
        "golden_end_ms": reference.end_ms,
        "end_drift_ms": None,
        "passes_500_ms": False,
        "passes_1000_ms": False,
        "passes_2000_ms": False,
        "failure_reason": candidate_verse.failure_reason if candidate_verse and candidate_verse.failure_reason else "missing candidate boundary",
    }


def _candidate_coverage(candidate_verse) -> float | None:
    if not candidate_verse or not candidate_verse.reference_tokens:
        return None
    return candidate_verse.matched_tokens / candidate_verse.reference_tokens


def _boundary_failure_reason(start_drift: float, end_drift: float, tolerance_ms: int) -> str:
    start_ok = abs(start_drift) <= tolerance_ms
    end_ok = abs(end_drift) <= tolerance_ms
    if start_ok and end_ok:
        return ""
    if not start_ok and not end_ok:
        return f"start and end drift exceed {tolerance_ms} ms"
    if not start_ok:
        return f"start drift exceeds {tolerance_ms} ms"
    return f"end drift exceeds {tolerance_ms} ms"


def _mean_abs(values: list[float]) -> float | None:
    return sum(abs(value) for value in values) / len(values) if values else None


def _median_abs(values: list[float]) -> float | None:
    return median(abs(value) for value in values) if values else None


@dataclass
class MetricCalculators:
    wer: WERCalculator = WERCalculator()
    cer: CERCalculator = CERCalculator()
    boundary_accuracy: BoundaryAccuracyCalculator = BoundaryAccuracyCalculator()
    alignment_accuracy: AlignmentAccuracyCalculator = AlignmentAccuracyCalculator()

    def calculate(self, golden: Transcript, candidate: Transcript):
        from .models import EvaluationMetrics
        diagnostics = verse_timing_diagnostics(golden, candidate)
        canonical_wer = self.wer.calculate(golden.text, candidate.text)
        canonical_cer = self.cer.calculate(golden.text, candidate.text)
        spoken_text, text_reference_mode = spoken_reference_text(candidate)
        spoken_wer = self.wer.calculate(spoken_text, candidate.text) if spoken_text else None
        spoken_cer = self.cer.calculate(spoken_text, candidate.text) if spoken_text else None

        return EvaluationMetrics(
            wer=canonical_wer,
            cer=canonical_cer,
            boundary_accuracy=self.boundary_accuracy.calculate(golden.verse_boundaries, candidate.verse_boundaries),
            alignment_accuracy=self.alignment_accuracy.calculate(golden.words, candidate.words),
            average_word_confidence=average_word_confidence(candidate.words),
            verse_confidence=verse_confidence(candidate.verse_boundaries),
            output_stability=None,
            canonical_text_wer=canonical_wer,
            canonical_text_cer=canonical_cer,
            spoken_reference_wer=spoken_wer,
            spoken_reference_cer=spoken_cer,
            canonical_token_similarity=token_similarity_score(golden.text, candidate.text),
            word_order_similarity=word_order_similarity(golden.text, candidate.text),
            semantic_similarity="unavailable",
            text_reference_mode=text_reference_mode,
            text_metric_warning=(
                None
                if spoken_text
                else "WER and CER may include differences between the recording edition and the canonical Bible text."
            ),
            verse_resolution_rate=diagnostics["verse_resolution_rate"],
            token_alignment_coverage=diagnostics["alignment_coverage"],
            high_confidence_alignment_rate=diagnostics["high_confidence_alignment_rate"],
            combined_boundary_accuracy_1000ms=diagnostics["boundary_accuracy_by_tolerance"].get("1000", {}).get("combined"),
            combined_boundary_accuracy_2000ms=diagnostics["boundary_accuracy_by_tolerance"].get("2000", {}).get("combined"),
            boundary_accuracy_by_tolerance=diagnostics["boundary_accuracy_by_tolerance"],
            mean_start_drift_ms=diagnostics["mean_start_drift_ms"],
            median_start_drift_ms=diagnostics["median_start_drift_ms"],
            mean_end_drift_ms=diagnostics["mean_end_drift_ms"],
            median_end_drift_ms=diagnostics["median_end_drift_ms"],
            per_verse_timing_differences=diagnostics["per_verse_timing_differences"],
            missing_verses=diagnostics["missing_verses"],
            duplicated_verses=diagnostics["duplicated_verses"],
            unresolved_verses=diagnostics["unresolved_verses"],
            alignment_coverage=diagnostics["alignment_coverage"],
            per_verse_boundary_diagnostics=diagnostics["per_verse_boundary_diagnostics"],
        )
