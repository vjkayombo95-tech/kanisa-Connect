# Catholic CMS

Kanisa Connect v2.0 introduces the Catholic Content Management System as the shared foundation for Catholic content across the platform.

## Architecture

The CMS is organized around reusable primitives:

- `content_categories`: administrator-managed taxonomy for prayers and future content.
- `content_tags`: reusable tags for search and discovery.
- `content_languages`: supported content languages.
- `content_collections`: curated sets such as Morning Prayers, Rosary Collection, and Divine Mercy.
- `content_prayers`: the first rich content model migrated into the CMS.
- `content_daily_readings`: CMS-owned daily reading references, reflections, prayers, publishing state, language, and editorial metadata.
- `content_prayer_tags`: many-to-many tags for prayers.
- `content_collection_items`: collection membership for prayers and future content types.
- `content_relationships`: generic links between content records, saints, readings, calendar events, and future documents.
- `content_versions`: automatic version snapshots for prayer and daily reading edits.

Saints and liturgical calendar remain in their existing modules for now, but the CMS relationship table can link them to CMS prayers, daily readings, and future content.

## Publishing

CMS prayers use the shared lifecycle:

`draft -> review -> published -> featured -> archived`

Only `published` and `featured` prayers are available to authenticated member-facing content lookups. Super admins can manage every status.

RC-2.3.0 adds publication safety checks for the Prayer Library. Missing required fields, duplicate slugs, invalid lifecycle values, invalid visibility, and restricted member visibility block publication. Optional metadata gaps are warnings, not blockers.

## RLS And Security

The v2.0 foundation uses platform-level ownership for Catholic CMS records. Catholic CMS content is global platform content, not church-owned tenant content.

Security model:

- Authenticated users can read active taxonomy and published/featured content.
- Member-facing helpers additionally require `visibility` to be `public` or `member`.
- Super admins manage categories, tags, languages, collections, prayers, relationships, and versions.
- Versions are append-only from the UI perspective. Restore creates a new edit and does not delete previous versions.

Audit finding from RC-2.0.1: the original public helper returned published prayers without checking visibility. This was corrected by adding member-safe CMS query helpers.

## Prayer Library

The old in-memory Prayer Library manager has been replaced by a CMS-backed manager at:

`/super-admin/catholic-content/prayer-library`

The editor supports:

- Title and slug
- Summary and body
- Dynamic category
- Language
- Workflow status
- Visibility
- Author and source
- Liturgical season
- Scripture reference
- Estimated read time
- Cover image
- Tags
- Collections

Every insert or update creates a `content_versions` snapshot.

## Daily Readings

Daily Readings are now the second CMS domain. The Super Admin manager is available at:

`/super-admin/catholic-content/daily-readings`

The editor supports:

- Date, liturgical year, season, celebration, and color
- First reading, responsorial psalm, optional second reading, gospel acclamation, and gospel references
- Reflection, prayer, meditation questions, and daily challenge
- Language
- Workflow status
- Visibility
- Source attribution and editorial notes
- Excel import validation
- Version history and restore
- Current-year coverage health

Daily Reading records store Bible references only. Bible text remains in the Bible module and is opened through existing Bible reader routes.

The member Daily Readings page uses CMS content first and falls back to legacy `liturgical_days` and `daily_readings` when a CMS record has not been published for the selected date.

See [Daily Readings CMS](DAILY_READINGS_CMS.md) for the import contract, validation rules, fallback policy, and coverage model.
See [Daily Readings Data Pipeline](DAILY_READINGS_DATA_PIPELINE.md) for provenance, dry run, conflict handling, publication safety, and staging validation.

## Version History And Restore

The Prayer Library editor displays version history for saved prayers.

Each version shows:

- Version number
- Created date
- Status
- Snapshot summary/body preview

Editors can preview a version, compare it with the current prayer, and restore it after confirmation. Restore uses the normal save path, which creates a new version and preserves all previous versions.

## Categories

Categories are database-managed, not hard-coded. The foundation migration seeds common Catholic categories such as Morning, Evening, Healing, Family, Marian, Rosary, Novenas, Litanies, Advent, Lent, Holy Week, Easter, and Pentecost.

Admins can add new categories from the Prayer Library manager.

## Collections

Collections group content for member portal and future assistant experiences. Seeded collections include:

- Morning Prayers
- Family Prayer Pack
- Healing Collection
- Lenten Collection
- Rosary Collection
- Children's Collection
- Marriage Preparation
- Funeral Prayers
- Divine Mercy

Admins can create collections and assign prayers to multiple collections.

## Relationships

`content_relationships` supports links such as:

- Prayer to Saint
- Prayer to Daily Reading
- Prayer to Liturgical Season
- Prayer to Announcement
- Prayer to Calendar Event
- Reading to Catechism
- Saint to Novena

The first UI pass exposes the data model and keeps future relationship editors decoupled from individual feature tables.

The Prayer Library editor now includes a reusable relationship editor supporting:

- Saint
- Daily Reading
- Liturgical Season
- Scripture Reference
- Another Prayer
- Collection

Supported relationship types:

- `related_to`
- `recommended_with`
- `prayer_for`
- `associated_with`
- `seasonal`
- `scripture_context`

Search-backed targets are available for prayers, saints, and collections. Text/id entry is supported for daily readings, seasons, and scripture references.

## Import

The Import Center now identifies the Prayer Library as CMS-ready.

Expected prayer import columns:

- Title
- Category
- Tags
- Prayer
- Season
- Language
- Status
- Collection

The existing Import Center architecture remains unchanged. A full Excel import adapter can target the CMS tables without creating another prayer-specific pipeline.

The Prayer Library page now includes the first Excel import adapter. It supports:

`Title`, `Slug`, `Summary`, `Prayer Body`, `Category`, `Tags`, `Language`, `Status`, `Visibility`, `Featured`, `Author`, `Source`, `Liturgical Season`, `Scripture Reference`, `Collection`

The import flow is:

Upload -> Parse -> Validate -> Preview issues -> Confirm Import -> Summary

Validation blocks rows with missing required fields, invalid lifecycle values, invalid visibility, unknown categories, unknown languages, and unknown collections. Unknown tags are warnings because the CMS can create tags during save.

The import validator also flags warning and information signals for editorial review, including missing source, missing author where attribution may be expected, no tags, no collection, suspiciously short body, featured content, seasonal content, scripture-linked content, and original Kanisa Connect content.

## Prayer Library Staging Validation

See [Prayer Library Staging Validation](PRAYER_LIBRARY_STAGING_VALIDATION.md) for the imported-field audit, editorial workflow, bulk publication safety, member visibility contract, provenance policy, taxonomy health checks, and manual staging checklist.

Bulk editorial actions are available in the Prayer Library table:

- Select individual prayers
- Select visible page
- Submit selected for review
- Publish selected
- Archive selected

Bulk publication shows selected, valid, warning, and blocked counts before publishing. Invalid records cannot be bulk published.

## Search

Prayer Library search supports:

- Title
- Summary/body
- Category
- Tag
- Season
- Scripture reference
- Author/source
- Collection
- Language

The database includes a text-search index for prayer title, summary, body, author, and scripture reference.

## Member Portal

The member Catholic Library now includes CMS prayers alongside saints.

Member experience includes:

- Featured prayers
- Category filtering
- Collection filtering
- Search by title, summary, tag, scripture, season, author, source, language, and collection
- Recently added prayers
- Seasonal content
- Prayer detail pages

Prayer detail pages display title, summary, body, category, tags, language, source/author, scripture reference, season, collections, share, copy, print, and a future-ready favorites placeholder.

Future member portal work should add:

- Favorites
- Related saints/readings/reflections

## Kanisa AI

Kanisa AI should use CMS content before calling any future AI provider. For example, a request such as "Prayer for healing" should search published CMS prayers and return matching content when available.

Kanisa AI now classifies Prayer Library requests separately from Prayer Requests. If CMS prayer content has already been loaded into the React Query cache, Kanisa AI returns a trusted CMS summary without calling any provider. If no cached match is available, it navigates to the member-safe Catholic Library.

No AI provider is integrated in this phase.

## Content Health

The Catholic CMS dashboard reports:

- Published content
- Draft content
- Review queue
- Archived content
- Categories
- Collections
- Languages
- Today's prayer
- Seasonal content
- Recently updated records
- Content health issues
- Daily Reading total records
- Daily Reading published records
- Daily Reading current-year coverage
- Daily Reading completeness and enrichment

Health checks currently detect missing categories, missing languages, prayers without tags, review queue items, empty collections, and broken relationships where source or target ids are absent.

Prayer Library validation also surfaces unknown-source records so editors can avoid claiming ownership of traditional, attributed, licensed, or uncertain content.

## Testing

CMS-specific tests cover:

- Lifecycle visibility
- Member exclusion of drafts
- Category, tag, collection, scripture search filters
- Import validation
- Duplicate slug warning
- Invalid language/category detection
- Import row mapping
- Version restore draft behavior
- Relationship/health issue detection
- Daily Reading member visibility and filtering
- Daily Reading import validation
- Daily Reading duplicate date/language protection
- Daily Reading leap-year coverage
- Daily Reading version restore draft behavior
- Prayer Library publication safety
- Unknown-source provenance warnings
- Featured prayer member filtering
- Bulk publication blocking

## Roadmap

Next CMS phases:

- CMS-backed devotions, novenas, rosary, litanies, reflections, catechism, and Catholic documents
- Member portal collection/category browsing
- Analytics for views and engagement
- AI orchestrator lookup against CMS search before provider fallback

## Operational Notes

The CMS migration is additive. It does not redesign the Workspace Framework, authentication, member management, calendar engine, announcement lifecycle, automation engine, notification engine, Bible data, or AI provider architecture.
