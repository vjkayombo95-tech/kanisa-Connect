# PSA_023 Large Model Comparison

| Rank | Candidate | WER | Raw WER | CER | Rel Improvement | Runtime | Coverage | Decision |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | large-v3-turbo | 0.3152 | 0.3696 | 0.0377 | 0.3556 | 56.35 | 0.7928 | substantial_improvement |
| 2 | medium_vad_tuned | 0.4891 | 0.5435 | 0.0615 | 0.0000 | 101.78 | 0.6930 | no_improvement |

## Problem Verses

| Candidate | Verse | WER | CER | Ins | Del | Sub | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| medium_vad_tuned | 3 | 0.8462 | 0.0625 | 0 | 1 | 10 | recovered_between_neighbors |
| medium_vad_tuned | 5 | 0.6667 | 0.4222 | 0 | 7 | 3 | aligned |
| medium_vad_tuned | 6 | 0.4118 | 0.3846 | 0 | 5 | 2 | aligned |
| large-v3-turbo | 3 | 0.3077 | 0.2812 | 0 | 4 | 0 | aligned |
| large-v3-turbo | 5 | 0.4667 | 0.2000 | 0 | 4 | 3 | aligned |
| large-v3-turbo | 6 | 0.3529 | 0.3736 | 0 | 5 | 1 | aligned |

## Answers

- WER below 0.35 achieved: yes.
- Best measured candidate: `large-v3-turbo`.
- Ranking uses cleaned exact-spoken WER, then CER, verse resolution, coverage, and runtime.
- Production recommendation requires more than a tiny single-chapter gain.
