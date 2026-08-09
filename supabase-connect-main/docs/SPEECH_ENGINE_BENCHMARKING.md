# Speech Engine Benchmarking

Kanisa Connect benchmarks SpeechEngine providers before they are considered for
production use. Benchmarks are independent from production processing and never
write production indexes.

## Benchmark Corpus

The permanent benchmark set is:

- Genesis 1
- Psalm 23
- Matthew 5
- John 3
- Romans 8

All providers run against the same audio and the same Bible text provider.

## Running A Benchmark

From the project root:

```powershell
supabase\audio\.venv\Scripts\python.exe supabase\audio\scripts\benchmark_speech_engines.py
```

To run a single provider:

```powershell
supabase\audio\.venv\Scripts\python.exe supabase\audio\scripts\benchmark_speech_engines.py --provider whisperx
```

Reports are written to:

```text
supabase/audio/reports/benchmarks/
```

## Report Formats

The benchmark runner writes:

- `speech_engine_benchmark.json`
- `speech_engine_benchmark.md`
- `speech_engine_benchmark.html`
- `speech_engine_benchmark.csv`

The reports include per-chapter metrics and provider ranking tables.

## Metrics

For every provider and chapter, the runner records:

- Processing time
- Peak Python memory during provider execution
- Transcript language
- Word count
- Average word confidence
- Boundary success rate
- Boundary failures
- Average verse confidence
- QA score
- Import precondition success

Import success means the generated in-memory verse index passes validation. The
benchmark does not call the production import writer.

## Scorecard

Weighted score is out of 100 points:

- Accuracy: 30 points from average word confidence.
- Alignment quality: 25 points from boundary success rate.
- Verse confidence: 20 points from average verse confidence.
- Processing speed: 10 points, decreasing linearly to zero at 600 seconds.
- Memory usage: 5 points, decreasing linearly to zero at 4096 MB.
- Reliability: 10 points when import precondition validation succeeds.

The formula intentionally rewards providers that produce usable word timestamps
and verse boundaries, not only fast transcripts.

## Adding Benchmark Audio

Benchmark audio should be discoverable by the configured audio provider. For the
Open Bible provider, place chapter files under the configured base directory
using canonical names such as:

```text
GEN/GEN_001.mp3
PSA/PSA_023.mp3
MAT/MAT_005.mp3
JHN/JHN_003.mp3
ROM/ROM_008.mp3
```

Bible text must already exist in the configured text provider.

## Adding A Provider

1. Implement `SpeechEngine.process(audio_path)`.
2. Return the stable `StandardTranscript` schema with `words` populated when
   word-level timing is available.
3. Register the provider in `speech/factory.py`.
4. Run the benchmark with `--provider <name>`.
5. Compare JSON, CSV, Markdown, and HTML reports before production adoption.

Placeholder providers appear in the registry but report unavailable until their
implementation is complete.

## Interpreting Results

A provider should not be considered production-ready from transcript quality
alone. Review all of these together:

- High weighted score
- High boundary success rate
- High average verse confidence
- Low boundary failures
- Consistent language detection
- Acceptable processing time and memory
- Import precondition success across the corpus

The benchmark is a decision support tool. Production adoption still requires
security, operations, and regression validation.
