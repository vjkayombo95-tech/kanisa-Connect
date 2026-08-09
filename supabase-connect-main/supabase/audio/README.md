# Kanisa Connect Audio Processing Engine

Production audio pipeline for validating, transcribing, aligning, indexing, QA-checking, and finalizing Bible chapter audio.

## Architecture

The production Bible pipeline uses:

- `OpenBibleAudioProvider` for Open Bible chapter audio.
- `SupabaseBibleProvider` for Bible text from `bible_translations`, `bible_books`, `bible_chapters`, and `bible_verses`.
- `lib/bible_books.py` as the single source of truth for canonical book codes, English names, Swahili names, abbreviations, and audio folder codes.
- `lib/generated_validation.py` for generated index validation before import and release.

Book names, localized names, abbreviations, and audio folder codes are normalized to canonical Bible codes before audio or text lookup.

## Pipeline Stages

1. `validate_audio.py` checks FFmpeg metadata, duration, bitrate, sample rate, and channels.
2. `transcribe.py` runs WhisperX transcription.
3. `align.py` runs WhisperX forced alignment and word timestamps.
4. `build_index.py` maps word timings to Supabase Bible verses, normalizes boundaries, and internally validates generated timings.
5. `validate_index.py` validates the index and writes QA summary, HTML, hash, and dashboard reports.
6. `import_index.py` revalidates and finalizes the local JSON output.

## Configuration

Edit `config.yaml`:

```yaml
processing:
  retries: 3
  backoff_seconds: 2
  overwrite: false

whisper:
  model_size: base
  language: sw
  batch_size: 8
  compute_type: float32

alignment:
  language: en

qa:
  minimum_confidence: 0.90
  warning_confidence: 0.95
  flag_low_confidence: true

indexing:
  boundary_rolling_window_tokens: 80
  minimum_verse_duration_seconds: 0.05

audio_provider: open_bible
text_provider: supabase
text_provider_options:
  translation: sw-biblica
```

When `text_provider` is `supabase`, `text_provider_options.translation` must match an existing `bible_translations.code` value. The pipeline validates this at startup.

`whisper.language` controls transcription. `alignment.language` controls the WhisperX forced-alignment model. They are separate because WhisperX does not provide a default Swahili alignment model.

## Resume Behavior

Resume mode never trusts a manifest alone.

- `BUILD_INDEX` is skipped only when the existing index passes validation.
- `VALIDATE_INDEX` is skipped only when the index is valid and both QA reports exist.
- Complete-book and complete-Bible processors use the same rule before skipping chapters.

If an existing index fails validation, the pipeline automatically rebuilds `BUILD_INDEX`.

## Running A Single Chapter

```powershell
python scripts/process_chapter.py --book john --chapter 3 --verbose
```

## Golden Chapter Validation Suite

Run this before changing the indexing engine or processing the complete Bible:

```powershell
python scripts/golden_chapter_validation.py --verbose
```

The suite processes and validates:

- Genesis 1
- Psalm 23
- Matthew 5
- John 3
- Romans 8

Each chapter must complete `BUILD_INDEX`, `VALIDATE_INDEX`, and `IMPORT`, match the Supabase verse count, avoid missing or duplicated verses, avoid overlapping timings, preserve monotonic timestamps, generate QA reports, and meet the configured confidence threshold.

## Bulk Bible Processing

Process the complete Bible with checkpoint recovery and failure isolation:

```powershell
python scripts/process_bible.py --verbose
```

The processor:

- Loads chapter lists from Supabase.
- Processes chapters independently.
- Continues after chapter failures.
- Validates every generated chapter after processing.
- Writes final run and validation reports.

## Validation Workflow

Validate one generated chapter:

```powershell
python scripts/validate_generated_chapter.py --book John --chapter 3 --database-count
```

Validate all generated Bible indexes:

```powershell
python scripts/validate_generated_bible.py
```

Generated validation checks missing chapters, missing verses, duplicated verses, overlapping timings, negative or zero durations, timestamp ordering, missing QA reports, confidence ranges, and QA critical issues.

## Expected Outputs

```text
transcripts/{audio}.transcript.json
alignments/{book}/{chapter}.json
indexes/{book}/{chapter}.json
reports/manifests/{book}_{chapter}.json
reports/summary/{book}_{chapter}.json
reports/html/{book}_{chapter}.html
reports/hashes/{book}_{chapter}.json
reports/dashboard.json
reports/run_summary.json
reports/run_summary.html
reports/failures.json
reports/golden_chapter_validation.json
reports/generated_bible_validation.json
reports/process_bible_validation.json
reports/logs/*.log
```

## Performance Notes

- Supabase translation, book, and chapter metadata are cached inside the provider for the duration of a run.
- `get_text_provider()` reuses a shared Supabase provider instance.
- Resume validation avoids unnecessary rebuilds while preventing stale invalid indexes from being imported.
- Generated-output validation reads compact index and QA artifacts rather than large alignment payloads.

## Troubleshooting

- Install FFmpeg and ensure `ffmpeg` and `ffprobe` are on `PATH`.
- Confirm `.env.local`, `.env`, or `supabase/audio/.env` provides Supabase credentials.
- Use `python scripts/validate_generated_chapter.py --book John --chapter 3 --database-count` to inspect one chapter.
- Use `--force` to regenerate every stage and `--no-resume` in batch scripts to avoid checkpoint reuse.
- Structural validation passing means timings are safe to import; confidence warnings indicate alignment quality that needs review.

## Production Recommendations

- Run the golden chapter suite before full Bible processing.
- Run full generated Bible validation before publishing indexes.
- Preserve `reports/`, `indexes/`, `alignments/`, and `transcripts/` as resumable production artifacts.
- Review `reports/failures.json` and `reports/generated_bible_validation.json` after each batch.
