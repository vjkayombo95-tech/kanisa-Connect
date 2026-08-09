# AI Speech Evaluation Laboratory

This namespace is isolated from Kanisa Connect production code. It does not modify the Speech Engine, Universal Audio Platform, Synchronization Engine, Bible Index Engine, or generated production indexes.

## Fixed Corpus

- Genesis 1 (`GEN_001`)
- Psalm 23 (`PSA_023`)
- Matthew 5 (`MAT_005`)
- John 3 (`JHN_003`)
- Romans 8 (`ROM_008`)

These chapters are permanent benchmark chapters.

## Model Set

- WhisperX
- Faster-Whisper Large-v3
- Whisper Large-v3
- Whisper Turbo
- NVIDIA Parakeet
- Meta MMS
- Custom wav2vec2 alignment
- Future providers through SpeechEngine

## Workflow

### Placeholder Workflow

Initialize golden reference placeholders:

   ```bash
   python -m evaluation.speech_lab.cli init-golden
   ```

Manually correct each `evaluation/speech_lab/golden/*.golden.json` file. Golden references should include transcript text, word timings, verse boundaries, word confidence when available, and verse confidence when available.

### Spreadsheet Import Workflow

The golden Swahili workbook can be imported without running transcription, alignment, timestamp generation, or benchmark jobs:

```bash
python -m evaluation.speech_lab.cli import-golden --input "path/to/golden reference bible swahili.xlsx" --local
```

To store the same golden references in Supabase evaluation tables:

```bash
python -m evaluation.speech_lab.cli import-golden --input "path/to/golden reference bible swahili.xlsx" --supabase --env-file evaluation/speech_lab/.env.evaluation --imported-by "round3-prep"
```

The `--env-file` flag defaults to `evaluation/speech_lab/.env.evaluation`. This file must contain only:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not put service-role credentials in any `VITE_*` variable. Frontend/Vite env files must continue to use only `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`.

Supported spreadsheet columns are flexible and may use English or Swahili labels:

- `book` / `kitabu`
- `chapter` / `sura`
- `chapter_id`
- `verse` / `mstari`
- `verse_text` / `swahili_text` / `golden_text`
- `word` / `neno`
- `start_ms`, `end_ms`, `confidence`
- `verse_start_ms`, `verse_end_ms`, `verse_confidence`

Golden reference persistence uses only the isolated tables:

- `evaluation_golden_references`
- `evaluation_model_outputs`
- `evaluation_benchmark_reports`

These tables are not production Bible indexes and are not consumed by the production Speech Engine, Synchronization Engine, Universal Audio Platform, or Bible Index Engine.

### Captured Output Comparison

Capture model output JSON files under:

   ```text
   evaluation/speech_lab/model_outputs/<model-id>/<chapter-id>.json
   ```

Compare a captured transcript payload against local golden references:

   ```bash
   python -m evaluation.speech_lab.cli compare-output-file --input evaluation/speech_lab/model_outputs/whisperx-large-v3/JHN_003.json --model-id whisperx-large-v3 --model-name "WhisperX large-v3"
   ```

Compare against Supabase-stored golden references:

   ```bash
   python -m evaluation.speech_lab.cli compare-output-file --input evaluation/speech_lab/model_outputs/whisperx-large-v3/JHN_003.json --model-id whisperx-large-v3 --model-name "WhisperX large-v3" --supabase --env-file evaluation/speech_lab/.env.evaluation
   ```

Run the existing captured-output comparison:

   ```bash
   python -m evaluation.speech_lab.cli run
   ```

Review reports in `evaluation/speech_lab/reports`.

### Biblica/Open Kiswahili Reference Candidate Workflow

The Biblica/Open Kiswahili archive is handled as an evaluation-only reference source candidate. It does not replace the human Golden References, does not write Supabase rows, and does not modify production Bible, audio, indexing, synchronization, QA, or application code.

Safely inspect and extract the source archive:

```bash
python -m evaluation.speech_lab.cli extract-biblica-reference --zip-path "C:/Users/HP/Downloads/0cd52ddc726e2ee6-rev2-release.zip"
```

This writes the controlled source copy and chapter JSON files under:

```text
evaluation/speech_lab/reference_sources/biblica_open_kiswahili/
```

The extractor rejects absolute paths, parent-directory traversal, and Windows backslash paths inside the archive. Extracted chapter JSON preserves Unicode punctuation, normalizes whitespace only, and stores headings/introductions separately from verse text.

Compare the existing Supabase canonical text against the Biblica source candidate:

```bash
python -m evaluation.speech_lab.cli compare-reference-sources --chapters GEN_001 MAT_005 PSA_023 ROM_008 --env-file evaluation/speech_lab/.env.evaluation
```

Rescore existing Faster-Whisper outputs against the Biblica source without rerunning ASR:

```bash
python -m evaluation.speech_lab.cli rescore-existing --reference-source biblica_open_kiswahili --models small medium --chapters GEN_001 MAT_005 PSA_023 ROM_008
```

The rescore command reads existing raw transcript files from `evaluation/speech_lab/model_outputs/faster-whisper-small/` and `evaluation/speech_lab/model_outputs/faster-whisper-medium/`, creates separate `.biblica-aligned-v2.json` files, and writes JSON/CSV/Markdown reports under `evaluation/speech_lab/reports/`. Existing raw transcripts, human Golden References, and previous reports are not overwritten; report paths are made unique when a filename already exists.

Use `--dry-run` with any of the Biblica commands to print the planned input and output paths without writing files.

## Output Formats

Each run produces:

- JSON
- CSV
- Markdown
- HTML
- Comparison tables
- Leaderboard ranking

## Acceptance Criteria

Minimum target:

- WER < 5%
- Boundary Accuracy > 99%
- Verse Confidence > 0.95
- Processing Time recorded
- Memory usage recorded

The runner records processing time and peak Python heap RAM for every evaluation. GPU memory/utilization is sampled with `nvidia-smi` when available.

## Captured Transcript Format

```json
{
  "chapter_id": "JHN_003",
  "text": "Kwa maana jinsi hii Mungu aliupenda ulimwengu...",
  "words": [
    { "word": "Kwa", "start_ms": 0, "end_ms": 120, "confidence": 0.99, "verse": 16 }
  ],
  "verse_boundaries": [
    { "verse": 16, "start_ms": 0, "end_ms": 5200, "confidence": 0.98 }
  ],
  "metadata": {
    "model_version": "example"
  }
}
```

## Provider Extension

New provider adapters belong under `evaluation/speech_lab/providers`. Adapters must return a `Transcript` and must not write production indexes. The default `ManifestProvider` is recommended for repeatable reports because it evaluates captured outputs deterministically.
