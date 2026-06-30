# Bible Seed Pipeline

The Bible import pipeline is intentionally separate from the Catholic Library content tools.

Flow:

1. Source PDF
2. `npm run bible:extract -- --input path/to/bible.pdf`
3. Generated JSON in `supabase/seed/bible/generated/`
4. Editorial review and validation
5. Move approved JSON to `supabase/seed/bible/published/`
6. `npm run bible:validate -- --input supabase/seed/bible/published/biblica-sw.json`
7. `npm run bible:import -- --input supabase/seed/bible/published/biblica-sw.json`

The application must never depend on the PDF at runtime. The PDF is used only to create structured JSON.

## JSON Format

```json
{
  "translation": {
    "code": "sw-biblica",
    "name": "Biblica Toleo Wazi Neno",
    "language": "sw"
  },
  "books": [
    {
      "book_number": 1,
      "name": "Mwanzo",
      "abbreviation": "Mwa",
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

## Folders

- `generated/`: machine-generated output from PDF extraction.
- `published/`: reviewed JSON files approved for database import.

## Import Safety

The importer is idempotent. By default it inserts missing content and skips existing content.

Use `--replace` only when intentionally replacing an entire translation:

```bash
npm run bible:import -- --input supabase/seed/bible/published/biblica-sw.json --replace
```
