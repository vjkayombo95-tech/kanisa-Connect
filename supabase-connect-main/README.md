# Kanisa Connect

## Audio Speech Engine

The production audio pipeline uses a provider-based speech engine boundary.
Speech backends must implement `SpeechEngine` and return the shared
`StandardTranscript` schema with language, text, segments, word timestamps,
word confidence, and metadata.

The current production provider is `whisperx`. Future providers can be added
without changing the verse indexing engine, QA system, resume logic, validation,
or import pipeline.

See [Speech Engine Architecture](docs/SPEECH_ENGINE_ARCHITECTURE.md).

Speech providers can be compared with the benchmark runner before production
adoption. See [Speech Engine Benchmarking](docs/SPEECH_ENGINE_BENCHMARKING.md).
