import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation.speech_lab.cli import main
from evaluation.speech_lab.models import Transcript, WordTiming
from evaluation.speech_lab.psa23_diagnostic import (
    CHAPTER_ID,
    Psalm23DiagnosticError,
    analyze_introductions,
    classify_primary_cause,
    edit_operation_counts,
    load_reference_sources,
    load_spoken_review_workbook,
    remove_introduction_words,
    run_psalm23_diagnostic,
    score_text,
    write_diagnostic_reports,
)
from evaluation.speech_lab.spoken_review import write_xlsx
from evaluation.speech_lab.verse_alignment import CanonicalVerse, align_transcript_to_verses


class Psalm23DiagnosticTests(unittest.TestCase):
    def test_workbook_loading_accepts_valid_psalm_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)

            verses, intros, validation = load_spoken_review_workbook(workbook)

            self.assertEqual(len(verses), 6)
            self.assertEqual(verses[0].chapter_id, CHAPTER_ID)
            self.assertEqual(intros[0].spoken_text, "Zaburi ya ishirini na tatu")
            self.assertEqual(validation["pending_or_incomplete_rows"], [])

    def test_rejects_missing_spoken_text(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory, verse_overrides={1: {"spoken_reference_text": ""}})

            with self.assertRaises(Psalm23DiagnosticError):
                load_spoken_review_workbook(workbook)

    def test_rejects_duplicate_verses(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory, duplicate_verse=True)

            with self.assertRaises(Psalm23DiagnosticError):
                load_spoken_review_workbook(workbook)

    def test_rejects_wrong_chapter_id(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory, chapter_id="GEN_001")

            with self.assertRaises(Psalm23DiagnosticError):
                load_spoken_review_workbook(workbook)

    def test_preserves_introductions_separately(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)

            _verses, intros, _validation = load_spoken_review_workbook(workbook)

            self.assertEqual(len(intros), 1)
            self.assertEqual(intros[0].introduction_type, "chapter_title")

    def test_loads_three_reference_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            workbook = self._workbook(directory)
            biblica = self._biblica_json(directory)

            sources = load_reference_sources(workbook, biblica)

            self.assertEqual(sorted(sources), ["biblica", "canonical", "human_spoken"])
            self.assertEqual(sources["human_spoken"].reference_type, "human_spoken")

    def test_chapter_level_wer_counts_operations(self):
        score = score_text("a b c", "a x c y")

        self.assertEqual(score["substitutions"], 1)
        self.assertEqual(score["insertions"], 1)
        self.assertEqual(score["deletions"], 0)

    def test_per_verse_wer_can_score_assigned_words(self):
        aligned = align_transcript_to_verses(
            Transcript(CHAPTER_ID, "Mwenyezi Mungu", words=[WordTiming("Mwenyezi", 7000, 7200), WordTiming("Mungu", 7200, 7400)]),
            [CanonicalVerse(1, "Mwenyezi Mungu")],
        )
        assigned = " ".join(word.word for word in aligned.words if word.verse == 1)

        self.assertEqual(score_text("Mwenyezi Mungu", assigned)["wer"], 0)

    def test_edit_operation_counts_include_insertion_deletion_substitution(self):
        counts = edit_operation_counts(["a", "b", "c"], ["a", "x", "c", "y"])

        self.assertEqual(counts, {"insertions": 1, "deletions": 0, "substitutions": 1})

    def test_introduction_removal_uses_timestamps(self):
        transcript = Transcript(
            CHAPTER_ID,
            "Zaburi moja",
            words=[WordTiming("Zaburi", 1000, 2000), WordTiming("moja", 7000, 8000)],
        )
        workbook = self._workbook(tempfile.mkdtemp())
        _verses, intros, _validation = load_spoken_review_workbook(workbook)

        cleaned = remove_introduction_words(transcript, intros)

        self.assertEqual(cleaned.text, "moja")

    def test_no_transcription_provider_invocation_on_dry_run(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "model_outputs"
            for model in ("small", "medium"):
                path = root / f"faster-whisper-{model}" / f"{CHAPTER_ID}.json"
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps(Transcript(CHAPTER_ID, "").to_dict()), encoding="utf-8")
            workbook = self._workbook(directory)

            with patch("evaluation.speech_lab.providers.faster_whisper_provider.FasterWhisperProvider.transcribe") as transcribe:
                result = run_psalm23_diagnostic(
                    spoken_workbook=workbook,
                    models=["small", "medium"],
                    model_outputs_root=root,
                    output_dir=Path(directory) / "reports",
                    dry_run=True,
                )

            self.assertTrue(result["dry_run"])
            transcribe.assert_not_called()

    def test_deterministic_cause_classification_for_reference_mismatch(self):
        candidate = type("Candidate", (), {"start_ms": 7000, "end_ms": 9000})()
        timing = type("Timing", (), {"verse_start_ms": 7000, "verse_end_ms": 9000})()
        sources = {"human_spoken": type("Source", (), {"introductions": []})()}
        scores = {
            "human_spoken": {"wer": 0.05, "insertions": 0, "deletions": 0, "substitutions": 1},
            "canonical": {"wer": 0.80},
            "biblica": {"wer": 0.70},
        }

        self.assertEqual(classify_primary_cause(scores, candidate, "", sources, 1, timing), "reference_mismatch")

    def test_report_generation_uses_unique_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            kwargs = {
                "output_dir": directory,
                "inputs": {},
                "references": {},
                "workbook_validation": {},
                "summary_rows": [{"model": "small", "canonical_chapter_wer": 1, "biblica_chapter_wer": 1, "spoken_reference_chapter_wer": 0, "raw_spoken_reference_chapter_wer": 0, "best_performing_reference": "human_spoken", "verse_resolution_rate": 1, "token_alignment_coverage": 1}],
                "verse_rows": [{"model": "small", "verse": 1, "spoken_reference_wer": 0, "canonical_wer": 1, "biblica_wer": 1, "likely_primary_cause": "reference_mismatch", "start_drift_ms": 0, "end_drift_ms": 0}],
                "introduction_rows": [],
                "overwrite": False,
            }

            first = write_diagnostic_reports(**kwargs)
            second = write_diagnostic_reports(**kwargs)

            self.assertNotEqual(first["json"], second["json"])

    def test_cli_diagnose_psalm_23_dry_run(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "model_outputs"
            for model in ("small", "medium"):
                path = root / f"faster-whisper-{model}" / f"{CHAPTER_ID}.json"
                path.parent.mkdir(parents=True)
                path.write_text(json.dumps(Transcript(CHAPTER_ID, "").to_dict()), encoding="utf-8")
            workbook = self._workbook(directory)
            argv = [
                "cli",
                "diagnose-psalm-23",
                "--spoken-workbook",
                str(workbook),
                "--model-outputs-root",
                str(root),
                "--output-dir",
                str(Path(directory) / "reports"),
                "--dry-run",
            ]

            with patch.object(sys, "argv", argv):
                exit_code = main()

            self.assertEqual(exit_code, 0)

    def _workbook(self, directory, *, chapter_id=CHAPTER_ID, duplicate_verse=False, verse_overrides=None):
        verse_overrides = verse_overrides or {}
        headers = [
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
        ]
        rows = [headers]
        for verse in range(1, 7):
            value = verse_overrides.get(verse, {})
            rows.append(
                [
                    chapter_id,
                    "Psalms",
                    23,
                    1 if duplicate_verse and verse == 2 else verse,
                    f"Canonical {verse}",
                    value.get("spoken_reference_text", f"Spoken {verse}"),
                    7000 + verse * 1000,
                    7500 + verse * 1000,
                    "reviewed_exact",
                    "Reviewer",
                    "",
                ]
            )
        intros = [
            ["chapter_id", "introduction_type", "spoken_text", "start_ms", "end_ms", "review_status", "reviewer", "notes"],
            [chapter_id, "chapter_title", "Zaburi ya ishirini na tatu", 0, 6000, "reviewed_exact", "Reviewer", ""],
        ]
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
                    "introductions": [{"type": "chapter_title", "text": "Zaburi 23"}],
                    "verses": [{"verse": verse, "text": f"Biblica {verse}"} for verse in range(1, 7)],
                }
            ),
            encoding="utf-8",
        )
        return path


if __name__ == "__main__":
    unittest.main()
