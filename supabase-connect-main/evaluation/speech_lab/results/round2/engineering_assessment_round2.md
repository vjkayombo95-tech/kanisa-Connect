# Round 2 Engineering Assessment

Generated: 2026-07-09T16:29:20.210812+00:00

1. How much did WER improve?
   WhisperX large-v3: 0.559 absolute WER improvement versus baseline. Faster-Whisper large-v3: 0.551.

2. How much did CER improve?
   WhisperX large-v3: 0.163 absolute CER improvement versus baseline. Faster-Whisper large-v3: 0.148.

3. Did Boundary Accuracy improve?
   Baseline: 0.383. Best Round 2: 0.748 (WhisperX large-v3).

4. Did Verse Confidence improve?
   Yes. Baseline: 0.259. WhisperX large-v3: 0.544 (+0.285). Faster-Whisper large-v3: 0.411 (+0.152).

5. Did English hallucinations decrease?
   No measurable decrease was possible because the baseline and both Round 2 providers recorded 0 average English hallucinations.

6. Which provider produced cleaner Swahili?
   Lowest measured WER provider: WhisperX large-v3.

7. Which provider produced better word timestamps?
   No manually corrected golden timing reference is available, so absolute word timing error cannot be objectively ranked in this round.

8. Which provider should advance to Round 3?
   Advance the lowest measured WER/CER provider with successful imports: WhisperX large-v3.

9. Was improvement primarily due to the larger model or the provider implementation?
   The measured improvement was primarily due to the larger model. WhisperX base to WhisperX large-v3 improved WER by 0.559 and CER by 0.163. Faster-Whisper large-v3 was worse than WhisperX large-v3 by 0.009 WER, 0.015 CER, 0.158 boundary accuracy, and 0.133 verse confidence.
