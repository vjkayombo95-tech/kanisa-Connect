import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation.speech_lab.comparison import GoldenReferenceComparator
from evaluation.speech_lab.golden import GoldenReferenceManager
from evaluation.speech_lab.golden_importer import GoldenReferenceSpreadsheetImporter
from evaluation.speech_lab.models import ModelSpec, Transcript, VerseBoundary, WordTiming
from evaluation.speech_lab.supabase_store import (
    DEFAULT_ENV_FILE,
    EvaluationSupabaseStore,
    EvaluationSupabaseStoreError,
    load_evaluation_env_file,
)


class GoldenReferenceFrameworkTests(unittest.TestCase):
    def test_importer_groups_csv_rows_into_transcripts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "golden.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=["book", "chapter", "verse", "verse_text", "word", "start_ms", "end_ms", "confidence"],
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "book": "John",
                        "chapter": "3",
                        "verse": "16",
                        "verse_text": "Kwa maana jinsi hii Mungu aliupenda ulimwengu",
                        "word": "Kwa",
                        "start_ms": "1000",
                        "end_ms": "1200",
                        "confidence": "0.99",
                    }
                )
                writer.writerow(
                    {
                        "book": "John",
                        "chapter": "3",
                        "verse": "16",
                        "verse_text": "Kwa maana jinsi hii Mungu aliupenda ulimwengu",
                        "word": "maana",
                        "start_ms": "1200",
                        "end_ms": "1500",
                        "confidence": "0.98",
                    }
                )

            transcripts = GoldenReferenceSpreadsheetImporter().import_file(path)

            self.assertEqual(len(transcripts), 1)
            self.assertEqual(transcripts[0].chapter_id, "JHN_003")
            self.assertIn("Mungu", transcripts[0].text)
            self.assertEqual([word.word for word in transcripts[0].words], ["Kwa", "maana"])

    def test_comparator_uses_local_golden_reference(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = GoldenReferenceManager(directory)
            manager.save(
                Transcript(
                    chapter_id="JHN_003",
                    text="Kwa maana Mungu",
                    words=[WordTiming("Kwa", 0, 100), WordTiming("maana", 100, 200), WordTiming("Mungu", 200, 300)],
                    verse_boundaries=[VerseBoundary(16, 0, 300, 1.0)],
                )
            )
            candidate = Transcript(
                chapter_id="JHN_003",
                text="Kwa maana Mungu",
                words=[WordTiming("Kwa", 0, 100), WordTiming("maana", 100, 200), WordTiming("Mungu", 200, 300)],
                verse_boundaries=[VerseBoundary(16, 0, 300, 1.0)],
            )

            results = GoldenReferenceComparator(golden=manager).compare_transcripts(
                [candidate],
                ModelSpec(id="whisperx-large-v3", name="WhisperX large-v3", provider="captured"),
            )

            self.assertEqual(results[0].metrics.wer, 0)
            self.assertEqual(results[0].metrics.boundary_accuracy, 1)

    def test_supabase_store_upsert_payload_targets_evaluation_table(self):
        store = EvaluationSupabaseStore("https://example.supabase.co", "test-secret-key")
        calls = []

        class Response:
            status_code = 200
            text = json.dumps([{"chapter_id": "JHN_003"}])

        def request(method, url, **kwargs):
            calls.append((method, url, kwargs))
            return Response()

        store.session.request = request
        row = store.upsert_golden_reference(
            Transcript(chapter_id="JHN_003", text="Kwa maana Mungu", metadata={"translation_code": "sw-biblica"})
        )

        self.assertEqual(row["chapter_id"], "JHN_003")
        self.assertIn("evaluation_golden_references", calls[0][1])
        self.assertEqual(calls[0][2]["json"][0]["reference_payload"]["chapter_id"], "JHN_003")

    def test_default_env_file_resolves_from_supabase_store_location(self):
        expected = Path(__file__).resolve().parents[1] / ".env.evaluation"

        self.assertEqual(DEFAULT_ENV_FILE, expected)

    def test_store_loads_explicit_dotenv_file_before_getenv(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env.evaluation"
            path.write_text(
                "\n".join(
                    [
                        "SUPABASE_URL=https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY=test-secret-key",
                    ]
                ),
                encoding="utf-8",
            )

            with patch.dict("os.environ", {}, clear=True):
                store = EvaluationSupabaseStore.from_env_file(path)

            self.assertEqual(store.url, "https://example.supabase.co")
            self.assertEqual(store.service_role_key, "test-secret-key")

    def test_missing_env_file_reports_safe_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env.evaluation"

            with patch.dict("os.environ", {}, clear=True), self.assertRaises(EvaluationSupabaseStoreError) as raised:
                EvaluationSupabaseStore(env_file=path)

            message = str(raised.exception)
            self.assertIn(str(path), message)
            self.assertIn("env_file_exists=False", message)
            self.assertIn("SUPABASE_URL_present=False", message)
            self.assertIn("SUPABASE_SERVICE_ROLE_KEY_present=False", message)

    def test_missing_required_variables_reports_presence_without_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env.evaluation"
            path.write_text("SUPABASE_SERVICE_ROLE_KEY=test-secret-key\n", encoding="utf-8")

            with patch.dict("os.environ", {}, clear=True), self.assertRaises(EvaluationSupabaseStoreError) as raised:
                EvaluationSupabaseStore(env_file=path)

            message = str(raised.exception)
            self.assertIn("env_file_exists=True", message)
            self.assertIn("SUPABASE_URL_present=False", message)
            self.assertIn("SUPABASE_SERVICE_ROLE_KEY_present=True", message)
            self.assertNotIn("test-secret-key", message)

    def test_evaluation_env_rejects_vite_service_role_variable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env.evaluation"
            path.write_text(
                "\n".join(
                    [
                        "SUPABASE_URL=https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY=test-secret-key",
                        f"VITE_SUPABASE_{'SERVICE_ROLE_KEY'}=unsafe",
                    ]
                ),
                encoding="utf-8",
            )

            with patch.dict("os.environ", {}, clear=True), self.assertRaises(EvaluationSupabaseStoreError):
                load_evaluation_env_file(path)

    def test_supabase_store_redacts_service_key_from_errors(self):
        store = EvaluationSupabaseStore("https://example.supabase.co", "test-secret-key")

        class Response:
            status_code = 500
            text = "failed with test-secret-key"

        store.session.request = lambda *args, **kwargs: Response()

        with self.assertRaises(EvaluationSupabaseStoreError) as raised:
            store.list_golden_references()

        self.assertNotIn("test-secret-key", str(raised.exception))
        self.assertIn("[REDACTED]", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
