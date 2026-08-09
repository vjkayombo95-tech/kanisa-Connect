import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation.speech_lab.models import Transcript
from evaluation.speech_lab.psa23_diagnostic import CHAPTER_ID
from evaluation.speech_lab.psa23_large_model import (
    CANDIDATES,
    VAD_OPTIONS,
    candidate_by_name,
    classify_decision,
    rank_rows,
    run_large_model_compare,
    run_preflight,
    transcript_metadata_matches,
)
from evaluation.speech_lab.spoken_review import write_xlsx


class Psalm23LargeModelTests(unittest.TestCase):
    def test_candidate_model_configuration(self):
        self.assertEqual(candidate_by_name("large-v3").model_id, "Systran/faster-whisper-large-v3")
        self.assertEqual(candidate_by_name("large-v3-turbo").model_id, "deepdml/faster-whisper-large-v3-turbo-ct2")
        self.assertEqual(candidate_by_name("medium_vad_tuned").model_id, "Systran/faster-whisper-medium")

    def test_preflight_reports_safe_refusal_without_download(self):
        with patch("evaluation.speech_lab.psa23_large_model.is_candidate_cached", return_value=False), patch(
            "evaluation.speech_lab.psa23_large_model._available_memory", return_value=8_000_000_000
        ), patch("shutil.disk_usage", return_value=type("Usage", (), {"free": 10_000_000_000})()):
            result = run_preflight(models=["large-v3"], write_report=False)

        row = result["preflight"][0]
        self.assertFalse(row["safe_to_run"])
        self.assertEqual(row["skip_reason"], "model_not_cached_download_not_allowed")

    def test_preflight_refuses_insufficient_disk(self):
        with patch("evaluation.speech_lab.psa23_large_model.is_candidate_cached", return_value=False), patch(
            "evaluation.speech_lab.psa23_large_model._available_memory", return_value=8_000_000_000
        ), patch("shutil.disk_usage", return_value=type("Usage", (), {"free": 2_000_000_000})()):
            result = run_preflight(models=["large-v3"], allow_download=True, write_report=False)

        self.assertEqual(result["preflight"][0]["skip_reason"], "insufficient_free_disk_after_estimated_download")

    def test_dry_run_invokes_no_provider(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = Path(directory) / "PSA_023.mp3"
            audio.write_bytes(b"audio")
            with patch("evaluation.speech_lab.psa23_large_model.resolve_audio_path", return_value=audio), patch(
                "evaluation.speech_lab.providers.faster_whisper_provider.FasterWhisperProvider.transcribe"
            ) as transcribe:
                result = run_large_model_compare(models=["large-v3"], audio=audio, dry_run=True)

            self.assertTrue(result["dry_run"])
            transcribe.assert_not_called()

    def test_reuse_matching_medium_vad_tuned_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "medium_vad_tuned.json"
            path.write_text(
                json.dumps(
                    Transcript(
                        CHAPTER_ID,
                        "",
                        metadata={
                            "resolved_model_name": "Systran/faster-whisper-medium",
                            "language": "sw",
                            "transcription_options": VAD_OPTIONS,
                            "optimization_config": "medium_vad_tuned",
                        },
                    ).to_dict()
                ),
                encoding="utf-8",
            )

            self.assertTrue(transcript_metadata_matches(path, CANDIDATES["medium_vad_tuned"]))

    def test_refuse_mismatched_medium_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text(json.dumps(Transcript(CHAPTER_ID, "", metadata={"resolved_model_name": "other"}).to_dict()), encoding="utf-8")

            self.assertFalse(transcript_metadata_matches(path, CANDIDATES["medium_vad_tuned"]))

    def test_ranking_logic(self):
        rows = [
            {"candidate": "a", "cleaned_wer": 0.5, "cer": 0.2, "verse_resolution_rate": 1, "token_alignment_coverage": 0.7, "runtime_seconds": 10},
            {"candidate": "b", "cleaned_wer": 0.4, "cer": 0.3, "verse_resolution_rate": 1, "token_alignment_coverage": 0.6, "runtime_seconds": 20},
        ]

        ranked = rank_rows(rows)

        self.assertEqual(ranked[0]["candidate"], "b")
        self.assertEqual(ranked[0]["rank"], 1)

    def test_decision_rules(self):
        self.assertEqual(classify_decision(0.30), "substantial_improvement")
        self.assertEqual(classify_decision(0.40), "moderate_improvement")
        self.assertEqual(classify_decision(0.47), "marginal_improvement")
        self.assertEqual(classify_decision(0.50), "no_improvement")

    def test_report_generation_with_skipped_model(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)
            audio = Path(directory) / "PSA_023.mp3"
            audio.write_bytes(b"audio")
            with patch("evaluation.speech_lab.psa23_large_model.resolve_audio_path", return_value=audio), patch(
                "evaluation.speech_lab.psa23_large_model.is_candidate_cached", return_value=False
            ), patch("evaluation.speech_lab.psa23_large_model._available_memory", return_value=8_000_000_000), patch(
                "shutil.disk_usage", return_value=type("Usage", (), {"free": 10_000_000_000})()
            ):
                result = run_large_model_compare(
                    spoken_workbook=workbook,
                    models=["large-v3"],
                    audio=audio,
                    output_dir=Path(directory) / "reports",
                )

            self.assertTrue(result["ranking"][0]["skipped"])
            self.assertTrue(Path(result["outputs"]["json"]).exists())

    def test_no_transcription_of_other_chapters(self):
        self.assertEqual(CHAPTER_ID, "PSA_023")

    def _workbook(self, directory):
        rows = [["chapter_id", "book", "chapter", "verse", "canonical_verse_text", "spoken_reference_text", "verse_start_ms", "verse_end_ms", "spoken_text_review_status", "reviewer", "review_notes"]]
        for verse in range(1, 7):
            rows.append([CHAPTER_ID, "Psalms", 23, verse, f"Canonical {verse}", f"Spoken {verse}", 7000 + verse * 1000, 7500 + verse * 1000, "reviewed_exact", "Reviewer", ""])
        intros = [["chapter_id", "introduction_type", "spoken_text", "start_ms", "end_ms", "review_status", "reviewer", "notes"], [CHAPTER_ID, "chapter_title", "Intro", 0, 6000, "reviewed_exact", "Reviewer", ""]]
        path = Path(directory) / "psa.xlsx"
        write_xlsx(path, {"VERSES": rows, "INTRODUCTIONS": intros})
        return path


if __name__ == "__main__":
    unittest.main()
