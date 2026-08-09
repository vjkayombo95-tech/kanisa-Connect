import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation.speech_lab.mini_validation import (
    MiniValidationError,
    classify_all_samples,
    create_reference_subsets,
    ensure_sample_transcript,
    run_mini_validation,
    sample_id,
    sample_timing,
    write_mini_reports,
)
from evaluation.speech_lab.models import Transcript
from evaluation.speech_lab.spoken_review import write_xlsx


class MiniValidationTests(unittest.TestCase):
    def test_sample_id_preserves_verse_range(self):
        self.assertEqual(sample_id("GEN_001", (1, 10)), "GEN_001_1_10")

    def test_sample_timing_uses_requested_range_only(self):
        timings = {
            ("GEN_001", 1): {"verse_start_ms": 1000, "verse_end_ms": 2000},
            ("GEN_001", 10): {"verse_start_ms": 9000, "verse_end_ms": 10000},
            ("GEN_001", 11): {"verse_start_ms": 11000, "verse_end_ms": 12000},
        }

        self.assertEqual(sample_timing("GEN_001", (1, 10), timings), (1000, 10000))

    def test_create_reference_subset_writes_only_selected_verses(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / "subsets"
            paths = create_reference_subsets(chapters=["PSA_023"], verse_range=(1, 3), output_root=out)
            payload = json.loads(paths[0].read_text(encoding="utf-8"))

            self.assertEqual(payload["chapter_id"], "PSA_023_1_3")
            self.assertEqual([verse["verse"] for verse in payload["verses"]], [1, 2, 3])

    def test_no_download_when_model_not_cached(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("evaluation.speech_lab.mini_validation.model_cached", return_value=False):
                with self.assertRaises(MiniValidationError):
                    ensure_sample_transcript(
                        chapter_id="GEN_001",
                        sample="GEN_001_1_10",
                        model="large-v3",
                        timing_workbook=self._timing_workbook(directory),
                        model_outputs_root=Path(directory) / "outputs",
                        skip_existing=False,
                        overwrite=False,
                    )

    def test_reuse_matching_existing_transcript(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "outputs" / "large-v3" / "GEN_001_1_10.json"
            output.parent.mkdir(parents=True)
            output.write_text(
                json.dumps(
                    Transcript(
                        "GEN_001_1_10",
                        "",
                        metadata={"model_key": "large-v3", "sample_id": "GEN_001_1_10", "reference_type": "biblica_candidate"},
                    ).to_dict()
                ),
                encoding="utf-8",
            )

            path = ensure_sample_transcript(
                chapter_id="GEN_001",
                sample="GEN_001_1_10",
                model="large-v3",
                timing_workbook=self._timing_workbook(directory),
                model_outputs_root=Path(directory) / "outputs",
                skip_existing=True,
                overwrite=False,
            )

            self.assertEqual(path, output)

    def test_confidence_classification_strong_when_large_wins_all_and_turbo_close(self):
        rows = []
        for sample in ("GEN_001_1_10", "MAT_005_1_10", "ROM_008_1_10"):
            rows.extend(
                [
                    {"sample": sample, "model": "medium_vad_tuned", "wer": 0.5, "cer": 0.2, "coverage": 0.5},
                    {"sample": sample, "model": "large-v3", "wer": 0.3, "cer": 0.1, "coverage": 0.7},
                    {"sample": sample, "model": "large-v3-turbo", "wer": 0.33, "cer": 0.1, "coverage": 0.7},
                ]
            )

        self.assertEqual(classify_all_samples(rows)["overall"], "strong_generalization")

    def test_report_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            outputs = write_mini_reports(
                rows=[{"sample": "GEN_001_1_10", "model": "large-v3", "wer": 0.1, "cer": 0.1, "coverage": 1, "verse_resolution": 1, "runtime_seconds": 1}],
                verse_rows=[],
                confidence={"overall": "strong_generalization", "large_beats_medium_count": 1, "turbo_close_count": 1, "sample_classes": {}},
                preflight={"estimated_runtime_seconds": 1},
                output_dir=directory,
            )

            self.assertTrue(outputs["json"].exists())
            self.assertTrue(outputs["csv"].exists())
            self.assertTrue(outputs["markdown"].exists())

    def test_dry_run_invokes_no_provider(self):
        with patch("evaluation.speech_lab.mini_validation.FasterWhisperProvider") as provider:
            result = run_mini_validation(chapters=["GEN_001"], verse_range=(1, 10), dry_run=True)

            self.assertTrue(result["dry_run"])
            provider.assert_not_called()

    def _timing_workbook(self, directory):
        rows = [["chapter_id", "book", "chapter", "verse", "verse_text", "verse_start_ms", "verse_end_ms", "verse_confidence", "reviewer"]]
        for verse in range(1, 12):
            rows.append(["GEN_001", "Genesis", 1, verse, f"Verse {verse}", verse * 1000, verse * 1000 + 500, "", "Reviewer"])
        path = Path(directory) / "timings.xlsx"
        write_xlsx(path, {"golden_references": rows, "chapter_titles": [["chapter_id"]]})
        return path


if __name__ == "__main__":
    unittest.main()
