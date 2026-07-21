# PSA_023 Three-Reference Diagnostic

## Summary

| Model | Canonical WER | Biblica WER | Spoken WER | Raw Spoken WER | Best Ref | Resolution | Coverage |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| small | 1.8372 | 0.8046 | 0.7717 | 0.8152 | human_spoken | 0.8333 | 0.4966 |
| medium | 1.6512 | 0.5747 | 0.5109 | 0.5652 | human_spoken | 1.0000 | 0.6484 |

## Verse Diagnostic

| Model | Verse | Spoken WER | Canonical WER | Biblica WER | Cause | Start Drift | End Drift |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| small | 1 | 1.0000 | 1.0000 | 1.0000 | verse_assignment_error | - | - |
| small | 2 | 0.4545 | 1.0000 | 0.4545 | ASR_omission | 320 | -560 |
| small | 3 | 1.0000 | 4.0000 | 1.0000 | ASR_substitution | -240 | -580 |
| small | 4 | 0.7500 | 2.0000 | 0.7826 | ASR_substitution | -1580 | 60 |
| small | 5 | 0.6000 | 0.8750 | 0.6000 | ASR_omission | 520 | -620 |
| small | 6 | 0.6471 | 0.8000 | 0.6471 | ASR_omission | -100 | -2080 |
| medium | 1 | 0.3333 | 1.0000 | 0.7500 | reference_mismatch | -940 | 100 |
| medium | 2 | 0.1818 | 0.8333 | 0.1818 | needs_review | 460 | -440 |
| medium | 3 | 0.8462 | 4.0000 | 0.8462 | ASR_substitution | -360 | -660 |
| medium | 4 | 0.2500 | 1.5556 | 0.2174 | mixed | -840 | 380 |
| medium | 5 | 0.6000 | 0.6250 | 0.6000 | ASR_omission | 680 | -2360 |
| medium | 6 | 0.5294 | 0.7000 | 0.5294 | ASR_omission | -520 | -2000 |

## Introduction Analysis

| Model | Expected | Detected | Raw WER | Cleaned WER | Extra Words |
| --- | --- | --- | ---: | ---: | ---: |
| small | Zaburi ya ishirini na tatu | Zaburi aishirini na tatu. Muñezi | 0.8152 | 0.7717 | 5 |
| medium | Zaburi ya ishirini na tatu | Zaburi ya ishirini na tatu | 0.5652 | 0.5109 | 5 |

## Diagnostic Answers

- Biblica closeness is determined by the lower chapter WER/CER versus the canonical reference in the summary table.
- Human spoken-reference improvement estimates the reference-mismatch share; remaining spoken WER is treated as ASR, timing, or assignment error evidence.
- Introduction contamination is reported separately using the workbook introduction timestamps and raw-versus-cleaned WER.
- Likely causes are deterministic labels, not semantic-equivalence claims.
