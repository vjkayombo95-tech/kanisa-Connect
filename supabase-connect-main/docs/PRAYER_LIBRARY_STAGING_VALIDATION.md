# Prayer Library Staging Validation

RC-2.3.0 validates the CMS-backed Prayer Library import, editorial workflow, publication safety, and member visibility path.

## Imported Field Audit

The Prayer Library import adapter maps workbook columns to CMS fields:

| Workbook Field | CMS Field |
| --- | --- |
| Title | `content_prayers.title` |
| Slug | `content_prayers.slug` |
| Summary | `content_prayers.summary` |
| Prayer Body / Prayer | `content_prayers.body` |
| Category | `content_prayers.category_id` via `content_categories` |
| Tags | `content_prayer_tags` via `content_tags` |
| Language | `content_prayers.language_id` via `content_languages` |
| Status | `content_prayers.status` |
| Visibility | `content_prayers.visibility` |
| Featured | `content_prayers.featured` |
| Author | `content_prayers.author` |
| Source | `content_prayers.source` |
| Liturgical Season | `content_prayers.liturgical_season` |
| Scripture Reference | `content_prayers.scripture_reference` |
| Collection | `content_collection_items` for `content_type = 'prayer'` |

Automated checks verify the mapping logic. Staging editors must still open imported samples and compare them against the source workbook before publication.

## Validation Rules

Errors block import or publication:

- Missing title
- Missing prayer body
- Duplicate slug
- Invalid language
- Invalid status
- Invalid visibility
- Published prayer with restricted visibility

Warnings do not block publication:

- Missing summary
- Missing category
- Missing source
- Missing author where attribution may be expected
- No tags
- No collection
- Suspiciously short prayer body
- Unknown source

Information flags:

- Featured prayer
- Seasonal prayer
- Scripture-linked prayer
- Original Kanisa Connect content

## Editorial Workflow

Supported lifecycle:

`Draft -> Review -> Published -> Archived`

Super Admin can:

- Preview prayer
- Edit prayer
- Submit for Review
- Publish prayer
- Archive prayer
- Restore archived prayer by moving it back into review or publication
- View version history
- Restore a version, creating a new version snapshot

## Bulk Publication Safety

The Prayer Library table supports:

- Selecting individual prayers
- Selecting the visible filtered page
- Submit selected for review
- Publish selected
- Archive selected

Before publishing, the confirmation summary reports:

- Selected Records
- Valid Records
- Warnings
- Blocked Records

Any selected record with errors blocks the bulk publish operation.

## Member Visibility

Member-safe helpers expose only prayers where:

- `status` is `published` or `featured`
- `visibility` is `public` or `member`

Draft, review, archived, pastoral-only, and admin-only records remain hidden from member Prayer Library results and member prayer detail routes.

## Prayer Detail

The member prayer detail page displays:

- Title
- Summary
- Prayer body
- Category
- Tags
- Collections
- Author
- Source
- Liturgical season
- Scripture reference

It also supports:

- Copy
- Share
- Print

Legacy fallback remains in place where CMS prayer content is not found.

## Taxonomy Health

CMS health checks surface:

- Empty collections
- Broken relationships
- Prayers without category
- Prayers without language
- Prayers without tags
- Review queue items

Editors should investigate duplicates and empty taxonomy records in staging before broad publication. The validation sprint does not automatically delete taxonomy.

## Provenance Policy

Every imported prayer should be reviewed for one of:

- Traditional/Public Domain
- Original Kanisa Connect Content
- Attributed Author
- Licensed/Permission-Based Content
- Unknown Source

Unknown-source records are flagged for editorial review. Do not claim Kanisa ownership unless the source or author clearly identifies Kanisa Connect content.

## Staging Checklist

Manual staging workflow:

1. Open imported Draft prayer.
2. Verify every imported field.
3. Edit one prayer.
4. Save.
5. Confirm version capture.
6. Submit for Review.
7. Confirm hidden from Member Portal.
8. Publish.
9. Confirm visible in Member Catholic Library.
10. Open Prayer Detail.
11. Verify metadata and prayer body.
12. Test Copy.
13. Test Share.
14. Test Print.
15. Test search.
16. Test category browsing.
17. Test collection browsing.
18. Test Featured behavior.
19. Archive the test prayer.
20. Confirm it disappears from Member Portal.
21. Restore/version-test where appropriate.

These steps require a live staging session. Automated tests do not prove that real imported workbook rows were manually approved.

## Automated Verification

Tests cover:

- Draft hidden from Members
- Review hidden from Members
- Archived hidden from Members
- Published visible to Members
- Visibility filtering
- Search filtering
- Category filtering
- Collection filtering
- Featured filtering
- Missing prayer body validation
- Duplicate slug validation
- Unknown source warning
- Bulk publication safety
- Version restore behavior
