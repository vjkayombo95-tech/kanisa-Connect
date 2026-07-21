import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from evaluation.speech_lab.cli import main
from evaluation.speech_lab.metrics import CERCalculator, WERCalculator, normalize_text, verse_timing_diagnostics
from evaluation.speech_lab.metrics import BoundaryAccuracyCalculator, MetricCalculators
from evaluation.speech_lab.models import Transcript, VerseBoundary, WordTiming
from evaluation.speech_lab.supabase_store import EvaluationSupabaseStore
from evaluation.speech_lab.verse_alignment import CanonicalVerse, VerseAlignmentThresholds, align_transcript_to_verses


def transcript(words):
    return Transcript(
        chapter_id="GEN_001",
        text=" ".join(word for word, _, _ in words),
        words=[WordTiming(word=word, start_ms=start, end_ms=end) for word, start, end in words],
    )


class VerseAlignmentTests(unittest.TestCase):
    def test_exact_verse_match(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1200), ("mwanzo", 1200, 1500)]),
            [CanonicalVerse(1, "Hapo mwanzo")],
        )

        self.assertEqual(aligned.verses[0].status, "aligned")
        self.assertEqual(aligned.verse_boundaries[0].start_ms, 1000)
        self.assertEqual(aligned.verse_boundaries[0].end_ms, 1500)

    def test_one_substituted_word_can_align_fuzzily(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1200), ("muanzo", 1200, 1500)]),
            [CanonicalVerse(1, "Hapo mwanzo")],
        )

        self.assertEqual(aligned.verses[0].status, "aligned")

    def test_missing_word_still_aligns_when_coverage_passes(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1200), ("mungu", 1500, 1800)]),
            [CanonicalVerse(1, "Hapo mwanzo Mungu")],
        )

        self.assertEqual(aligned.verses[0].status, "aligned")

    def test_inserted_word_does_not_break_ordered_alignment(self):
        aligned = align_transcript_to_verses(
            transcript([("title", 0, 500), ("hapo", 1000, 1200), ("mwanzo", 1200, 1500)]),
            [CanonicalVerse(1, "Hapo mwanzo")],
        )

        self.assertEqual(aligned.verse_boundaries[0].start_ms, 1000)

    def test_repeated_words_preserve_order(self):
        aligned = align_transcript_to_verses(
            transcript([("nuru", 1000, 1200), ("nuru", 1300, 1500), ("ikawa", 1500, 1700)]),
            [CanonicalVerse(1, "Nuru ikawa")],
        )

        self.assertEqual(aligned.verse_boundaries[0].start_ms, 1300)

    def test_skipped_verse_is_unresolved(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1200), ("mwanzo", 1200, 1500), ("nuru", 3000, 3300)]),
            [CanonicalVerse(1, "Hapo mwanzo"), CanonicalVerse(2, "Mungu alisema"), CanonicalVerse(3, "Nuru")],
        )

        self.assertEqual(aligned.verses[1].status, "low_confidence")

    def test_short_verse_can_align_with_one_token(self):
        aligned = align_transcript_to_verses(transcript([("nuru", 1000, 1200)]), [CanonicalVerse(1, "Nuru")])

        self.assertEqual(aligned.verses[0].status, "aligned")

    def test_chapter_title_before_verse_one_is_not_assigned(self):
        aligned = align_transcript_to_verses(
            transcript([("kitabu", 0, 400), ("cha", 400, 600), ("mwanzo", 600, 900), ("hapo", 2000, 2200)]),
            [CanonicalVerse(1, "Hapo")],
        )

        self.assertEqual(aligned.verse_boundaries[0].start_ms, 2000)

    def test_timestamp_derivation_uses_first_and_last_aligned_words(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1100), ("mwanzo", 1200, 1500), ("mungu", 1700, 2000)]),
            [CanonicalVerse(1, "Hapo mwanzo Mungu")],
        )

        self.assertEqual((aligned.verse_boundaries[0].start_ms, aligned.verse_boundaries[0].end_ms), (1000, 2000))

    def test_unresolved_verse_when_evidence_is_insufficient(self):
        aligned = align_transcript_to_verses(transcript([("tofauti", 1000, 1200)]), [CanonicalVerse(1, "Hapo mwanzo Mungu")])

        self.assertEqual(aligned.verses[0].status, "low_confidence")
        self.assertEqual(aligned.verse_boundaries, [])

    def test_monotonic_verse_boundaries(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1200), ("mwanzo", 1200, 1500), ("nuru", 2000, 2300)]),
            [CanonicalVerse(1, "Hapo mwanzo"), CanonicalVerse(2, "Nuru")],
        )

        self.assertLess(aligned.verse_boundaries[0].end_ms, aligned.verse_boundaries[1].start_ms)

    def test_json_serialization_round_trip(self):
        aligned = align_transcript_to_verses(transcript([("hapo", 1000, 1200)]), [CanonicalVerse(1, "Hapo")])
        payload = json.loads(json.dumps(aligned.to_dict()))
        restored = Transcript.from_dict(payload)

        self.assertEqual(restored.verses[0].verse, 1)
        self.assertEqual(restored.verse_boundaries[0].verse, 1)

    def test_supabase_golden_reference_loading_shape(self):
        store = EvaluationSupabaseStore("https://example.supabase.co", "secret")

        class Response:
            status_code = 200
            text = json.dumps(
                [
                    {
                        "reference_payload": {
                            "chapter_id": "GEN_001",
                            "text": "Hapo mwanzo",
                            "words": [],
                            "verse_boundaries": [{"verse": 1, "start_ms": 1000, "end_ms": 2000, "confidence": None}],
                            "metadata": {},
                        }
                    }
                ]
            )

        store.session.request = Mock(return_value=Response())

        self.assertEqual(store.load_golden_reference("GEN_001").verse_boundaries[0].verse, 1)

    def test_wer_cer_normalization_consistency(self):
        reference = "Hapo, mwanzo Mungu"
        hypothesis = "hapo mwanzo mungu"

        self.assertEqual(normalize_text(reference), normalize_text(hypothesis))
        self.assertEqual(WERCalculator().calculate(reference, hypothesis), 0)
        self.assertEqual(CERCalculator().calculate(reference, hypothesis), 0)

    def test_timing_diagnostics_report_missing_duplicate_unresolved_and_drift(self):
        golden = Transcript(
            chapter_id="GEN_001",
            text="",
            verse_boundaries=[VerseBoundary(1, 1000, 2000), VerseBoundary(2, 3000, 4000)],
        )
        candidate = Transcript(
            chapter_id="GEN_001",
            text="",
            verse_boundaries=[VerseBoundary(1, 1200, 2300), VerseBoundary(1, 1300, 2400)],
            verses=[],
        )

        diagnostics = verse_timing_diagnostics(golden, candidate)

        self.assertEqual(diagnostics["missing_verses"], [2])
        self.assertEqual(diagnostics["duplicated_verses"], [1])
        self.assertEqual(diagnostics["mean_start_drift_ms"], 200)

    def test_alignment_accuracy_is_deprecated_word_timing_metric(self):
        golden = Transcript(
            chapter_id="GEN_001",
            text="Hapo",
            words=[],
            verse_boundaries=[VerseBoundary(1, 1000, 2000)],
        )
        candidate = Transcript(
            chapter_id="GEN_001",
            text="Hapo",
            words=[WordTiming("Hapo", 1000, 2000, verse=1)],
            verse_boundaries=[VerseBoundary(1, 1000, 2000)],
            verses=[],
        )

        metrics = MetricCalculators().calculate(golden, candidate)

        self.assertEqual(metrics.alignment_accuracy, 0)
        self.assertTrue(metrics.alignment_accuracy_deprecated)
        self.assertIn("word-level timing", metrics.alignment_accuracy_description)

    def test_replacement_verse_level_metrics_are_populated(self):
        golden = Transcript(
            chapter_id="GEN_001",
            text="Hapo mwanzo",
            verse_boundaries=[VerseBoundary(1, 1000, 2000), VerseBoundary(2, 3000, 4000)],
        )
        candidate = Transcript(
            chapter_id="GEN_001",
            text="Hapo mwanzo",
            verse_boundaries=[VerseBoundary(1, 1000, 2000), VerseBoundary(2, 3500, 4500)],
            verses=[
                type("Verse", (), {"verse": 1, "status": "aligned", "matched_tokens": 2, "reference_tokens": 2})(),
                type("Verse", (), {"verse": 2, "status": "recovered_between_neighbors", "matched_tokens": 1, "reference_tokens": 2})(),
            ],
        )

        metrics = MetricCalculators().calculate(golden, candidate)

        self.assertEqual(metrics.verse_resolution_rate, 1)
        self.assertEqual(metrics.token_alignment_coverage, 0.75)
        self.assertEqual(metrics.high_confidence_alignment_rate, 1)
        self.assertEqual(metrics.combined_boundary_accuracy_1000ms, 1)

    def test_boundary_tolerance_uses_milliseconds(self):
        reference = [VerseBoundary(1, 1000, 2000)]
        candidate = [VerseBoundary(1, 1250, 2250)]

        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=250).calculate(reference, candidate), 1)
        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=249).calculate(reference, candidate), 0)

    def test_exact_boundary_match_passes(self):
        reference = [VerseBoundary(1, 1000, 2000)]

        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=250).calculate(reference, reference), 1)

    def test_500_ms_drift_boundary(self):
        reference = [VerseBoundary(1, 1000, 2000)]
        candidate = [VerseBoundary(1, 1500, 2500)]

        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=500).calculate(reference, candidate), 1)
        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=250).calculate(reference, candidate), 0)

    def test_1000_ms_drift_boundary(self):
        reference = [VerseBoundary(1, 1000, 2000)]
        candidate = [VerseBoundary(1, 2000, 3000)]

        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=1000).calculate(reference, candidate), 1)
        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=500).calculate(reference, candidate), 0)

    def test_seconds_versus_milliseconds_regression(self):
        reference = [VerseBoundary(1, 1000, 2000)]
        candidate_seconds_like = [VerseBoundary(1, 1, 2)]

        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=250).calculate(reference, candidate_seconds_like), 0)

    def test_aligned_status_inclusion_for_unresolved_diagnostics(self):
        golden = Transcript(chapter_id="GEN_001", text="", verse_boundaries=[VerseBoundary(1, 1000, 2000)])
        candidate = Transcript(
            chapter_id="GEN_001",
            text="",
            verse_boundaries=[VerseBoundary(1, 1000, 2000)],
            verses=[],
        )

        diagnostics = verse_timing_diagnostics(golden, candidate)

        self.assertEqual(diagnostics["missing_verses"], [])

    def test_string_and_integer_verse_numbers_match(self):
        reference = [VerseBoundary(1, 1000, 2000)]
        candidate = [VerseBoundary("1", 1000, 2000)]

        self.assertEqual(BoundaryAccuracyCalculator(tolerance_ms=250).calculate(reference, candidate), 1)

    def test_unresolved_verse_between_neighbors_can_recover(self):
        aligned = align_transcript_to_verses(
            transcript(
                [
                    ("hapo", 1000, 1200),
                    ("mwanzo", 1200, 1500),
                    ("mungu", 1600, 1800),
                    ("akasema", 1800, 2100),
                    ("nuru", 2200, 2500),
                ]
            ),
            [CanonicalVerse(1, "Hapo mwanzo"), CanonicalVerse(2, "Mungu alisema"), CanonicalVerse(3, "Nuru")],
            thresholds=VerseAlignmentThresholds(short_verse_minimum_coverage=0.75),
        )

        self.assertEqual(aligned.verses[1].status, "recovered_between_neighbors")

    def test_consecutive_short_verses_are_not_absorbed(self):
        aligned = align_transcript_to_verses(
            transcript([("moja", 1000, 1200), ("mbili", 1400, 1600), ("tatu", 1800, 2000)]),
            [CanonicalVerse(1, "Moja"), CanonicalVerse(2, "Mbili"), CanonicalVerse(3, "Tatu")],
        )

        self.assertEqual([boundary.verse for boundary in aligned.verse_boundaries], [1, 2, 3])

    def test_neighboring_verse_word_absorption_leaves_low_confidence(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1200), ("mwanzo", 1200, 1500), ("nuru", 1600, 1800)]),
            [CanonicalVerse(1, "Hapo mwanzo nuru"), CanonicalVerse(2, "Mungu alisema")],
        )

        self.assertEqual(aligned.verses[1].status, "low_confidence")

    def test_monotonic_timestamps_after_recovery(self):
        aligned = align_transcript_to_verses(
            transcript([("hapo", 1000, 1200), ("mwanzo", 1300, 1500), ("mungu", 1700, 1900), ("nuru", 2200, 2400)]),
            [CanonicalVerse(1, "Hapo mwanzo"), CanonicalVerse(2, "Mungu alisema"), CanonicalVerse(3, "Nuru")],
        )

        starts = [boundary.start_ms for boundary in aligned.verse_boundaries]
        self.assertEqual(starts, sorted(starts))

    def test_cli_align_verses_writes_output(self):
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "raw.json"
            output_path = Path(directory) / "aligned.json"
            input_path.write_text(
                json.dumps(
                    Transcript(
                        chapter_id="GEN_001",
                        text="Hapo mwanzo",
                        words=[WordTiming("Hapo", 1000, 1200), WordTiming("mwanzo", 1200, 1500)],
                    ).to_dict()
                ),
                encoding="utf-8",
            )
            argv = [
                "cli",
                "align-verses",
                "--input",
                str(input_path),
                "--chapter",
                "GEN_001",
                "--supabase",
                "--output",
                str(output_path),
            ]

            with patch.object(sys, "argv", argv), patch(
                "evaluation.speech_lab.cli.load_canonical_verses_from_supabase",
                return_value=[CanonicalVerse(1, "Hapo mwanzo")],
            ):
                exit_code = main()

            self.assertEqual(exit_code, 0)
            self.assertEqual(json.loads(output_path.read_text(encoding="utf-8"))["verses"][0]["status"], "aligned")


if __name__ == "__main__":
    unittest.main()
