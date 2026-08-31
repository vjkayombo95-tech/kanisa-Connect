# Saints Editorial Workflow

The Saints seed library is organized for long-term editorial maintenance. The database schema is unchanged; this folder controls how content is prepared before it is imported into Kanisa Connect.

## Workflow

Research

Draft

Review

Move to Published

Import

Publish in Kanisa Connect

## Folder Purpose

- `draft/`
  - Work-in-progress saint files.
  - Used for research, writing, editing, translation planning, and review notes.
  - The importer ignores this folder.

- `published/`
  - Production-ready saint JSON files.
  - Only files listed in `manifest.json` under `published` are imported.
  - Each file should contain one saint object.

- `images/`
  - Placeholder and documentation folder for future image workflows.
  - Automatic image upload is not implemented yet.

- `templates/`
  - Official import templates used by the CMS Download Template action.
  - Includes `single-saint-template.json` and `manifest-template.json`.

- `manifest.json`
  - Lists the published saint files that should be imported.
  - Draft files must never be listed here.

## Manifest Format

```json
{
  "published": [
    "st-peter.json",
    "st-paul.json"
  ]
}
```

When importing through the CMS, select `manifest.json` and every listed file from `published/` together.

## JSON Naming Convention

Use the saint slug as the filename:

```text
published/st-peter.json
published/st-teresa-of-calcutta.json
```

## Slug Convention

Slugs must be lowercase kebab-case:

```text
st-peter
st-paul
st-teresa-of-calcutta
```

Use only lowercase letters, numbers, and hyphens.

## Image Naming Convention

Future bulk image matching will use slug-matched filenames:

```text
images/st-peter.jpg
images/st-teresa-of-calcutta.webp
```

This prepares the architecture for later bulk image assignment. The feature is not implemented yet.

## Required Fields

- `slug`
- `name`
- `feast_month`
- `feast_day`
- `biography_short`
- `biography_long`
- `reflection`
- `prayer`

## Optional Fields

- `title`
- `patron_of`
- `birth_year`
- `death_year`
- `country`
- `quote`
- `image_url`
- `color_theme`
- `liturgical_rank`
- `is_featured`
- `scripture_reference`
- `tags`
- `is_active`

## Review Expectations

Before moving a saint from `draft/` to `published/`, confirm:

- Feast day is correct.
- Liturgical rank is valid.
- Biography is concise, pastoral, and fact-checked.
- Reflection and prayer are suitable for parish use.
- Tags are lowercase kebab-case.
- The file name matches the `slug`.
- Any image URL is licensed or approved for use.

## Provenance Review

Current provenance status: PENDING / NOT VERIFIED

- Source organization/publication: to be recorded
- Reviewer: to be recorded
- Review date: to be recorded
- Text/content approval: pending
- Image licensing approval: not applicable for current packs because no image URLs are present

## Future Ready

The folder structure leaves room for:

- Multiple languages.
- Version history.
- Review metadata.
- Bulk image matching.

These features are not implemented in this phase.
