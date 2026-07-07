# Bible Import Plan

## Goal

Prepare a future import of a complete 73-book Catholic Bible without changing schema, importer code, or existing Bible data during this readiness sprint.

## Preparation

1. Select an approved source translation.
2. Obtain written license or verify public-domain terms.
3. Store source files outside runtime app code.
4. Convert source into the existing Bible JSON format.
5. Review every book, chapter, and verse before publishing.
6. Place reviewed JSON in `supabase/seed/bible/published/`.

The app must never depend on PDF or raw source files at runtime.

## Source Rules

- Do not scrape copyrighted Bible text.
- Do not copy text from web pages without permission.
- Do not fabricate missing verses.
- Do not mix translation sources under one translation name.
- Preserve attribution and license notices required by the source.

## JSON Shape

Use the existing schema:

```json
{
  "translation": {
    "code": "web-catholic",
    "name": "World English Bible Catholic Edition",
    "language": "en",
    "description": "Public-domain Catholic-canon Bible prepared for Kanisa Connect."
  },
  "books": [
    {
      "book_number": 1,
      "name": "Genesis",
      "abbreviation": "Gen",
      "testament": "old",
      "chapters": [
        {
          "chapter": 1,
          "verses": [
            {
              "verse": 1,
              "text": "..."
            }
          ]
        }
      ]
    }
  ]
}
```

## Book Numbering

Recommended for a new Catholic translation:

- Use Catholic canonical order, 1 through 73.
- Keep deuterocanonical books in their Catholic positions.
- Include Tobit, Judith, Wisdom, Sirach, Baruch, 1 Maccabees, and 2 Maccabees.
- Confirm Catholic additions to Esther and Daniel in the selected source.

Recommended for the existing 66-book translation:

- Do not renumber current books in place.
- Do not append deuterocanonical books unless the source is the same translation family and licensing explicitly permits it.
- Prefer a new translation row for complete Catholic imports.

## Aliases

The parser already supports Catholic aliases for:

- Tobit
- Judith
- Wisdom
- Sirach / Ecclesiasticus / Ecclus
- Baruch
- 1 Maccabees / 1 Mac / I Maccabees
- 2 Maccabees / 2 Mac / II Maccabees

Before import, verify aliases against the selected translation's book names and abbreviations.

## Validation

Run existing validation:

```bash
npm run bible:validate -- --input supabase/seed/bible/published/<translation>.json --report reports/bible/<translation>-validation.json
```

Validation must confirm:

- Translation metadata exists.
- 73 books are present.
- All chapters are present.
- Verse numbers are positive.
- No duplicate verse numbers.
- Verse numbering is continuous.
- Verse text is non-empty.

Run Catholic canon audit:

```bash
node scripts/bible/audit-catholic-canon.cjs
```

For a future multi-translation audit, update the script input path or add an `--input` option before running it against the new published seed.

## Import

Use the existing importer:

```bash
npm run bible:import -- --input supabase/seed/bible/published/<translation>.json
```

For full replacement of a test translation only:

```bash
npm run bible:import -- --input supabase/seed/bible/published/<translation>.json --replace
```

Do not use `--replace` against production content unless rollback has been tested.

## Testing

### Bible Reader

Verify:

- Book list includes 73 books.
- Old Testament, deuterocanonical, and New Testament books display correctly.
- Each missing RC-26.1 book opens.
- Chapter lists load.
- Verse pages load.
- Previous/next chapter navigation works.

### Reference Parser

Test:

- `Tobit 1:1`
- `Judith 8`
- `Wisdom 3:1-9`
- `Sirach 48:1-4`
- `Ecclesiasticus 24`
- `Baruch 5:1-9`
- `1 Maccabees 2:1-5`
- `1 Mac 2:1`
- `I Maccabees 2`
- `2 Maccabees 7`
- `2 Mac 7:1-2`

### Universal Scripture Links

Verify links render in:

- Daily Readings
- Reflections
- Prayers
- Saints
- Announcements
- Calendar descriptions
- Prayer Requests
- Mass Intentions
- Community posts

Invalid references should remain plain text or show existing validation feedback.

### Daily Readings

Verify official Catholic readings that require deuterocanonical books:

- Sirach references.
- Wisdom references.
- Baruch references.
- 1 Maccabees / 2 Maccabees references where used.
- Catholic Esther and Daniel additions if present in the chosen translation.

Daily Readings should store references only, never Bible text.

## Rollback Plan

Preferred rollback for a new translation:

1. Mark the new translation inactive if an admin control exists.
2. Repoint default Bible selection to the previous translation.
3. Leave imported rows intact for forensic review.

Database rollback if required:

1. Export current Bible tables before import.
2. Run import in staging first.
3. If production import fails, delete rows for the new `translation.code`.
4. Re-run validation against remaining Bible data.
5. Confirm Bible reader and Scripture Links still resolve existing references.

## Release Checklist

- License or public-domain basis documented.
- Source files archived.
- JSON generated.
- JSON reviewed.
- `npm run bible:validate` passes.
- Catholic canon audit passes with 73/73 books.
- Staging import succeeds.
- Bible reader smoke test passes.
- Scripture Links smoke test passes.
- Daily Readings smoke test passes.
- Rollback tested in staging.

## Current Recommendation

Use a new translation import for the first complete Catholic Bible. Prefer a licensed Swahili Catholic edition for pastoral fit; use World English Bible Catholic Edition as the safest interim English technical baseline if immediate 73-book support is required before Swahili licensing is complete.
