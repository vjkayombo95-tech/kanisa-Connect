# Catholic Event Taxonomy

Kanisa Connect uses one TypeScript taxonomy for Catholic calendar/event classification:

- `src/lib/calendar/catholic-event-taxonomy.ts`

The taxonomy feeds the existing Church Admin event form, Parish Calendar Engine, Member Calendar filters, and local Kanisa AI retrieval. It does not create a second calendar system.

## Architecture

Flow:

1. Church Admin chooses "What are you scheduling?"
2. The selected taxonomy item sets stable `event_type`, suggested `ministry`, and `visibility`.
3. The existing `events` row is saved.
4. `src/lib/calendar/engine.ts` normalizes the event into calendar `type`, `category`, `ministry`, `visibility`, and `workspace`.
5. Member Calendar filters use authorized calendar data for Event Type, Huduma, and Jumuiya.
6. Kanisa AI answers calendar questions from the existing React Query calendar cache.

## Taxonomy Groups

- Liturgy: Mass, Adoration, Benediction, Stations of the Cross, Rosary, Procession, Liturgical Celebration
- Sacramental Life: Confession, Baptism, Marriage/Wedding, Confirmation, First Holy Communion, Anointing of the Sick, Funeral
- Formation: Catechism, Bible Study, RCIA/OCIA, Retreat, Seminar, Formation Session
- Parish Life: Parish Meeting, Fundraising, Celebration, General Parish Event
- Ministry: Ministry Activity
- Community: Jumuiya / Community Activity
- Other: Custom Event

## Stable Identifiers

Stored identifiers are not translated. Examples:

- `mass`
- `confession`
- `baptism`
- `wedding`
- `confirmation`
- `first_communion`
- `anointing_of_sick`
- `adoration`
- `catechism`
- `bible_study`
- `community_meeting`
- `custom`

## Sacramental Boundary

A sacramental calendar event is public/member schedule information, such as:

- Confessions Saturday 3 PM
- Baptism Preparation Class
- Confirmation Mass
- Wedding Celebration

A sacramental record is confidential register/certificate information, such as:

- individual baptized person
- marriage register entry
- certificate number
- sponsors, witnesses, parents, spouse data

Creating a calendar event does not create an individual sacramental record and does not expose confidential sacramental fields.

## Recurrence

The dedicated Mass schedule module already supports recurring-style parish Mass planning through `mass_events` and the Parish Calendar Engine helper for weekly Mass rules. The Church Admin event form currently stores single events only. Recurrence is documented as a limitation rather than faked by creating uncontrolled duplicate rows.

## Member Calendar Integration

Members do not see internal workspace filters. They discover events through:

- Search
- Date range
- Event Type / Aina ya Tukio
- Huduma, derived from authorized event `ministry` or stable event type
- Jumuiya, derived from authorized community-tagged calendar events

## Kanisa AI Integration

Kanisa AI uses local routing and the existing authorized calendar cache. Example supported questions:

- Maungamo ni lini?
- Misa inayofuata ni lini?
- Ubatizo unaofuata ni lini?
- What time is confession?
- When is the next Mass?

No external AI provider is required for these retrieval answers.

## Localization Boundary

Translated:

- taxonomy group labels
- event type labels
- form prompts
- helper text
- empty results

Not translated:

- stored identifiers
- custom event titles
- descriptions
- person names
- location names
- parish-authored content

## Legacy Compatibility

Unknown or legacy `event_type` values fall back safely to `custom` for editing and `public_event` for inference where needed. Existing events remain editable.

## Staging UAT

1. Church Admin creates a Confession event.
2. Publish it with public or member visibility.
3. Use Preview Member Experience.
4. Open Member Calendar.
5. Filter by Event Type or Huduma.
6. Open the Confession event.
7. Ask Kanisa AI: `Maungamo ni lini?`
8. Confirm Kanisa AI returns the authorized calendar event.

Additional check:

1. Church Admin creates a Baptism event.
2. Confirm it appears as calendar schedule information.
3. Confirm no individual baptism/sacramental record is automatically created.
