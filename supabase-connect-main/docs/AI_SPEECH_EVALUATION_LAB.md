# AI Speech Evaluation Program

The speech evaluation laboratory lives under `evaluation/speech_lab`. It is intentionally separate from Kanisa Connect feature development and production audio/indexing code.

## Architecture

- `SpeechEvaluationRunner` coordinates corpus, models, golden references, providers, metrics, resource capture, and reports.
- `GoldenReferenceManager` owns manually corrected transcripts.
- `MetricCalculators` provides WER, CER, boundary accuracy, alignment accuracy, word confidence, and verse confidence.
- `ComparisonReportGenerator` emits Markdown, CSV, JSON, HTML, comparison tables, and leaderboard ranking.
- Provider adapters live under `evaluation/speech_lab/providers`.

## Data Flow

1. Golden references are stored as JSON under `evaluation/speech_lab/golden`.
2. Model outputs are captured under `evaluation/speech_lab/model_outputs/<model-id>/<chapter-id>.json`.
3. The runner loads the fixed benchmark corpus.
4. The selected provider returns a normalized transcript.
5. Metrics are calculated against the golden reference.
6. Resource measurements and acceptance notes are attached.
7. Reports are written to `evaluation/speech_lab/reports`.

## Boundary Rules

The lab must not modify:

- Speech Engine
- Universal Audio Platform
- Synchronization Engine
- Bible Index Engine
- Production indexes
- Kanisa Connect production UI or routes

The lab can consume copied/captured files, but output is always an engineering report.

## Benchmark Chapters

- Genesis 1
- Psalm 23
- Matthew 5
- John 3
- Romans 8

## Metrics

- Word Error Rate
- Character Error Rate
- Boundary Accuracy
- Alignment Accuracy
- Average Word Confidence
- Verse Confidence
- Processing Time
- Peak RAM
- Peak VRAM
- GPU Utilization
- CPU Utilization
- Output Stability

## Acceptance Targets

- WER < 5%
- Boundary Accuracy > 99%
- Verse Confidence > 0.95
- Processing Time recorded
- Memory usage recorded

## Running

```bash
python -m evaluation.speech_lab.cli init-golden
python -m evaluation.speech_lab.cli run
```

For deterministic comparisons, place captured outputs from WhisperX, Faster-Whisper, Whisper, Whisper Turbo, NVIDIA Parakeet, Meta MMS, custom wav2vec2 alignment, or future SpeechEngine providers into the model output folder before running the report.
