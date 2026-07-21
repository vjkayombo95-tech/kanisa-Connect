"""Tests for YAML config loading."""

from __future__ import annotations

from pathlib import Path

from lib.config import get_config


def test_config_loader_reads_yaml_processing_values(tmp_path: Path) -> None:
    """get_config should load retry, backoff, overwrite, and path values."""

    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        """
paths:
  source: custom_source
  reports: custom_reports
processing:
  retries: 5
  backoff_seconds: 1.5
  overwrite: true
whisper:
  language: sw
alignment:
  language: en
  model_dir: custom_alignment_models
speech_engine:
  provider: whisperx
  transcription_model: large-v3
  alignment_model: custom-align
  language: sw
  provider_options:
    device: cpu
qa:
  minimum_confidence: 0.91
  warning_confidence: 0.96
  flag_low_confidence: false
indexing:
  boundary_rolling_window_tokens: 120
  minimum_verse_duration_seconds: 0.1
audio_provider: open_bible
audio_provider_options:
  base_dir: open-bible-audio
text_provider: supabase
text_provider_options:
  translation: CPDV
""",
        encoding="utf-8",
    )

    config = get_config(config_path)

    assert config.source_dir.name == "custom_source"
    assert config.reports_dir.name == "custom_reports"
    assert config.retries == 5
    assert config.backoff_seconds == 1.5
    assert config.overwrite is True
    assert config.whisper_language == "sw"
    assert config.alignment_language == "en"
    assert config.speech_engine_provider == "whisperx"
    assert config.speech_transcription_model == "large-v3"
    assert config.speech_alignment_model == "custom-align"
    assert config.speech_language == "sw"
    assert config.speech_provider_options == {"device": "cpu"}
    assert config.qa_minimum_confidence == 0.91
    assert config.qa_warning_confidence == 0.96
    assert config.qa_flag_low_confidence is False
    assert config.boundary_rolling_window_tokens == 120
    assert config.minimum_verse_duration_seconds == 0.1
    assert config.alignment_model_dir is not None
    assert config.alignment_model_dir.name == "custom_alignment_models"
    assert config.audio_provider == "open_bible"
    assert config.audio_provider_base_dir.name == "open-bible-audio"
    assert config.text_provider == "supabase"
    assert config.text_provider_translation == "CPDV"
