# Daily Readings CMS

Kanisa Connect RC-2.1.0 moves Daily Readings into the Catholic CMS while preserving the legacy liturgical tables as fallback.

## Architecture

Daily Readings are stored in `content_daily_readings`. The table stores references, metadata, reflections, prayers, editorial fields, publishing state, visibility, language, timestamps, and version history through `content_versions`.

Bible text is not duplicated. Daily Reading records store references such as `Matthew 9:14-17`; the Bible module remains the source for passage text and reader navigation.

## Migration Chain

Expected order:

1. `20260704100000_create_catholic_cms_foundation.sql`
2. `20260704110000_create_cms_daily_readings.sql`
3. `20260704120000_daily_readings_import_batches.sql`
4. `20260704121000_ensure_daily_readings_import_batch_link.sql`

The final migration is a forward-only convergence guarantee. It repairs the `import_batch_id` link if the import batch migration previously ran while `content_daily_readings` was missing, and it fails clearly if required base tables are still absent or if an incompatible column/foreign key already exists.

Expected final schema contract:

- `content_daily_readings` exists.
- `content_import_batches` exists.
- `content_daily_readings.import_batch_id` exists as `uuid`.
- `import_batch_id` references `content_import_batches(id)` with `on delete set null`.
- `idx_content_daily_readings_import_batch` exists.
- RLS remains enabled on Daily Readings and import batches.
- Daily Reading updated-at and version-capture triggers exist.
- CMS relationship and version tables remain available.

Verify with:

`scripts/sql/verify-daily-readings-cms-schema.sql`

## Member Consumption

The Daily Readings page first loads the CMS reading for the selected date. If no published CMS reading exists, it falls back to the legacy `liturgical_days` and `daily_readings` feed.

Member-visible readings require:

- `status` of `published` or `featured`
- `visibility` of `public` or `member`

## Super Admin Management

Super Admins manage readings in `SuperAdminDailyReadingsPage`.

Supported operations:

- Create and edit CMS readings
- Set status and visibility
- Add celebration, season, liturgical year, and color
- Add first reading, psalm, optional second reading, gospel acclamation, and gospel references
- Add reflection, prayer, meditation questions, and daily challenge
- Import `.xlsx` workbooks
- Review validation issues before import
- Restore previous versions
- Review current-year coverage
- Run dry-run validation with zero writes
- Record import batch provenance
- Choose conflict strategy
- Export validation reports
- Publish safe date ranges

## Excel Import

Official template:

`supabase/seed/catholic-cms/daily-readings/templates/Kanisa-Connect-Daily-Readings-Template.xlsx`

Accepted columns:

- Date
- Liturgical Year
- Liturgical Season
- Celebration
- Liturgical Color
- First Reading
- Psalm
- Second Reading
- Gospel Acclamation
- Gospel
- Reflection
- Prayer
- Meditation Questions
- Daily Challenge
- Language
- Status
- Visibility
- Source Attribution
- Editorial Notes

Validation blocks missing dates, first readings, psalms, gospels, invalid statuses, invalid visibility values, unknown languages, and duplicate date/language rows. Existing date/language matches are treated as updates and shown as warnings.

Dry Run must be used before production imports. It parses, validates, calculates conflicts and coverage, and writes no data.

## Coverage

Coverage separates two concerns:

- Liturgical completeness: first reading, responsorial psalm, and gospel are present.
- Editorial enrichment: reflection, prayer, meditation questions, or daily challenge are present.

The Catholic CMS dashboard shows total readings, published readings, missing dates, incomplete dates, and enrichment count for the current year.

## AI And Assistant Readiness

Daily Readings are now available through CMS services and React Query keys such as `member-cms-daily-reading`. AI and assistant features can use this cache before routing to providers.

No AI provider is integrated by this migration.

## Fallback Policy

Legacy tables remain available until CMS year coverage is complete and verified. Removing the fallback should be a separate migration and release decision.

## Operational Pipeline

See [Daily Readings Data Pipeline](DAILY_READINGS_DATA_PIPELINE.md) for provenance, conflict handling, small-batch import, publication safety, rollback, and staging validation.

Production safety: do not use destructive reset commands to repair this chain. Apply pending migrations forward, run schema verification, and only import verified readings after PASS results.
