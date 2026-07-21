import json
import tempfile
import unittest

from evaluation.speech_lab.corpus import BenchmarkChapter
from evaluation.speech_lab.golden import GoldenReferenceManager
from evaluation.speech_lab.models import ModelSpec, Transcript, VerseBoundary, WordTiming
from evaluation.speech_lab.runner import EvaluationConfig, SpeechEvaluationRunner


class RunnerTests(unittest.TestCase):
    def test_runner_evaluates_manifest_output(self):
        with tempfile.TemporaryDirectory() as directory:
            from pathlib import Path

            root = Path(directory)
            chapter = BenchmarkChapter(book="John", chapter=3, osis_book="JHN")
            golden_root = root / "golden"
            output_root = root / "outputs"
            model_dir = output_root / "whisperx"
            model_dir.mkdir(parents=True)

            transcript = Transcript(
                chapter_id="JHN_003",
                text="Kwa maana Mungu",
                words=[
                    WordTiming(word="Kwa", start_ms=0, end_ms=100, confidence=0.99, verse=1),
                    WordTiming(word="maana", start_ms=101, end_ms=250, confidence=0.98, verse=1),
                    WordTiming(word="Mungu", start_ms=251, end_ms=450, confidence=0.97, verse=1),
                ],
                verse_boundaries=[VerseBoundary(verse=1, start_ms=0, end_ms=450, confidence=0.99)],
            )
            GoldenReferenceManager(golden_root).save(transcript)
            with (model_dir / "JHN_003.json").open("w", encoding="utf-8") as handle:
                json.dump(transcript.to_dict(), handle)

            spec = ModelSpec(id="whisperx", name="WhisperX", provider="manifest", metadata={"output_root": str(output_root)})
            runner = SpeechEvaluationRunner(
                config=EvaluationConfig(audio_root=root / "audio", report_root=root / "reports", corpus=(chapter,), models=(spec,)),
                golden=GoldenReferenceManager(golden_root),
            )

            results = runner.run()

            self.assertEqual(len(results), 1)
            self.assertTrue(results[0].accepted)
            self.assertEqual(results[0].metrics.wer, 0)
            self.assertGreaterEqual(results[0].resources.processing_time_seconds, 0)


if __name__ == "__main__":
    unittest.main()
