# Mini Large-Model Validation

Overall confidence: `strong_generalization`

| Sample | Model | WER | CER | Coverage | Resolution | Runtime |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| GEN_001_1_10 | large-v3 | 0.3706 | 0.0447 | 0.7820 | 1.0000 | 1024.95 |
| GEN_001_1_10 | large-v3-turbo | 0.3776 | 0.0346 | 0.7638 | 1.0000 | 141.13 |
| GEN_001_1_10 | medium_vad_tuned | 0.5664 | 0.0505 | 0.6851 | 1.0000 | 170.20 |
| MAT_005_1_10 | large-v3-turbo | 0.2247 | 0.0584 | 0.8970 | 1.0000 | 70.12 |
| MAT_005_1_10 | large-v3 | 0.3146 | 0.0628 | 0.8480 | 1.0000 | 710.94 |
| MAT_005_1_10 | medium_vad_tuned | 0.6742 | 0.1017 | 0.6510 | 0.9000 | 125.60 |
| ROM_008_1_10 | large-v3-turbo | 0.2466 | 0.0382 | 0.8635 | 1.0000 | 187.77 |
| ROM_008_1_10 | large-v3 | 0.3767 | 0.2314 | 0.8692 | 0.7000 | 392.80 |
| ROM_008_1_10 | medium_vad_tuned | 0.4170 | 0.0745 | 0.7433 | 1.0000 | 261.29 |

## Answers

- Large-v3 beat Medium in 3 of 3 subsets.
- Turbo stayed within 15% of Large-v3 in 3 of 3 subsets.
- Most benefited subset: `MAT_005_1_10`.
- Full benchmark justified: yes.
- Estimated mini-validation CPU runtime before execution: 1564.2s.
- Estimated full benchmark CPU cost should be projected from these cached-model runtimes before running full chapters.
