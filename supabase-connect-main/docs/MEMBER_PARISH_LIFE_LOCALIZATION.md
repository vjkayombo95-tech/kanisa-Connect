# Member Parish Life Localization

## Scope

RC-2.6.3 localizes stable Member Portal parish-life interface text for English and Kiswahili.

Covered surfaces:

- Parish Calendar
- Member Events
- Member Announcements
- Member Communities / channels
- Member Ministries
- Command Center parish-life shortcuts and Kiswahili search terms

No parish-authored content is translated automatically. Event titles, locations, announcement bodies, community names, ministry names, descriptions, comments, and chat messages remain exactly as entered by the parish or member.

## Coverage

Fully localized:

- Parish Calendar shell, views, filters, quick filters, empty/error/loading states, day drawer, badges, and date/time display.
- Member Events page heading, empty/loading states, event status display, RSVP actions, toasts, and fallback copy.
- Member Announcements page heading, empty/loading states, celebration badges, reaction/comment helper copy, toasts, and localized dates.
- Member Communities page title/description and channel workspace member-visible labels, timestamps, empty states, composer text, and reaction helper copy.
- Member Ministries page heading, search, status badges, action buttons, empty/error/loading states, schedules, and service opportunities.
- Command Center parish-life shortcuts for calendar, events, announcements, communities, and ministries.

Partially localized by design:

- Shared channel creation copy is localized because the same component renders member-visible community channels. Administrative channel behavior is unchanged.
- Calendar stable identifiers use translation keys for display only; stored enum values and filters are unchanged.

Intentionally untranslated:

- Parish-authored event, announcement, community, ministry, comment, and chat content.
- Database enum values and route ids.

## Kiswahili Search Terms

Command Center now recognizes member parish-life terms including:

- `kalenda`
- `kalenda ya parokia`
- `matukio`
- `matangazo`
- `jumuiya`
- `huduma`
- `fursa za huduma`

## Verification

Automated coverage:

- `src/test/member-parish-life-localization.test.ts`

Recommended checks:

- `cmd /c npm run test`
- `cmd /c npm run build`

No Supabase migration, schema change, or database push is required.
