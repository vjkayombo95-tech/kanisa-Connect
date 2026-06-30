# Liturgical Calendar Import Foundation

## Purpose

This module is the standalone foundation for importing official liturgical calendar readings into Kanisa Connect. It is intentionally isolated from the Bible importer, Bible parser, database migrations, UI, and existing import pipelines.

Scripture fields store references only. They must never contain Bible text.

## Architecture

```text
Official Calendar
      ↓
Provider
      ↓
DailyReading
      ↓
Excel Workbook
      ↓
Kanisa Connect Import Pipeline
```

## Structure

- `providers/` defines reading data sources.
- `parsers/` will convert provider source formats into structured references.
- `writers/` will emit workbook files for review and import.
- `models/` contains the strongly typed `DailyReading` contract.
- `utils/` contains shared date and logging helpers.
- `index.ts` is the CLI entrypoint.

## Future Workflow

1. Fetch official daily reading metadata from a provider.
2. Parse source content into `DailyReading`.
3. Preserve Scripture references without duplicating Bible text.
4. Write reviewed readings into an Excel workbook.
5. Pass the workbook into the Kanisa Connect import pipeline.

## CLI

```bash
tsx scripts/liturgy/index.ts --year=2026
```
