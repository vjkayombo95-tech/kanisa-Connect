# Catholic Bible Strategy

## Purpose

Kanisa Connect should support the full Roman Catholic Bible canon while avoiding fabricated Scripture content and avoiding unauthorized copying of copyrighted Bible translations.

This document is a readiness plan only. It does not import Bible text, change schema, change Supabase, alter migrations, or modify the Bible importer.

## Current Bible Audit

Source audit: `reports/bible/CATHOLIC_CANON_AUDIT.md`

Current local seed:

- Seed file: `supabase/seed/bible/generated/biblica-sw.json`
- Translation code: `sw-biblica`
- Books present: 66
- Books missing from Catholic canon: 7
- Chapters present: 1,189
- Verses present: 29,746
- Duplicate verse issues: 0
- Chapter/verse continuity issues: 0
- Existing seed validation: passed

The current seed is structurally valid, but it is not a complete Roman Catholic Bible because it lacks the deuterocanonical books.

## Current Status

### Bible Content

The application currently has a 66-book Bible dataset. The seven missing books are:

- Tobit
- Judith
- Wisdom
- Sirach
- Baruch
- 1 Maccabees
- 2 Maccabees

The USCCB canonical book listing includes these books in the Catholic Old Testament. Reference: https://bible.usccb.org/bible

### Parser Readiness

The Bible reference parser has been prepared for Catholic references.

Aliases now include:

- Tobit / Tobia / Tob
- Judith / Yudithi / Jdt
- Wisdom / Wis / Hekima
- Sirach / Ecclesiasticus / Ecclus / Sir
- Baruch / Bar / Baruku
- 1 Maccabees / 1 Mac / I Maccabees
- 2 Maccabees / 2 Mac / II Maccabees

### Universal Scripture Link Readiness

Universal Scripture Links can detect Catholic/deuterocanonical references in rendered portal text. Once approved Bible content is imported, references such as `Sirach 48:1-4`, `Wisdom 3:1-9`, and `2 Maccabees 7` can resolve through the existing Bible route model.

### Importer Readiness

The Bible import pipeline is already JSON-based and idempotent:

1. Source text is transformed into structured JSON.
2. JSON is validated.
3. Approved JSON is moved to `supabase/seed/bible/published/`.
4. Import runs through `npm run bible:import`.

The documented JSON format supports:

- Translation metadata
- Book number
- Book name
- Abbreviation
- Testament
- Chapters
- Verses

No schema change is required to import deuterocanonical books because the schema already supports the `deuterocanonical` testament value.

## Candidate Translations

### Biblia Habari Njema (Catholic)

- Language: Swahili
- Catholic approval: Catholic editions exist, but approval and exact edition metadata must be verified with the publisher or national Bible society before import.
- 73-book canon: Expected for a Catholic edition; verify table of contents before licensing.
- Digital availability: May be available in digital products, but a bulk machine-readable text license must be negotiated.
- Licensing considerations: Likely copyrighted. Do not scrape or copy text without written permission.
- Commercial deployment suitability: Strong candidate for Tanzania/Kenya parish users if licensing permits platform use.
- Potential import effort: Medium to high. Requires licensed source files, editorial review, canonical mapping, and validation.

### NABRE

- Language: English
- Catholic approval: Approved for Catholic personal use and study; USCCB hosts the text online.
- 73-book canon: Yes.
- Digital availability: Online at USCCB.
- Licensing considerations: Copyrighted and permission-controlled. Requires USCCB licensing for commercial/app deployment.
- Commercial deployment suitability: Strong Catholic credibility, but licensing may be restrictive.
- Potential import effort: Medium once licensed source files are available.

Reference: https://bible.usccb.org/bible

### Jerusalem Bible

- Language: English
- Catholic approval: Catholic translation tradition.
- 73-book canon: Yes.
- Digital availability: Published commercially.
- Licensing considerations: Copyrighted by commercial publishers. Current official publisher links must be verified before negotiation.
- Commercial deployment suitability: Not recommended as a first implementation unless a clear digital license is obtained.
- Potential import effort: Medium once licensed source files are available.

Reference overview: https://en.wikipedia.org/wiki/Jerusalem_Bible

### RSV-2CE

- Language: English
- Catholic approval: Catholic edition with ecclesial approval.
- 73-book canon: Yes.
- Digital availability: Commercially available through Catholic publishers and apps.
- Licensing considerations: Copyrighted. Requires licensing from rights holder/publisher.
- Commercial deployment suitability: Excellent Catholic study translation if licensing is obtained.
- Potential import effort: Medium once licensed source files are available.

Reference overview: https://en.wikipedia.org/wiki/Revised_Standard_Version_Catholic_Edition

### Douay-Rheims

- Language: English
- Catholic approval: Historic Catholic translation.
- 73-book canon: Yes, depending on edition.
- Digital availability: Widely available.
- Licensing considerations: Many base texts are public domain, but specific digital editions, notes, formatting, and scans may carry separate rights.
- Commercial deployment suitability: Good fallback for an English Catholic Bible where modern readability is less important than low licensing risk.
- Potential import effort: Medium. Requires selecting a clean public-domain text source and normalizing archaic book names and verse structure.

Reference overview: https://en.wikipedia.org/wiki/Douay%E2%80%93Rheims_Bible

### World English Bible

- Language: English
- Catholic approval: Not an official Catholic liturgical translation.
- 73-book canon: The official WEB site lists a Catholic edition and an ecumenical edition with deuterocanonical/apocryphal books.
- Digital availability: Publicly available.
- Licensing considerations: Public domain text, with trademark constraints around naming faithful copies.
- Commercial deployment suitability: Best low-risk English option for immediate 73-book technical readiness, but it should be labeled carefully and not presented as an officially approved Catholic liturgical Bible.
- Potential import effort: Low to medium. Requires importing the Catholic edition, preserving attribution, and validating book order.

Reference: https://worldenglish.bible/

## Recommended Translation

### Recommended English Translation

Preferred practical choice: **World English Bible Catholic Edition**.

Why:

- Public-domain text enables safe app deployment without royalty negotiation.
- Official WEB materials identify a Catholic edition and explain that the Catholic edition follows Catholic book order.
- It is suitable for technical readiness, Scripture Links, Bible browsing, and Daily Reading reference resolution.

Caveat:

- It is not the preferred pastoral/liturgical Catholic translation. The UI and documentation should label it as a public-domain Catholic-canon Bible, not as the official lectionary text.

Long-term English upgrade:

- Pursue RSV-2CE or NABRE licensing if the pilot requires a more widely recognized Catholic study translation.

### Recommended Swahili Translation

Preferred pastoral choice: **Biblia Habari Njema (Catholic edition)**, pending license verification.

Why:

- Swahili is the primary pastoral language target for many Kanisa Connect users.
- A Catholic edition would align better with parish use than an English fallback.
- It would make Daily Readings and devotional experiences more natural for members.

Caveat:

- Do not import until the exact Catholic edition, license terms, digital source, and redistribution rights are confirmed in writing.

Interim Swahili position:

- Keep the existing 66-book Swahili seed available while adding a separate English Catholic 73-book translation for official Catholic reference coverage.

## Migration Strategy

### Option A: Replace Existing 66-Book Bible

Replace the current `sw-biblica` seed with a complete 73-book Catholic Bible.

Advantages:

- Single default Bible experience.
- Daily Readings references resolve consistently.
- Easier mental model for members.

Disadvantages:

- Requires an approved 73-book Swahili source before proceeding.
- Book numbering changes may affect generated Scripture Link route IDs.
- Existing user expectations around the current translation could shift.
- Higher regression risk.

### Option B: Extend Existing Bible

Keep the current 66-book Bible and add the missing deuterocanonical books to the same translation.

Advantages:

- Lower immediate disruption.
- Existing 66 books remain unchanged.
- Could unlock references like Sirach and Wisdom if compatible licensed text is available.

Disadvantages:

- The current translation may not authorize mixing in deuterocanonical text from another source.
- Appended book numbering may differ from Catholic canonical order.
- Mixing sources can create a confusing or legally risky translation identity.

### Recommended Migration Strategy

Recommended: **Add a new complete 73-book translation rather than modifying the existing 66-book seed.**

Reasoning:

- It avoids mixing translation sources.
- It preserves the existing Bible for users and rollback.
- It allows a clean Catholic canonical book order.
- It supports future multi-translation Bible selection.
- It avoids pretending that the current `sw-biblica` seed is a Catholic edition.

The first production-ready implementation should be either:

1. A licensed Swahili Catholic edition, if rights are obtained.
2. The World English Bible Catholic Edition as an interim public-domain technical baseline.

## Outstanding Blockers

- Confirm rights for a Swahili Catholic Bible text.
- Choose whether the first complete Catholic import is English-first or Swahili-first.
- Confirm canonical numbering strategy for route compatibility.
- Validate Esther and Daniel Catholic additions, not only the seven standalone deuterocanonical books.
- Obtain source files in a clean machine-readable format.
- Complete editorial review before import.
