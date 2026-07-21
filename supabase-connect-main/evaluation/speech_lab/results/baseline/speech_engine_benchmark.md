# Speech Engine Benchmark

Generated: 2026-07-09T09:40:28.491286+00:00

## Ranking

| Rank | Provider | Score | Completed | Avg Time | Avg Memory |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | whisperx | 56.608 | 5/5 | 185.952s | 111.801 MB |

## Scoring Formula

- Accuracy: 30 points from average word confidence.
- Alignment quality: 25 points from boundary success rate.
- Verse confidence: 20 points from average verse confidence.
- Processing speed: 10 points, decreasing linearly to zero at 600 seconds.
- Memory usage: 5 points, decreasing linearly to zero at 4096 MB.
- Reliability: 10 points when import precondition validation succeeds.

## Chapter Results

| Provider | Chapter | Status | Score | QA | Boundary Success | Failures | Words | Error |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| whisperx | Genesis 1 | completed | 55.629 | 30.478 | 0.258 | 23 | 480 |  |
| whisperx | Psalm 23 | completed | 74.883 | 62.921 | 0.667 | 2 | 66 |  |
| whisperx | Matthew 5 | completed | 46.714 | 31.594 | 0.417 | 28 | 810 |  |
| whisperx | John 3 | completed | 60.185 | 43.304 | 0.444 | 20 | 644 |  |
| whisperx | Romans 8 | completed | 45.630 | 19.191 | 0.128 | 34 | 863 |  |
