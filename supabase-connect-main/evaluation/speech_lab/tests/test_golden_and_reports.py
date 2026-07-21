import json
import tempfile
import unittest
from pathlib import Path

from evaluation.speech_lab.golden import GoldenReferenceManager
from evaluation.speech_lab.models import EvaluationMetrics, EvaluationResult, ResourceUsage, Transcript
from evaluation.speech_lab.reports import ComparisonReportGenerator, Leaderboard


class GoldenAndReportTests(unittest.TestCase):
    def test_golden_reference_manager_round_trips(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = GoldenReferenceManager(directory)
            transcript = Transcript(chapter_id="JHN_003", text="Kwa maana Mungu")

            path = manager.save(transcript)

            self.assertTrue(path.exists())
            self.assertEqual(manager.load("JHN_003").text, "Kwa maana Mungu")

    def test_report_generator_writes_all_formats(self):
        with tempfile.TemporaryDirectory() as directory:
            result = EvaluationResult(
                model_id="whisperx",
                model_name="WhisperX",
                chapter_id="JHN_003",
                metrics=EvaluationMetrics(
                    wer=0.01,
                    cer=0.01,
                    boundary_accuracy=1.0,
                    alignment_accuracy=0.99,
                    average_word_confidence=0.98,
                    verse_confidence=0.99,
                ),
                resources=ResourceUsage(processing_time_seconds=12.5, peak_ram_mb=512),
                accepted=True,
            )

            paths = ComparisonReportGenerator(directory).generate([result], run_id="test-run")

            self.assertEqual(set(paths), {"json", "csv", "markdown", "html"})
            self.assertEqual(json.loads(paths["json"].read_text(encoding="utf-8"))["leaderboard"][0]["model_id"], "whisperx")
            self.assertIn("WhisperX", paths["markdown"].read_text(encoding="utf-8"))
            self.assertIn("<table>", paths["html"].read_text(encoding="utf-8"))

    def test_leaderboard_ranks_by_acceptance_then_wer(self):
        def make(model_id: str, wer: float, accepted: bool):
            return EvaluationResult(
                model_id=model_id,
                model_name=model_id,
                chapter_id="JHN_003",
                metrics=EvaluationMetrics(
                    wer=wer,
                    cer=wer,
                    boundary_accuracy=1.0,
                    alignment_accuracy=1.0,
                    average_word_confidence=0.99,
                    verse_confidence=0.99,
                ),
                resources=ResourceUsage(processing_time_seconds=1),
                accepted=accepted,
            )

        ranked = Leaderboard().rank([make("b", 0.01, False), make("a", 0.02, True)])

        self.assertEqual(ranked[0]["model_id"], "a")


if __name__ == "__main__":
    unittest.main()
