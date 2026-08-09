# PSA_023 Forensic Analysis

| Model | Verse | WER | CER | Ins | Del | Sub | Status | Start Drift | End Drift | Leakage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| small | 1 | 1.0000 | 1.0000 | 0 | 12 | 0 | low_confidence | - | - | 0 |
| small | 2 | 0.4545 | 0.4923 | 0 | 4 | 1 | aligned | 320 | -560 | 0 |
| small | 3 | 1.0000 | 0.1250 | 0 | 1 | 12 | recovered_between_neighbors | -240 | -580 | 0 |
| small | 4 | 0.7500 | 0.1176 | 2 | 4 | 12 | recovered_between_neighbors | -1580 | 60 | 1 |
| small | 5 | 0.6000 | 0.5333 | 0 | 7 | 2 | aligned | 520 | -620 | 0 |
| small | 6 | 0.6471 | 0.5824 | 0 | 9 | 2 | aligned | -100 | -2080 | 0 |
| medium | 1 | 0.3333 | 0.2667 | 0 | 2 | 2 | aligned | -940 | 100 | 0 |
| medium | 2 | 0.1818 | 0.2769 | 0 | 2 | 0 | aligned | 460 | -440 | 0 |
| medium | 3 | 0.8462 | 0.0625 | 0 | 1 | 10 | recovered_between_neighbors | -360 | -660 | 0 |
| medium | 4 | 0.2500 | 0.2689 | 0 | 5 | 1 | aligned | -840 | 380 | 0 |
| medium | 5 | 0.6000 | 0.5000 | 0 | 7 | 2 | aligned | 680 | -2360 | 0 |
| medium | 6 | 0.5294 | 0.5385 | 0 | 8 | 1 | aligned | -520 | -2000 | 0 |

## Introduction Audit

- small: detected `Zaburi aishirini na tatu. Muñezi`; raw WER 0.8152, cleaned WER 0.7717.
- medium: detected `Zaburi ya ishirini na tatu`; raw WER 0.5652, cleaned WER 0.5109.

## Word-Level Differences

- small v1: mwenyezi missing (deletion)
- small v1: mungu missing (deletion)
- small v1: mchungaji missing (deletion)
- small v1: wetu missing (deletion)
- small v1: mwenyezi missing (deletion)
- small v1: mungu missing (deletion)
- small v1: ndo missing (deletion)
- small v1: mchungaji missing (deletion)
- small v1: wangu missing (deletion)
- small v1: sitapungukiwa missing (deletion)
- small v1: na missing (deletion)
- small v1: kitu missing (deletion)
- small v2: hunilaza missing (deletion)
- small v2: malisho -> malishu (orthography)
- small v2: majani missing (deletion)
- small v2: mabichi missing (deletion)
- small v2: huniongoza missing (deletion)
- small v3: hunihuisha -> huni (orthography)
- small v3: nafsi -> huisha (substitution)
- small v3: yangu -> na (substitution)
- small v3: huniongoza -> wsi (substitution)
- small v3: katika -> hangu (substitution)
- small v3: njia -> huni (substitution)
- small v3: za -> ongoza (substitution)
- small v3: haki -> katika (orthography)
- small v3: kwa -> njiya (substitution)
- small v3: ajili -> zahaki (substitution)
- small v3: ya -> kuadili (substitution)
- small v3: jina -> adinalake (substitution)
- small v3: lake missing (deletion)
- small v4: hata -> hatani (orthography)
- small v4: kama -> ki (substitution)
- small v4: nikipita -> pita (orthography)
- small v4: ya -> abondela (substitution)
- small v4: bonde missing (deletion)
- small v4: la missing (deletion)
- small v4: sitaogopa -> sita (orthography)
- small v4: ogo extra (insertion)
- small v4: pa extra (neighboring_verse_leakage)
- small v4: kwa -> komana (substitution)
- small v4: maana missing (deletion)
- small v4: pamoja -> pa (substitution)
- small v4: nami -> mojyanami (orthography)
- small v4: fimbo -> fimboyako (orthography)
- small v4: yako missing (deletion)
- small v4: mkongojo -> mkongodyoako (orthography)
- small v4: wako -> via (substitution)
- small v4: vyanifariji -> nifarigi (orthography)
- small v5: waandaa missing (deletion)
- small v5: yangu -> hangu (orthography)
- small v5: machoni missing (deletion)
- small v5: adui -> kamafuta (substitution)
- small v5: zangu missing (deletion)
- small v5: umenipaka missing (deletion)
- small v5: mafuta missing (deletion)
- small v5: kichwani missing (deletion)
- small v5: kinafurika missing (deletion)
- small v6: wema -> uema (orthography)
- small v6: vitanifuata missing (deletion)
- small v6: siku missing (deletion)
- small v6: zote missing (deletion)
- small v6: za missing (deletion)
- small v6: yangu -> hangu (orthography)
- small v6: nami missing (deletion)
- small v6: nitakaa missing (deletion)
- small v6: nyumbani missing (deletion)
- small v6: kwa missing (deletion)
- small v6: mwenyezi missing (deletion)
- medium v1: mwenyezi -> munyezi (orthography)
- medium v1: mwenyezi -> munyezi (orthography)
- medium v1: ndo missing (deletion)
- medium v1: sitapungukiwa missing (deletion)
- medium v2: hunilaza missing (deletion)
- medium v2: huniongoza missing (deletion)
- medium v3: hunihuisha -> huni (orthography)
- medium v3: nafsi -> huwisha (substitution)
- medium v3: yangu -> na (substitution)
- medium v3: huniongoza -> usiyangu (substitution)
- medium v3: katika -> huni (substitution)
- medium v3: njia -> ongoza (substitution)
- medium v3: za -> katika (substitution)
- medium v3: haki -> njiyazahaki (substitution)
- medium v3: ajili -> jili (orthography)
- medium v3: jina -> jinalake (orthography)
- medium v3: lake missing (deletion)
- medium v4: kama missing (deletion)
- medium v4: nikipita missing (deletion)
- medium v4: sitaogopa missing (deletion)
- medium v4: pamoja missing (deletion)
- medium v4: yako -> yaako (orthography)
- medium v4: wako missing (deletion)
- medium v5: waandaa -> ameza (substitution)
- medium v5: meza missing (deletion)
- medium v5: adui missing (deletion)
- medium v5: zangu missing (deletion)
- medium v5: kichwani -> kichwa (orthography)
- medium v5: pangu missing (deletion)
- medium v5: kikombe missing (deletion)
- medium v5: changu missing (deletion)
- medium v5: kinafurika missing (deletion)
- medium v6: wema -> uema (orthography)
- medium v6: vitanifuata missing (deletion)
- medium v6: siku missing (deletion)
- medium v6: maisha missing (deletion)
- medium v6: yangu missing (deletion)
- medium v6: nami missing (deletion)
- medium v6: nitakaa missing (deletion)
- medium v6: kwa missing (deletion)
- medium v6: mwenyezi missing (deletion)

## Recommendation Notes

- If timing drift is small but WER remains high, treat the verse as primarily transcription error.
- If drift is large or a verse is unresolved, treat it as alignment or boundary error.
- Introduction words are audited separately and should not be counted as verse 1.
