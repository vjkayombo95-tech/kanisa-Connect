# WhisperX Baseline Report

Generated: 2026-07-09T10:10:12.290168+00:00

## Configuration

| Field | Value |
| --- | --- |
| provider | WhisperX |
| model | base |
| language | sw |
| alignment | en |
| translation | sw-biblica |
| batch_size | 8 |
| compute_type | float32 |

## Chapter Results

| Chapter | WER | CER | Boundary Accuracy | Verse Confidence | Processing Time | Peak RAM | Warnings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Genesis 1 | 0.808 | 0.260 | 0.258 | 0.189 | 156.90s | 347.88 MB | repeated_phrases:1, extremely_short_spans:17, long_silence_gaps:3, missing_verse_boundaries:23 |
| Psalm 23 | 0.895 | 0.289 | 0.667 | 0.490 | 23.34s | 9.17 MB | long_silence_gaps:2, missing_verse_boundaries:2 |
| Matthew 5 | 0.950 | 0.325 | 0.417 | 0.269 | 174.75s | 72.16 MB | repeated_phrases:3, extremely_short_spans:22, long_silence_gaps:20, missing_verse_boundaries:28 |
| John 3 | 0.987 | 0.331 | 0.444 | 0.277 | 135.30s | 57.83 MB | repeated_phrases:5, extremely_short_spans:2, long_silence_gaps:6, missing_verse_boundaries:20 |
| Romans 8 | 1.001 | 0.381 | 0.128 | 0.070 | 162.30s | 69.44 MB | repeated_phrases:3, extremely_short_spans:11, long_silence_gaps:8, missing_verse_boundaries:34 |

## Engineering Assessment

### Strengths
- The service-role runtime successfully retrieves the fixed sw-biblica benchmark corpus under RLS.
- WhisperX completed transcription and alignment for all five benchmark chapters.
- Processing time, RAM usage, confidence, boundary, WER, CER, and audit signals are now captured per chapter.

### Weaknesses
- Boundary accuracy and verse confidence are below production acceptance targets.
- WER and CER are above the minimum production target for the fixed corpus.
- Several chapters show missing boundary events and quality-audit warnings.

### Known Blockers
- The baseline is not production-ready for synchronized Swahili Bible indexing under the stated acceptance thresholds.
- Matthew 5, John 3, and Romans 8 remain challenging for verse boundary recovery with the current configuration.

### Recommendations
- Keep this result as the objective WhisperX base baseline.
- Do not change production configuration based on this round alone.
- Use these artifacts as the fixed comparison point before evaluating any future provider.
