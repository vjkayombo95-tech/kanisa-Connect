# Biblica Open Kiswahili Rescore

| Model | Chapter | WER | CER | Token Similarity | Word Order | Aligned | Recovered | Unresolved | Coverage | Output |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| faster-whisper-small | GEN_001 | 0.7622 | 0.1043 | 0.2378 | 0.2010 | 31 | 9 | 0 | 0.5073 | `evaluation\speech_lab\model_outputs\faster-whisper-small\GEN_001.biblica-aligned-v2-1.json` |
| faster-whisper-small | MAT_005 | 0.7931 | 0.1269 | 0.2069 | 0.1686 | 46 | 14 | 2 | 0.5296 | `evaluation\speech_lab\model_outputs\faster-whisper-small\MAT_005.biblica-aligned-v2-1.json` |
| faster-whisper-small | PSA_023 | 0.8621 | 0.1765 | 0.2188 | 0.2759 | 6 | 2 | 0 | 0.4797 | `evaluation\speech_lab\model_outputs\faster-whisper-small\PSA_023.biblica-aligned-v2-1.json` |
| faster-whisper-small | ROM_008 | 0.7443 | 0.1526 | 0.2557 | 0.1873 | 37 | 3 | 2 | 0.5436 | `evaluation\speech_lab\model_outputs\faster-whisper-small\ROM_008.biblica-aligned-v2.json` |
| faster-whisper-medium | GEN_001 | 0.5857 | 0.0693 | 0.4351 | 0.3182 | 31 | 1 | 0 | 0.6602 | `evaluation\speech_lab\model_outputs\faster-whisper-medium\GEN_001.biblica-aligned-v2.json` |
| faster-whisper-medium | MAT_005 | 0.5692 | 0.0806 | 0.4353 | 0.3847 | 48 | 3 | 0 | 0.7028 | `evaluation\speech_lab\model_outputs\faster-whisper-medium\MAT_005.biblica-aligned-v2.json` |
| faster-whisper-medium | PSA_023 | 0.6322 | 0.1345 | 0.4500 | 0.4483 | 6 | 1 | 0 | 0.6330 | `evaluation\speech_lab\model_outputs\faster-whisper-medium\PSA_023.biblica-aligned-v2.json` |
| faster-whisper-medium | ROM_008 | 0.5620 | 0.1147 | 0.4721 | 0.3582 | 38 | 0 | 1 | 0.6991 | `evaluation\speech_lab\model_outputs\faster-whisper-medium\ROM_008.biblica-aligned-v2.json` |

## Macro Averages

| Model | WER | CER | Token Similarity | Word Order | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| faster-whisper-medium | 0.5873 | 0.0998 | 0.4481 | 0.3774 | 0.6738 |
| faster-whisper-small | 0.7904 | 0.1401 | 0.2298 | 0.2082 | 0.5151 |
