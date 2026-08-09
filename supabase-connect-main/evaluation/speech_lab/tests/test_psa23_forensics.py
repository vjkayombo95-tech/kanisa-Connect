import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation.speech_lab.models import Transcript, WordTiming
from evaluation.speech_lab.psa23_diagnostic import CHAPTER_ID, load_reference_sources
from evaluation.speech_lab.psa23_forensics import (
    forensic_verse_row,
    run_medium_optimization,
    word_diffs,
)
from evaluation.speech_lab.spoken_review import write_xlsx
from evaluation.speech_lab.verse_alignment import align_transcript_to_verses


class Psalm23ForensicsTests(unittest.TestCase):
    def test_word_diffs_classify_neighboring_leakage(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)
            biblica = self._biblica_json(directory)
            refs = load_reference_sources(workbook, biblica)

            diffs = word_diffs("Spoken 2", "Spoken 2 3", refs, 2)

            self.assertTrue(any(item["classification"] == "neighboring_verse_leakage" for item in diffs))

    def test_forensic_row_reports_drift_and_counts(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)
            biblica = self._biblica_json(directory)
            refs = load_reference_sources(workbook, biblica)
            words = [WordTiming("Spoken", 9000, 9200), WordTiming("1", 9200, 9400)]
            aligned = align_transcript_to_verses(Transcript(CHAPTER_ID, "Spoken 1", words=words), refs["human_spoken"].verses)
            spoken_verses, intros, _validation = __import__(
                "evaluation.speech_lab.psa23_diagnostic", fromlist=["load_spoken_review_workbook"]
            ).load_spoken_review_workbook(workbook)

            row, diffs = forensic_verse_row("test", 1, aligned, refs, spoken_verses, intros)

            self.assertEqual(row["wer"], 0)
            self.assertEqual(row["start_drift_ms"], 0)
            self.assertEqual(diffs, [])

    def test_medium_optimization_dry_run_does_not_transcribe(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)
            audio = Path(directory) / "PSA_023.mp3"
            audio.write_bytes(b"audio")

            with patch("evaluation.speech_lab.providers.faster_whisper_provider.FasterWhisperProvider.transcribe") as transcribe:
                result = run_medium_optimization(spoken_workbook=workbook, audio=audio, dry_run=True)

            self.assertTrue(result["dry_run"])
            transcribe.assert_not_called()

    def test_medium_optimization_scores_mocked_transcript(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)
            biblica = self._biblica_json(directory)
            audio = Path(directory) / "PSA_023.mp3"
            audio.write_bytes(b"audio")
            model_root = Path(directory) / "models"
            baseline = model_root / "faster-whisper-medium" / f"{CHAPTER_ID}.json"
            baseline.parent.mkdir(parents=True)
            baseline.write_text(json.dumps(Transcript(CHAPTER_ID, " ".join(f"Spoken {i}" for i in range(1, 7))).to_dict()), encoding="utf-8")
            fake = Transcript(CHAPTER_ID, " ".join(f"Spoken {i}" for i in range(1, 7)), metadata={"transcription_runtime_seconds": 1.0})

            with patch("evaluation.speech_lab.psa23_forensics.DEFAULT_BIBLICA", biblica), patch(
                "evaluation.speech_lab.providers.faster_whisper_provider.FasterWhisperProvider.transcribe",
                return_value=fake,
            ):
                result = run_medium_optimization(
                    spoken_workbook=workbook,
                    audio=audio,
                    model_outputs_root=model_root,
                    optimization_output_root=Path(directory) / "opt",
                    output_dir=Path(directory) / "reports",
                )

            self.assertFalse(result["dry_run"])
            self.assertTrue(result["ranking"])

    def _workbook(self, directory):
        rows = [[
            "chapter_id",
            "book",
            "chapter",
            "verse",
            "canonical_verse_text",
            "spoken_reference_text",
            "verse_start_ms",
            "verse_end_ms",
            "spoken_text_review_status",
            "reviewer",
            "review_notes",
        ]]
        for verse in range(1, 7):
            rows.append([CHAPTER_ID, "Psalms", 23, verse, f"Canonical {verse}", f"Spoken {verse}", 8000 + verse * 1000, 8500 + verse * 1000, "reviewed_exact", "Reviewer", ""])
        intros = [["chapter_id", "introduction_type", "spoken_text", "start_ms", "end_ms", "review_status", "reviewer", "notes"], [CHAPTER_ID, "chapter_title", "Intro words", 0, 6000, "reviewed_exact", "Reviewer", ""]]
        path = Path(directory) / "psa.xlsx"
        write_xlsx(path, {"VERSES": rows, "INTRODUCTIONS": intros})
        return path

    def _biblica_json(self, directory):
        path = Path(directory) / "PSA_023.json"
        path.write_text(
            json.dumps(
                {
                    "chapter_id": CHAPTER_ID,
                    "source_name": "biblica_open_kiswahili",
                    "reference_source_version": "test",
                    "book": "Psalm",
                    "chapter": 23,
                    "introductions": [],
                    "verses": [{"verse": verse, "text": f"Biblica {verse}"} for verse in range(1, 7)],
                }
            ),
            encoding="utf-8",
        )
        return path


if __name__ == "__main__":
    unittest.main()
