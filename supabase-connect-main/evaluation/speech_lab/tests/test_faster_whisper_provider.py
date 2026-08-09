import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from evaluation.speech_lab.cli import main
from evaluation.speech_lab.corpus import chapter_by_id
from evaluation.speech_lab.models import Transcript, WordTiming
from evaluation.speech_lab.providers.faster_whisper_provider import (
    FasterWhisperProvider,
    FasterWhisperProviderError,
    resolve_audio_path,
)


class FasterWhisperProviderTests(unittest.TestCase):
    def test_provider_construction_uses_cpu_safe_defaults(self):
        with patch("evaluation.speech_lab.providers.faster_whisper_provider.detect_device", return_value="cpu"):
            provider = FasterWhisperProvider(model_name="small")

        self.assertEqual(provider.runtime.language, "sw")
        self.assertEqual(provider.runtime.device, "cpu")
        self.assertEqual(provider.runtime.compute_type, "int8")
        self.assertEqual(provider.runtime.resolved_model_name, "Systran/faster-whisper-small")

    def test_audio_path_resolution_uses_explicit_file(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = Path(directory) / "GEN_001.mp3"
            audio.write_bytes(b"audio")

            self.assertEqual(resolve_audio_path("GEN_001", audio), audio)

    def test_missing_audio_raises_file_not_found(self):
        with self.assertRaises(FileNotFoundError):
            resolve_audio_path("GEN_001", Path("missing-audio.mp3"))

    def test_transcript_serialization_shape(self):
        transcript = Transcript(
            chapter_id="GEN_001",
            text="Mwanzo",
            words=[WordTiming(word="Mwanzo", start_ms=0, end_ms=500, confidence=0.9)],
            metadata={"provider": "faster-whisper"},
        )

        payload = json.loads(json.dumps(transcript.to_dict()))

        self.assertEqual(payload["chapter_id"], "GEN_001")
        self.assertEqual(payload["words"][0]["word"], "Mwanzo")
        self.assertEqual(payload["metadata"]["provider"], "faster-whisper")

    def test_cli_transcribe_parses_and_writes_output(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = Path(directory) / "GEN_001.mp3"
            output = Path(directory) / "GEN_001.json"
            audio.write_bytes(b"audio")
            fake_provider = Mock()
            fake_provider.runtime.model_name = "small"
            fake_provider.runtime.resolved_model_name = "Systran/faster-whisper-small"
            fake_provider.runtime.device = "cpu"
            fake_provider.runtime.compute_type = "int8"
            fake_provider.runtime.language = "sw"
            fake_provider.runtime.cached = True
            fake_provider.transcribe.return_value = Transcript(
                chapter_id="GEN_001",
                text="Mwanzo",
                metadata={"transcription_runtime_seconds": 1.25},
            )
            argv = [
                "cli",
                "transcribe",
                "--provider",
                "faster-whisper",
                "--model",
                "small",
                "--chapter",
                "GEN_001",
                "--audio",
                str(audio),
                "--output",
                str(output),
            ]

            with patch.object(sys, "argv", argv), patch("evaluation.speech_lab.cli.FasterWhisperProvider", return_value=fake_provider):
                exit_code = main()

            self.assertEqual(exit_code, 0)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["chapter_id"], "GEN_001")
            fake_provider.transcribe.assert_called_once_with(chapter_by_id("GEN_001"), audio)

    def test_missing_faster_whisper_dependency_reports_actionable_error(self):
        provider = FasterWhisperProvider(model_name="small", device="cpu", compute_type="int8")

        with patch("evaluation.speech_lab.providers.faster_whisper_provider.importlib.import_module", side_effect=ImportError):
            with self.assertRaises(FasterWhisperProviderError) as raised:
                provider._whisper_model()

        self.assertIn("faster-whisper is required", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
