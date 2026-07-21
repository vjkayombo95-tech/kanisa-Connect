import tempfile
import unittest
from pathlib import Path

from evaluation.speech_lab.cleanup import audit_cleanup
from evaluation.speech_lab.metrics import MetricCalculators
from evaluation.speech_lab.models import CandidateVerse, Introduction, Transcript, VerseBoundary, WordTiming
from evaluation.speech_lab.spoken_review import REVIEW_COLUMNS, validate_review_workbook, write_xlsx
from evaluation.speech_lab.verse_alignment import CanonicalVerse, align_transcript_to_verses


class NextPhaseFrameworkTests(unittest.TestCase):
    def test_chapter_title_before_verse_one_is_preserved_as_introduction(self):
        transcript = Transcript(
            chapter_id="GEN_001",
            text="Kitabu cha Mwanzo Hapo mwanzo",
            words=[
                WordTiming("Kitabu", 0, 500),
                WordTiming("cha", 500, 700),
                WordTiming("Mwanzo", 700, 1200),
                WordTiming("Hapo", 2000, 2300),
                WordTiming("mwanzo", 2300, 2600),
            ],
        )

        aligned = align_transcript_to_verses(transcript, [CanonicalVerse(1, "Hapo mwanzo")])

        self.assertEqual(aligned.introductions[0].type, "book_title")
        self.assertLess(aligned.introductions[0].end_ms, aligned.verse_boundaries[0].start_ms)

    def test_section_heading_before_verse_one_is_preserved(self):
        transcript = Transcript(
            chapter_id="MAT_005",
            text="Mahubiri ya mlimani Basi",
            words=[WordTiming("Mahubiri", 0, 500), WordTiming("mlimani", 500, 1000), WordTiming("Basi", 2000, 2300)],
        )

        aligned = align_transcript_to_verses(transcript, [CanonicalVerse(1, "Basi")])

        self.assertEqual(aligned.introductions[0].type, "section_heading")

    def test_first_verse_without_introduction(self):
        aligned = align_transcript_to_verses(
            Transcript(chapter_id="GEN_001", text="Hapo", words=[WordTiming("Hapo", 1000, 1200)]),
            [CanonicalVerse(1, "Hapo")],
        )

        self.assertEqual(aligned.introductions, [])

    def test_multiple_introduction_elements_serialize(self):
        transcript = Transcript(
            chapter_id="GEN_001",
            text="",
            introductions=[
                Introduction("chapter_title", "Mwanzo moja", 0, 1000),
                Introduction("section_heading", "Siku sita", 1000, 2000),
            ],
        )

        restored = Transcript.from_dict(transcript.to_dict())

        self.assertEqual(len(restored.introductions), 2)

    def test_old_json_backward_compatibility(self):
        restored = Transcript.from_dict({"chapter_id": "GEN_001", "text": "Hapo"})

        self.assertEqual(restored.introductions, [])
        self.assertEqual(restored.verses, [])

    def test_exact_spoken_reference_mode_metrics(self):
        candidate = Transcript(
            chapter_id="GEN_001",
            text="hapo mwanzo",
            verses=[CandidateVerse(1, "Hapo mwanzo", spoken_reference_text="hapo mwanzo", text_reference_mode="exact_spoken")],
        )
        golden = Transcript(chapter_id="GEN_001", text="tofauti", verse_boundaries=[])

        metrics = MetricCalculators().calculate(golden, candidate)

        self.assertEqual(metrics.spoken_reference_wer, 0)
        self.assertEqual(metrics.text_reference_mode, "exact_spoken")

    def test_canonical_fallback_mode_warns_and_keeps_canonical_wer(self):
        metrics = MetricCalculators().calculate(
            Transcript("GEN_001", "hapo"),
            Transcript("GEN_001", "tofauti", verses=[CandidateVerse(1, "Hapo", text_reference_mode="canonical_fallback")]),
        )

        self.assertIsNone(metrics.spoken_reference_wer)
        self.assertEqual(metrics.text_reference_mode, "canonical_fallback")
        self.assertIn("recording edition", metrics.text_metric_warning)

    def test_review_workbook_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.xlsx"
            write_xlsx(
                path,
                {
                    "verses": [
                        REVIEW_COLUMNS,
                        ["GEN_001", "Genesis", 1, 1, "Hapo", "", 1000, 2000, "reviewed_exact", "", ""],
                    ],
                    "introductions": [["chapter_id", "introduction_type", "spoken_text", "start_ms", "end_ms", "review_status", "reviewer", "notes"]],
                },
            )

            result = validate_review_workbook(path)

            self.assertTrue(any("Exact spoken text required" in error for error in result["errors"]))
            self.assertTrue(any("Reviewer required" in error for error in result["errors"]))

    def test_cleanup_dry_run_marks_outputs_preserved(self):
        items = audit_cleanup(remove_models={"faster-whisper-medium"})
        preserved = [item for item in items if item.category == "preserved_benchmark_artifact"]

        self.assertTrue(preserved)
        self.assertTrue(all(not item.safe_to_remove for item in preserved))


if __name__ == "__main__":
    unittest.main()
