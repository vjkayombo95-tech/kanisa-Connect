# PSA_023 Medium Optimization

| Rank | Config | WER | CER | Runtime | Resolution | Coverage | Unresolved |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | medium_vad_tuned | 0.4891 | 0.0615 | 101.78 | 1.0000 | 0.6930 |  |
| 2 | medium_bible_prompt | 0.4891 | 0.0615 | 138.83 | 1.0000 | 0.6636 |  |
| 3 | baseline_medium | 0.5109 | 0.0536 | 111.75 | 1.0000 | 0.6484 |  |
| 4 | medium_beam5 | 0.5109 | 0.0536 | 179.27 | 1.0000 | 0.6484 |  |
| 5 | medium_bestof5 | 0.5217 | 0.0516 | 76.19 | 1.0000 | 0.6544 |  |
| 6 | medium_bestof10 | 0.5217 | 0.0516 | 75.04 | 1.0000 | 0.6544 |  |
| 7 | medium_no_previous_context | 0.5217 | 0.0516 | 106.90 | 1.0000 | 0.6373 |  |
| 8 | medium_beam10 | 0.5326 | 0.0575 | 164.87 | 1.0000 | 0.6345 |  |

## Recommendation

- Best measured configuration: `medium_vad_tuned`.
- Ranking is ordered by human spoken WER, then CER, then verse resolution.
