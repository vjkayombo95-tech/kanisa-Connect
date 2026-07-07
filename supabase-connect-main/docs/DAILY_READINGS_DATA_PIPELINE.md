# Daily Readings Data Pipeline

Kanisa Connect does not invent official liturgical schedules. Production Daily Reading references must come from a verified Catholic source.

## Content Policy

Official liturgical reading references must come from a verified Catholic source such as a diocesan publication, official lectionary, or authorized liturgical calendar.

Kanisa Connect may store original or properly licensed:

- Reflections
- Prayers
- Meditation questions
- Daily challenges

The Bible module remains responsible for Bible text. Daily Readings store references only.

## Pipeline

Verified Source -> Canonical Workbook -> Dry Run -> Validation -> Import -> Editorial Review -> Safe Publication -> Member Portal -> Parish Calendar -> Kanisa AI

## Canonical Workbook

Template:

`supabase/seed/catholic-cms/daily-readings/templates/Kanisa-Connect-Daily-Readings-Template.xlsx`

Sheets:

- Instructions
- Daily Readings
- Validation Reference
- Example Rows

Example rows are development examples only. They are not production liturgical data.

## Required Fields

- Date
- First Reading
- Psalm
- Gospel
- Language
- Status
- Visibility

## Optional Enrichment

- Second Reading
- Gospel Acclamation
- Reflection
- Prayer
- Meditation Questions
- Daily Challenge
- Celebration
- Liturgical Color
- Editorial Notes

## Provenance

Each import batch records:

- Filename
- Source organization
- Source publication/document
- Source year
- Source edition
- Date obtained
- Language
- Imported by
- Imported at
- Notes

Source metadata is stored at batch level through `content_import_batches`, with imported readings linked by `import_batch_id`.

## Migration Dependency Finding

RC-2.2 introduced `content_import_batches` and the `content_daily_readings.import_batch_id` provenance link. The migration depends on the RC-2.1 Daily Readings CMS table from `20260704110000_create_cms_daily_readings.sql`.

A dependency issue was discovered when `20260704120000_daily_readings_import_batches.sql` was run before `public.content_daily_readings` existed. The migration could create `content_import_batches` but skip the `import_batch_id` link, leaving a partially configured schema if the migration was then recorded as applied.

The forward-only repair migration `20260704121000_ensure_daily_readings_import_batch_link.sql` guarantees schema convergence after the base Daily Readings table exists. It ensures:

- `content_daily_readings.import_batch_id` exists.
- The column type is `uuid`.
- The foreign key targets `content_import_batches(id)` with `on delete set null`.
- `idx_content_daily_readings_import_batch` exists.
- Incompatible existing schema states fail clearly instead of being silently accepted.

Do not import verified readings until the repair migration and schema verification have passed.

## Dry Run

Dry Run parses and validates the workbook, calculates conflicts and coverage, and performs zero writes.

The Super Admin UI displays:

- Total rows
- Valid rows
- Errors
- Warnings
- Information
- Existing records
- Missing dates
- Dataset coverage
- Published coverage
- Liturgical completeness
- Editorial enrichment

## Validation Severities

Errors block import:

- Invalid date
- Missing First Reading
- Missing Psalm
- Missing Gospel
- Invalid language
- Malformed required Bible reference
- Duplicate date/language in workbook

Warnings remain reviewable:

- Existing CMS record
- Missing Reflection
- Missing Prayer
- Missing Celebration
- Missing Liturgical Color
- Malformed optional reference

Information:

- Optional Second Reading absent
- Optional Gospel Acclamation absent
- Editorial enrichment coverage

## Conflict Handling

Existing records are never silently overwritten.

Supported strategies:

- Skip Existing
- Create Draft Revision
- Update Existing

Default: Create Draft Revision.

Update Existing requires explicit confirmation and still preserves version history through CMS version capture.

## Small-Batch Process

Recommended staging process:

1. Upload full workbook.
2. Run Dry Run.
3. Fix errors.
4. Import a small verified date range, such as one month.
5. Submit the small range for review.
6. Publish the small range.
7. Validate member portal, calendar, Bible links, and Kanisa AI cache retrieval.
8. Import the full year.

## Publication Safety

Bulk publication is blocked if:

- Required dates are missing.
- Required references are missing.
- Lifecycle state or visibility is invalid.
- Archived content is included in a publish action.

Supported actions:

- Submit Date Range for Review
- Publish Date Range
- Feature Date Range

## Rollback And Recovery

Daily Reading edits create `content_versions` snapshots. Restoring a version creates a new version and preserves history.

Import batches track imported, skipped, and updated row counts. If a batch needs rollback, use version history to restore affected records or archive the imported range.

## Staging Validation Checklist

Before importing any verified readings:

1. Confirm the target environment is staging.
2. Inspect migration history.
3. Verify whether `20260704100000_create_catholic_cms_foundation.sql` is applied.
4. Verify whether `20260704110000_create_cms_daily_readings.sql` is applied.
5. Verify whether `20260704120000_daily_readings_import_batches.sql` is applied.
6. Apply pending migrations through the repository's normal migration process. Do not reset production.
7. Run `scripts/sql/verify-daily-readings-cms-schema.sql`.
8. Confirm `content_daily_readings.import_batch_id` exists.
9. Confirm the import batch foreign key exists and uses `on delete set null`.
10. Confirm `idx_content_daily_readings_import_batch` exists.
11. Confirm RLS remains enabled on `content_daily_readings` and `content_import_batches`.
12. Run application tests.
13. Run the production build.

After schema verification:

1. Super Admin uploads workbook.
2. Dry Run performs zero writes.
3. Validation report is accurate.
4. Errors block import.
5. Warnings remain reviewable.
6. Import creates CMS records.
7. Version history exists.
8. Draft content is hidden from Members.
9. Review content is hidden from Members.
10. Published content appears to Members.
11. Previous/Today/Next navigation works.
12. Bible reference links open correctly.
13. Parish Calendar references the reading.
14. Kanisa AI retrieves the published reading from cache.
15. Archived content is hidden appropriately.
16. RLS prevents unauthorized management.

## Schema Verification

Run the read-only verification SQL after migrations:

`scripts/sql/verify-daily-readings-cms-schema.sql`

The script returns PASS/FAIL rows for required tables, columns, foreign keys, indexes, RLS, triggers, and policies. A FAIL result must be resolved before importing verified Daily Readings data.

## Readiness Notes

The pipeline is ready for staged verified datasets. It is not a substitute for a verified source agreement or editorial review process.
