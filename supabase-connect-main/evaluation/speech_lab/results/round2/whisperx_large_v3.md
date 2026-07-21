# WhisperX large-v3 Round 2 Report

## Configuration

| Field | Value |
| --- | --- |
| provider | whisperx |
| model | large-v3 |
| language | sw |
| alignment | en |
| translation | sw-biblica |
| batch_size | 8 |
| compute_type | float32 |

## Chapter Results

| Chapter | WER | CER | Boundary Accuracy | Verse Confidence | Time | Warnings |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Genesis 1 | 0.328 | 0.119 | 0.323 | 0.252 | 1265.10s | repeated_phrases:13, extremely_short_spans:11, long_silence_gaps:3, missing_verse_boundaries:21 |
| Psalm 23 | 0.395 | 0.204 | 1.000 | 0.724 | 191.88s | long_silence_gaps:2 |
| Matthew 5 | 0.379 | 0.135 | 1.000 | 0.740 | 1242.54s | repeated_phrases:5, long_silence_gaps:20 |
| John 3 | 0.370 | 0.147 | 0.444 | 0.311 | 893.46s | repeated_phrases:2, extremely_short_spans:1, long_silence_gaps:6, missing_verse_boundaries:20 |
| Romans 8 | 0.373 | 0.168 | 0.974 | 0.695 | 1191.51s | repeated_phrases:8, long_silence_gaps:8, missing_verse_boundaries:1 |
