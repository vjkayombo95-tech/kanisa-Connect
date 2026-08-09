# Faster-Whisper large-v3 Round 2 Report

## Configuration

| Field | Value |
| --- | --- |
| provider | faster_whisper |
| model | large-v3 |
| language | sw |
| alignment | en |
| translation | sw-biblica |
| batch_size | 8 |
| compute_type | float32 |

## Chapter Results

| Chapter | WER | CER | Boundary Accuracy | Verse Confidence | Time | Warnings |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Genesis 1 | 0.329 | 0.122 | 0.645 | 0.495 | 1199.91s | repeated_phrases:18, extremely_short_spans:7, long_silence_gaps:3, missing_verse_boundaries:11 |
| Psalm 23 | 0.395 | 0.206 | 1.000 | 0.686 | 313.71s | long_silence_gaps:2 |
| Matthew 5 | 0.401 | 0.193 | 0.604 | 0.433 | 1730.94s | repeated_phrases:6, extremely_short_spans:1, long_silence_gaps:20, missing_verse_boundaries:19 |
| John 3 | 0.393 | 0.158 | 0.444 | 0.287 | 1528.47s | repeated_phrases:4, extremely_short_spans:1, long_silence_gaps:6, missing_verse_boundaries:20 |
| Romans 8 | 0.369 | 0.169 | 0.256 | 0.155 | 1690.38s | repeated_phrases:7, extremely_short_spans:17, long_silence_gaps:8, missing_verse_boundaries:29 |
