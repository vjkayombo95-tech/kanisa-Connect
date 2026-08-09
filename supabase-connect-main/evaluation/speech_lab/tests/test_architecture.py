import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


class ArchitectureTests(unittest.TestCase):
    def test_evaluation_namespace_contains_required_deliverables(self):
        files = {
            "runner": ROOT / "evaluation/speech_lab/runner.py",
            "golden": ROOT / "evaluation/speech_lab/golden.py",
            "metrics": ROOT / "evaluation/speech_lab/metrics.py",
            "reports": ROOT / "evaluation/speech_lab/reports.py",
        }

        for path in files.values():
            self.assertTrue(path.exists())

        self.assertIn("class SpeechEvaluationRunner", files["runner"].read_text(encoding="utf-8"))
        self.assertIn("class GoldenReferenceManager", files["golden"].read_text(encoding="utf-8"))
        self.assertIn("class WERCalculator", files["metrics"].read_text(encoding="utf-8"))
        self.assertIn("class CERCalculator", files["metrics"].read_text(encoding="utf-8"))
        self.assertIn("class BoundaryAccuracyCalculator", files["metrics"].read_text(encoding="utf-8"))
        self.assertIn("class ComparisonReportGenerator", files["reports"].read_text(encoding="utf-8"))
        self.assertIn("class Leaderboard", files["reports"].read_text(encoding="utf-8"))

    def test_evaluation_lab_does_not_import_production_audio_or_sync_modules(self):
        lab_files = [
            path
            for path in (ROOT / "evaluation/speech_lab").rglob("*.py")
            if "tests" not in path.parts
        ]
        combined = "\n".join(path.read_text(encoding="utf-8") for path in lab_files)

        self.assertNotIn("src.lib", combined)
        self.assertNotIn("supabase.audio.scripts", combined)
        self.assertNotIn("SynchronizationEngine", combined)
        self.assertNotIn("UniversalAudio", combined)
        self.assertNotIn("BibleIndexAdapter", combined)

    def test_documentation_records_corpus_models_metrics_and_outputs(self):
        docs = (ROOT / "docs/AI_SPEECH_EVALUATION_LAB.md").read_text(encoding="utf-8")

        for expected in ["Genesis 1", "Psalm 23", "Matthew 5", "John 3", "Romans 8"]:
            self.assertIn(expected, docs)
        for expected in ["WhisperX", "Faster-Whisper", "NVIDIA Parakeet", "Meta MMS", "wav2vec2"]:
            self.assertIn(expected, docs)
        for expected in ["Word Error Rate", "Character Error Rate", "Boundary Accuracy", "Markdown", "CSV", "JSON", "HTML"]:
            self.assertIn(expected, docs)


if __name__ == "__main__":
    unittest.main()
