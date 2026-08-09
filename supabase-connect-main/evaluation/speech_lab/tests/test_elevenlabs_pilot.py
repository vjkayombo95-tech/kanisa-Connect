from __future__ import annotations

import json
import tempfile
import urllib.error
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from evaluation.speech_lab.elevenlabs_pilot import (
    ElevenLabsPilotError,
    build_plan,
    invoke_edge_function,
    load_env_file,
    plan_to_safe_dict,
    request_payload,
)


class ElevenLabsPilotTests(unittest.TestCase):
    def _sample(self, directory: str, text: str = "Bwana ndiye mchungaji wangu.") -> Path:
        path = Path(directory) / "sample.txt"
        path.write_text(text, encoding="utf-8")
        return path

    def test_dry_run_builds_safe_plan_without_api_key_or_secret_leakage(self):
        with tempfile.TemporaryDirectory() as directory:
            sample = self._sample(directory)
            with patch.dict("os.environ", {"ELEVENLABS_VOICE_ID": "voice-secret-123456", "ELEVENLABS_MODEL_ID": "model-a"}, clear=True):
                plan = build_plan(test_id="PSA_023_PILOT_001", text_file=sample, dry_run=True)
        payload = json.dumps(plan_to_safe_dict(plan))
        self.assertIn("voic...3456", payload)
        self.assertNotIn("voice-secret-123456", payload)
        self.assertEqual(plan.estimated_api_requests, 0)
        self.assertEqual(plan.destination_bucket, "bible-audio-pilot")
        self.assertNotIn("open bible", plan.destination_path.lower())
        self.assertNotIn("extracted", plan.destination_path.lower())

    def test_character_limit_blocks_large_samples(self):
        with tempfile.TemporaryDirectory() as directory:
            sample = self._sample(directory, "a" * 501)
            with patch.dict("os.environ", {"ELEVENLABS_VOICE_ID": "voice"}, clear=True):
                with self.assertRaises(ElevenLabsPilotError):
                    build_plan(test_id="PSA_023_PILOT_001", text_file=sample, dry_run=True)

    def test_payload_requires_confirmation_for_billable_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            sample = self._sample(directory)
            with patch.dict("os.environ", {"ELEVENLABS_VOICE_ID": "voice"}, clear=True):
                plan = build_plan(test_id="PSA_023_PILOT_001", text_file=sample, dry_run=False)
        payload = request_payload(plan, confirm_billable_generation=False)
        self.assertFalse(payload["dryRun"])
        self.assertFalse(payload["confirmBillableGeneration"])
        self.assertEqual(payload["testId"], "PSA_023_PILOT_001")

    def test_diagnostic_payload_is_non_billable(self):
        with tempfile.TemporaryDirectory() as directory:
            sample = self._sample(directory)
            with patch.dict("os.environ", {"ELEVENLABS_VOICE_ID": "voice"}, clear=True):
                plan = build_plan(test_id="PSA_023_PILOT_001", text_file=sample, dry_run=True)
        payload = request_payload(plan, confirm_billable_generation=False, diagnostic=True)
        self.assertTrue(payload["pilot"])
        self.assertTrue(payload["dryRun"])
        self.assertTrue(payload["diagnostic"])
        self.assertFalse(payload["confirmBillableGeneration"])

    def test_bulk_like_sample_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            sample = self._sample(directory, "mstari wa kwanza\nmstari wa pili\nmstari wa tatu")
            with patch.dict("os.environ", {"ELEVENLABS_VOICE_ID": "voice"}, clear=True):
                with self.assertRaises(ElevenLabsPilotError):
                    build_plan(test_id="PSA_023_PILOT_001", text_file=sample, dry_run=True)

    def test_env_file_loader_reads_simple_name_value_without_leaking_values(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.local"
            env_file.write_text(
                "ELEVENLABS_API_KEY=secret-api-key\n"
                "ELEVENLABS_VOICE_ID='voice-secret-123456'\n",
                encoding="utf-8",
            )
            with patch("evaluation.speech_lab.elevenlabs_pilot.load_dotenv", None):
                with patch.dict("os.environ", {}, clear=True):
                    load_env_file(env_file)
                    self.assertEqual("secret-api-key", __import__("os").environ["ELEVENLABS_API_KEY"])
                    self.assertEqual("voice-secret-123456", __import__("os").environ["ELEVENLABS_VOICE_ID"])

    def test_http_error_reports_only_sanitized_function_error(self):
        body = json.dumps(
            {
                "ok": False,
                "stage": "elevenlabs_response_received",
                "error_code": "ELEVENLABS_PROVIDER_ERROR",
                "message": "ElevenLabs pilot request failed with status 401.",
                "provider_status": 401,
                "retryable": False,
                "test_id": "PSA_023_PILOT_001",
                "authorization": "secret-jwt",
                "xi-api-key": "secret-api-key",
            }
        ).encode("utf-8")
        http_error = urllib.error.HTTPError(
            url="https://example.test",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=BytesIO(body),
        )
        with patch("urllib.request.urlopen", side_effect=http_error):
            with self.assertRaises(ElevenLabsPilotError) as raised:
                invoke_edge_function(
                    function_url="https://example.test",
                    access_token="jwt-secret",
                    payload={"pilot": True},
                )
        message = str(raised.exception)
        self.assertIn("HTTP 400", message)
        self.assertIn("ELEVENLABS_PROVIDER_ERROR", message)
        self.assertNotIn("secret-api-key", message)
        self.assertNotIn("secret-jwt", message)
        self.assertNotIn("authorization", message)

    def test_connection_reset_reports_ambiguous_outcome_without_retrying(self):
        with patch("urllib.request.urlopen", side_effect=ConnectionResetError(10054, "reset")):
            with self.assertRaises(ElevenLabsPilotError) as raised:
                invoke_edge_function(
                    function_url="https://example.test",
                    access_token="jwt-secret",
                    payload={"pilot": True, "dryRun": False},
                )
        message = str(raised.exception)
        self.assertIn("connection reset", message)
        self.assertIn("outcome is ambiguous", message)
        self.assertNotIn("jwt-secret", message)


if __name__ == "__main__":
    unittest.main()
