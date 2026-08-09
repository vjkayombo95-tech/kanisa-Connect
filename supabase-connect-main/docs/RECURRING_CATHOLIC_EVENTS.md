# Recurring Catholic Events

RC-2.7.6 extends the existing Parish Calendar Engine and Catholic Event Taxonomy with bounded recurring parish event schedules.

## Architecture

Recurring events are stored as one parent row in `public.events`. The calendar engine expands that parent row into visible occurrences only for the requested date range. The app does not create duplicate child rows for each occurrence.

Flow:

1. Church Admin selects a Catholic event type.
2. Church Admin chooses one-time or recurring.
3. Recurrence metadata is saved on the parent event.
4. `fetchParishCalendarFeed` retrieves eligible parent events for the current range.
5. `expandParishEventRow` uses the centralized recurrence engine to generate bounded occurrences.
6. Member Calendar filters, Huduma filters, event type filters, and Kanisa AI read the expanded authorized feed.

## Persistence Model

The additive migration `20260704125000_event_recurrence_columns.sql` adds:

- `recurrence_frequency`: `none`, `daily`, `weekly`, `monthly`
- `recurrence_interval`
- `recurrence_days_of_week`
- `recurrence_end_date`
- `recurrence_count`
- `recurrence_monthly_pattern`: `day_of_month`, `nth_weekday`
- `recurrence_monthly_week`
- `recurrence_monthly_weekday`

Existing event rows remain one-time because `recurrence_frequency` defaults to `none`.

## Supported Frequencies

- One-time event
- Daily, every N days
- Weekly, every N weeks, one or more weekdays
- Monthly, every N months
- Monthly same day of month
- Monthly same weekday pattern, such as first Friday

## End Conditions

Recurring events require one of:

- End on a specific date
- End after a specific number of occurrences

Unbounded recurrence is intentionally not exposed. The engine also enforces a defensive generation cap.

## Recurrence Engine

`src/lib/calendar/recurrence.ts` owns recurrence validation and expansion.

It guarantees:

- deterministic occurrence IDs: `event-{parentId}-{yyyy-mm-dd}`
- parent event identity in metadata
- preserved duration
- interval support
- selected weekdays
- end date and occurrence count support
- bounded generation with `MAX_RECURRENCE_OCCURRENCES`

## Monthly Edge Cases

For same-day monthly recurrence, dates are clamped to the last valid day of the target month.

Examples:

- January 31 -> February 28 in a non-leap year
- January 31 -> February 29 in a leap year
- February 29 -> March 29 in a leap year sequence

This avoids invalid dates while keeping the series visible in every selected month.

## Church Admin Workflow

Church Admin can create and edit a recurring series from the existing Events page. Editing and deleting apply to the full series.

This sprint does not implement occurrence exceptions such as "this occurrence only" or "this and following."

## Member Behavior

Members see generated occurrences as normal calendar items. Members do not see recurrence configuration controls.

Filters continue to apply to generated occurrences:

- Event Type
- Huduma / Service
- Category
- Visibility
- Search

## Kanisa AI Behavior

Kanisa AI answers from the authorized expanded calendar cache. Queries such as "Maungamo ni lini?" and "When is the next confession?" return upcoming generated occurrences when they are loaded in the current parish calendar cache.

No external AI provider is used.

## Timezone Behavior

The recurrence engine follows the app's existing local-date convention for parish events. It preserves the local start and end time from the parent event while changing only the occurrence date.

## Performance Limits

Calendar expansion is bounded by:

- the requested calendar date range
- recurrence end date or recurrence count
- a defensive maximum occurrence count
- a maximum lookahead window for malformed or future no-end data

## Legacy Compatibility

Legacy events without recurrence metadata remain one-time events. Existing Mass schedule rows continue through the current `mass_events` mapping. The older weekly Mass helper remains available for existing internal usage, but public event recurrence now uses the centralized recurrence engine.

## Known Limitations

- No occurrence-level exceptions.
- Edit/delete applies to the whole series.
- Recurrence descriptions are generated in English for now inside the shared engine.
- Staging requires the recurrence migration before creating recurring events.

## UAT Flows

Flow 1:

1. Church Admin creates Stations of the Cross.
2. Select Weekly, Friday, every 1 week.
3. End after 6 occurrences.
4. Save.
5. View as Member.
6. Confirm six Friday occurrences appear.

Flow 2:

1. Church Admin creates Confession.
2. Select Weekly, Saturday, every 1 week.
3. End on the chosen date.
4. View as Member.
5. Ask Kanisa AI: "Maungamo ni lini?"
6. Confirm the next authorized confession occurrence appears.

Flow 3:

1. Church Admin creates Monthly Parish Meeting.
2. Select Monthly, every 1 month.
3. End after 6 occurrences.
4. Confirm calendar rendering in month, week, and agenda views.

