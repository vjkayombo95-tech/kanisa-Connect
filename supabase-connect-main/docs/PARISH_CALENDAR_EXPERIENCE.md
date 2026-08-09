# Parish Calendar Experience

## Experience Goals

The Parish Calendar is the operational view of parish life. This sprint improves presentation and navigation while reusing the Parish Calendar Engine and the existing calendar query path.

Goals:

- Make month cells scannable at a glance.
- Keep all source data normalized through the existing engine.
- Let users inspect a day without leaving the calendar.
- Link every entry back to the workspace-safe source route.
- Support fast keyboard and responsive interaction.

## Interaction Model

The main calendar keeps the existing view switcher and now supports:

- Month
- Week
- Day
- Agenda
- Timeline
- Today

Month days are selectable. Selecting a day opens a responsive details panel.

## Month View

Month cells now show compact summaries:

- Category icon
- Category color
- Time or all-day label
- Event title
- Maximum three visible items
- More-count indicator
- Today and active-day highlights

## Day Panel

The day panel opens as an accessible sheet:

- Desktop: right side panel.
- Tablet and mobile: full-width sheet.
- Escape closes the panel.
- Focus remains managed by the Radix dialog primitive.

Sections:

- Today's Readings
- Mass Schedule
- Mass Intentions
- Parish Events
- Announcements
- Ministry Activities
- Community Activities
- Quick Actions

## Timeline View

Timeline view groups events by day and orders them by time. It uses the same filtered calendar feed, so no duplicate data or queries are introduced.

## Source Linking

Calendar entries expose `href` generated from their source and active workspace. Links remain inside the workspace when a route exists and fall back to the Parish Calendar for unsupported source routes.

Supported sources:

- Events
- Mass schedule
- Mass intentions
- Daily readings
- Liturgical calendar
- Announcements

## Filters

Filters now include quick toggles and saved local state:

- Today
- This Week
- Masses
- Liturgical
- Ministries
- Communities
- Announcements

Saved filters are local to each workspace.

## Kanisa AI

Calendar summary questions use the Calendar Engine cache when it is already loaded.

Examples:

- What happens today?
- What Masses are tomorrow?
- What meetings are this week?
- What is on Sunday's schedule?

No AI provider is called.

## Future Roadmap

- Deep-link each event to source detail IDs when detail routes are available.
- Add visual density controls for very busy parishes.
- Add richer keyboard day-by-day grid movement.
- Add persisted named filters when user preferences storage is available.
