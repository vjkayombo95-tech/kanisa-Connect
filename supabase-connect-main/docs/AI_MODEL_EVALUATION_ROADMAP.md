# AI Model Evaluation Roadmap

Architecture status: SpeechEngine V1.0 is frozen. The indexing, validation,
benchmarking, and provider abstraction layers are complete. This roadmap guides
AI model evaluation before processing the full Bible.

No production framework changes are required unless a defect is discovered.

## Evaluation Providers

| Provider | Status | Expected transcription quality | Expected alignment quality | Effort | Licensing | Hardware | Maintenance risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `whisperx` | Implemented production baseline | Medium for Swahili with current model; strong for English and common languages | Strong only when a language-specific wav2vec2 alignment model exists; weak for Swahili with English aligner | Complete for baseline; low for tuning | WhisperX code is BSD-2-Clause; model dependencies vary | CPU works slowly; GPU recommended; WhisperX docs reference CUDA for GPU and <8 GB GPU memory for large-v2 with faster-whisper backend | Medium: alignment model coverage is the main risk |
| `faster_whisper` | Placeholder | Similar to Whisper family; likely better speed/memory than current baseline | Native word timestamps available; forced alignment quality must be benchmarked against WhisperX | Medium, 2-4 days | MIT for faster-whisper; model licenses vary | CPU int8 viable; GPU faster; CUDA/cuBLAS/cuDNN required for GPU | Low/medium: mature project, but timestamps may not equal forced alignment |
| `mms` | Placeholder | High candidate for Swahili and multilingual ASR; MMS targets 1000+ languages | Needs evaluation for timestamp/alignment path; may require CTC trellis/custom alignment | Medium/high, 4-7 days | CC-BY-NC-4.0 for `facebook/mms-1b-all`; legal review required before production/commercial use | 1B parameter model, 16 kHz audio; GPU strongly preferred | Medium/high: strong language coverage, but license and alignment integration are risks |
| `parakeet` | Placeholder | Strong English; multilingual v3 covers 25 mostly European languages, not Swahili | Promising for supported languages because v3 exposes word/segment timestamps | Medium, 3-5 days | CC-BY-4.0 for v2/v3 | NVIDIA GPU recommended; model card lists NVIDIA GPU-accelerated systems and at least 2 GB RAM to load | Medium: strong vendor support, but Swahili not covered by current v3 |
| `custom_alignment` | Placeholder | Depends on paired ASR provider | Potentially highest if built around Swahili-specific CTC/alignment model and Bible text constraints | High, 1-3 weeks | Depends on selected model/data | Depends on selected backend; GPU likely for batch processing | Medium/high: custom code must be maintained and validated |
| WhisperX + Swahili wav2vec2 align model | Not implemented; recommended experiment | Same ASR as WhisperX/faster-whisper | Potentially large improvement if a suitable Swahili phoneme/CTC model is found | Medium, 3-6 days | Depends on selected Hugging Face model | GPU preferred; CPU possible for small batches | Medium: model discovery and quality are uncertain |
| Faster Whisper + MMS/custom alignment | Not implemented; composite candidate | Strong speed plus potentially better Swahili ASR/alignment | Potentially high if MMS/custom word timings align well with Bible text | High, 1-2 weeks | Mixed; legal review required for MMS | GPU recommended | Medium/high: best long-term path if benchmark wins |

## Objective Acceptance Criteria

Minimum gate for a provider to be considered for full Bible processing:

| Metric | Minimum | Target | Notes |
| --- | ---: | ---: | --- |
| Average verse confidence | >= 0.90 | >= 0.95 | Must pass current QA threshold without lowering it |
| Boundary success rate | >= 0.98 | >= 0.995 | Across benchmark corpus and golden chapters |
| Boundary failures | 0 critical | 0 | No unresolved `boundary_not_found` on release corpus |
| Import success rate | 100% | 100% | Benchmark import preconditions must pass |
| Golden chapter pass rate | 100% | 100% | Genesis 1, Psalm 23, Matthew 5, John 3, Romans 8 |
| WER | <= 15% | <= 8% | Requires manually verified reference transcripts |
| CER | <= 8% | <= 4% | Important for Swahili morphology and joined words |
| Benchmark weighted score | >= 85 | >= 92 | Use existing benchmark scorecard |
| Peak memory | <= 8 GB | <= 6 GB | Per worker process on target deployment hardware |
| Processing speed | <= 1.0x realtime | <= 0.5x realtime | Full Bible throughput depends on this |
| Language correctness | 100% expected language | 100% | No English hallucination on Swahili chapters |
| Manual audio spot check | Pass | Pass | Reviewer verifies verse boundary comfort |

No provider should advance if it requires weakening validation thresholds.

## Recommended Evaluation Order

1. **Re-run current WhisperX baseline**
   - Establish the official baseline report using the frozen benchmark runner.
   - Confirms current failure mode and gives every later provider a fair comparison.

2. **Faster Whisper**
   - Lowest implementation effort after WhisperX because it is already part of the Whisper ecosystem.
   - Faster-whisper documents better speed and lower memory than comparable Whisper implementations and provides word timestamp output.
   - Good first alternative for throughput and operational cost.

3. **WhisperX with candidate Swahili alignment model**
   - The known weak point is alignment model language coverage.
   - This isolates alignment improvement without changing transcription family.
   - If this wins, production risk is lower than switching the whole ASR stack.

4. **MMS**
   - Best multilingual/Swahili coverage candidate.
   - Evaluate after faster/WhisperX variants because license and integration complexity are higher.
   - Must include legal review because the main checkpoint is CC-BY-NC-4.0.

5. **Custom alignment provider**
   - Use only if existing providers cannot meet Swahili boundary targets.
   - Highest implementation cost but may be necessary for scripture-grade verse boundaries.

6. **Parakeet**
   - Evaluate for English and future supported-language expansion, not primary Swahili.
   - Current multilingual v3 lists 25 languages and does not include Swahili.

## Engineering Effort Estimates

| Provider | Adapter effort | Benchmark effort | QA tuning | Total estimate |
| --- | ---: | ---: | ---: | ---: |
| WhisperX baseline | 0 days | 0.5 day | 0.5 day | 1 day |
| Faster Whisper | 2 days | 1 day | 1 day | 4 days |
| WhisperX + Swahili align model | 2 days | 1 day | 2 days | 5 days |
| MMS | 3 days | 1 day | 2-3 days | 6-7 days |
| Parakeet | 2-3 days | 1 day | 1 day | 4-5 days |
| Custom alignment | 5-10 days | 2 days | 3-5 days | 2-3 weeks |

## Production Provider Recommendations

### Swahili

Primary recommendation: **evaluate MMS and WhisperX/Faster Whisper paired with a Swahili-capable alignment path before choosing**.

Current WhisperX with English alignment should not be used for full Swahili Bible indexing because benchmark evidence already showed low verse confidence and boundary collapse. The likely production winner is either:

- MMS/custom Swahili-aware word timing, if licensing is acceptable, or
- Faster Whisper/WhisperX transcription plus a proven Swahili wav2vec2/CTC alignment model.

### English

Recommended first production candidate: **WhisperX or Parakeet**.

WhisperX has strong English forced alignment support through default torchaudio models. Parakeet is a strong English candidate because NVIDIA documents high-quality English ASR and timestamp support.

### Future Multilingual Expansion

Recommended direction: **provider-per-language selection**.

- Use WhisperX/Faster Whisper where language-specific alignment models are mature.
- Use MMS-style multilingual ASR for languages underserved by Whisper alignment.
- Use Parakeet for its supported European-language set and English.
- Keep `custom_alignment` available for languages where scripture-quality verse boundaries need special handling.

## Release Criteria For First Production Bible Index

The first production Bible index may begin only when all conditions are met:

1. Provider benchmark completed for the permanent corpus.
2. Chosen provider reaches weighted benchmark score >= 85, target >= 92.
3. Golden chapter pass rate is 100%.
4. Import precondition success rate is 100%.
5. Average verse confidence is >= 0.90 without threshold changes.
6. Boundary success rate is >= 0.98 across benchmark corpus.
7. No critical boundary failures remain in Genesis 1, Psalm 23, Matthew 5, John 3, or Romans 8.
8. WER/CER are measured against manually reviewed references and meet the minimum gate.
9. Memory and processing speed fit the worker deployment target.
10. Licensing review is complete for the selected model and all model dependencies.
11. Manual reviewer spot checks pass for at least one chapter from Pentateuch, Wisdom, Gospel, and Epistle genres.
12. Production runbook includes retry/resume procedure for full Bible processing.

## Decision Record Template

For each evaluated provider, record:

- Provider name and version.
- Model checkpoint names.
- License and approval status.
- Hardware used.
- Benchmark report path.
- WER/CER fixture path.
- Pass/fail against each acceptance criterion.
- Recommendation: reject, retry with tuning, pilot, or production candidate.

## Source Notes

- WhisperX documents word-level timestamps, wav2vec2 forced alignment, language-specific alignment models, and default alignment limitations.
- faster-whisper documents CTranslate2-based Whisper inference, word timestamps, CPU/GPU modes, MIT license, and benchmark speed/memory comparisons.
- NVIDIA Parakeet v3 documents 25 supported languages, CC-BY-4.0 licensing, word/segment timestamps, NVIDIA GPU orientation, and at least 2 GB RAM to load.
- Meta MMS documents multilingual ASR for 1000+ languages, `facebook/mms-1b-all` support for 1162 languages, 1B parameters, 16 kHz audio, and CC-BY-NC-4.0 licensing.
