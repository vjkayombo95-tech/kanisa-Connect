# Speech Engine Architecture

The audio pipeline uses a provider-based speech engine boundary. The indexing
engine consumes a standard word-level transcript and does not call any model
API directly.

## Architecture Diagram

```text
Audio file
   |
   v
SpeechEngine provider
   | process(audio_path)
   v
StandardTranscript
   | language
   | text
   | segments
   | words
   | word confidence
   | metadata
   v
Alignment artifact JSON
   | segments
   | word_segments
   v
Index builder
   |
   v
Verse index, QA report, import pipeline
```

## Provider Interface

Every speech backend implements `SpeechEngine`:

```python
class SpeechEngine:
    def process(self, audio_path): ...
    def supported_languages(self): ...
    def model_info(self): ...
    def health_check(self): ...
```

`process()` returns a complete `StandardTranscript`. Providers may perform
transcription, alignment, direct word timestamp extraction, or future verse
alignment internally. Pipeline and indexing code do not call provider-specific
transcription or alignment methods.

The active implementation is configured in `supabase/audio/config.yaml`:

```yaml
speech_engine:
  provider: whisperx
  transcription_model: base
  alignment_model:
  language: sw
  provider_options: {}
```

Legacy `whisper` and `alignment` sections remain supported for compatibility.

## Standard Transcript Schema

Providers return `StandardTranscript`:

```json
{
  "language": "sw",
  "text": "chapter transcript text",
  "segments": [
    {
      "start": 13.208,
      "end": 16.551,
      "text": "Hapo mwanzo Mungu..."
    }
  ],
  "words": [
    {
      "text": "Hapo",
      "start": 13.208,
      "end": 13.489,
      "confidence": 0.944,
      "speaker": null
    }
  ],
  "metadata": {
    "provider": "whisperx"
  }
}
```

The alignment artifact still writes `segments` and `word_segments` for backward
compatibility. The index builder reads only the generic `word_segments` array.

## Current Provider

`WhisperXSpeechEngine` is the production adapter. It owns all WhisperX imports,
model loading, transcription normalization, alignment normalization, torchaudio
cache detection, and model metadata.

No other pipeline stage imports WhisperX.

## Future Providers

The following provider classes exist as interface placeholders:

- `FasterWhisperSpeechEngine`
- `ParakeetSpeechEngine`
- `MMSSpeechEngine`
- `CustomAlignmentSpeechEngine`

They intentionally do not load models yet. They provide `model_info()` and
`health_check()` and raise a configuration error if selected before integration.

## Adding A Provider

1. Implement `SpeechEngine`.
2. Return a complete `StandardTranscript` from `process()`.
3. Populate `words` when word timestamps are available.
4. Add the provider to `speech/factory.py`.
5. Add tests proving the provider emits the standard schema.
6. Switch `speech_engine.provider` in config.

Indexing, QA, validation, resume, and import stages should not require changes.

## Migration Notes

Existing WhisperX artifacts remain compatible because the pipeline still writes:

- transcript artifacts with `language`, `text`, and `segments`
- alignment artifacts with `segments` and `word_segments`

New artifacts also include:

- `standard_transcript`
- `speech_engine`

These fields allow model comparison without changing the indexer contract.
