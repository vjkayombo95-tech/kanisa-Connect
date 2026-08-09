# Parish Calendar Engine

## Purpose

The Parish Calendar Engine turns the existing calendar into the shared operational timeline for the parish without replacing the current Calendar UI or changing database schema.

The engine normalizes existing application data into one calendar feed consumed by `useParishCalendarEvents`.

## Event Registration Roster Boundary

Event Registration & Attendance Roster management remains in the Church Admin Events architecture, not the calendar occurrence feed. For recurring events, registration/payment belongs to the parent event series; generated calendar occurrences do not create duplicate rosters or occurrence-level attendance rows.

See `docs/EVENT_REGISTRATION_ATTENDANCE_ROSTER.md` for the roster RPC, attendance status model, PDF export, CSV export, and known recurring-event limitation.

## Architecture

```text
Existing data sources
  Events
  Mass schedule
  Mass intentions
  Liturgical calendar
  Daily readings
  Announcements
        |
        v
src/lib/calendar/engine.ts
        |
        v
useParishCalendarEvents React Query cache
        |
        v
Existing ParishCalendar UI
```

The UI still renders through the existing `ParishCalendar`, `CalendarFilters`, `CalendarViews`, and `CalendarEventCard` components.

## Calendar Entry Model

Each entry includes:

- `title`
- `type`
- `category`
- `startsAt`
- `endsAt`
- `allDay`
- `location`
- `source`
- `visibility`
- `workspace`
- `color`
- `metadata`

## Integrated Sources

- Parish events from `events`
- Mass schedule from `mass_events`
- Mass intentions from `mass_intentions`
- Liturgical days from `liturgical_days`
- Daily readings from `daily_readings`
- Announcements from `announcements`

## Categories

- Mass
- Liturgical
- Prayer
- Ministry
- Community
- Meeting
- Administration
- Finance
- Announcement
- Attendance
- Custom

Each category has shared metadata for label, color, and icon name in `calendarUtils`.

## Filters

The existing filter bar now supports:

- Category
- Event type
- Workspace
- Visibility
- Ministry
- Community
- Church
- Date range
- Search

## Permissions

Workspace visibility still flows through the existing calendar permission helper. The engine tags each entry with a workspace and visibility, then `filterParishCalendarEvents` decides what the active workspace may see.

## Recurring Event Support

The engine includes provider-free recurrence helpers. Existing `mass_events` rows remain the source of persisted Masses. Parish events now store one recurring parent series on `public.events` and the calendar engine expands bounded generated occurrences for the requested date range.

See [Recurring Catholic Events](RECURRING_CATHOLIC_EVENTS.md) for the recurrence persistence model, monthly edge-case behavior, and UAT flows.

## Compatibility

- Workspace Framework: unchanged.
- Events module: retained.
- Daily readings and liturgical calendar: reused.
- Invite Hub: compatible through existing parish routes.
- AI/Assistant layer: compatible because entries expose normalized source, type, category, workspace, and metadata.

## Roadmap

- Add occurrence-level exceptions if parish operations require "this occurrence only" edits.
- Add optional overlay toggles for announcements and assistant events.
- Link calendar entries directly to source detail pages.
- Add ministry/community ownership metadata where source tables support it.
