# Event Registration & Attendance Roster

## Architecture Findings

Event registrations already use the existing `events` and `event_attendances` architecture. `register_for_event(event_id)` inserts or updates one `event_attendances` row per `(event_id, member_id)` with `response = 'yes'`. Paid events add registration and payment state to that same row and store payment evidence in `event_registration_payments`.

Member identity is authoritative in `members`. The roster resolves `full_name`, `phone`, and member email from `members`, with `profiles.full_name` and `auth.users.email` as fallbacks where `members.user_id` is linked. Community/Jumuiya is resolved from `member_communities`, `members.community_id`, and legacy `members.jumuiya_id`. Ministry/group is resolved from `member_ministries` and legacy `members.ministry_id`.

The Church Admin event card previously fetched `event_attendances` rows directly for summary counts and member names. RC-2.9.4 adds `get_event_registration_roster(p_event_id)` so UI, PDF, and CSV export share one authorized server-side source.

## Roster Model

The roster RPC returns one row per registered attendee:

- Event summary fields: title, date/time, location, audience, registration type, fee, capacity.
- Member fields: full name, phone, email, Jumuiya/community, ministry/group.
- Registration fields: registration status, registered date, amount due.
- Payment fields: payment status, latest payment reference, event-level verified and pending revenue.
- Attendance fields: actual `attendance_status`.

The frontend normalizes this model in `src/lib/events/registration-roster.ts` and uses the same rows for screen summaries, search/filtering, PDF, and CSV.

## Authorization And Privacy

The roster contains member contact information. Access is limited by `can_manage_event_roster(user_id, event_id)`, which permits same-church Church Admin/workspace managers and platform/super-admin paths already used by the repository. Members can register for events, but they cannot retrieve another member roster or contact list.

Export buttons use the same RPC data as the roster screen, so exports inherit the same authorization boundary.

## Registration, Payment, And Attendance

These concepts remain separate:

- RSVP/registration: the member intends to attend and has a `response = 'yes'` attendance row.
- Payment: the member submitted or completed paid-event payment evidence.
- Confirmation: registration requirements are satisfied, for example free registration or approved payment.
- Attendance: the member physically attended or was marked absent.

RC-2.9.4 adds `event_attendances.attendance_status` with `unmarked`, `attended`, and `absent`. RSVP and payment never automatically mark a member attended.

## Free And Paid Events

Free events show registration and attendance state. Payment filters and payment columns are hidden when `registration_type` is not `paid`.

Paid events show registration status, payment status, latest payment reference on screen, fee, expected revenue, verified revenue, and pending verification. Payment proof URLs and sensitive evidence metadata are not included in the default printable PDF.

Event-specific revenue is informational and event-scoped. Unified church totals continue to come from `public.get_church_financial_summary(...)`.

## Recurring Events

The current calendar architecture treats registration and payment as belonging to the parent recurring event series. The roster therefore belongs to the parent event. Generated calendar occurrences do not create separate registration rosters or occurrence-level attendance.

## Audience Targeting

Event audience targeting remains enforced during registration through `can_view_event`. The roster contains only actual registration rows and remains same-church scoped for admin access.

## UI, Search, And Exports

The Church Admin event card now links to `/church-admin/events/:eventId/registrations` with "View Registrations" / "Tazama Waliojisajili".

The roster page provides:

- Event summary and registration summary cards.
- Search by name, phone, and email.
- Filters for registration, payment, attendance, Jumuiya/community, and ministry/group.
- Bulk mark selected as attended or absent.
- Download PDF.
- Export CSV.

CSV was chosen because existing Church Admin import/export workflows standardize on CSV for operational data, while PDF remains the printable format.

## Mobile UX

The roster page uses wrapping summary cards, compact filters, and the repository `ResponsiveTable` wrapper for controlled horizontal scrolling on narrow screens. Bulk actions remain above the table and reachable without opening dialogs.

## Known Limitations

- Occurrence-level attendance for recurring events is not implemented.
- The roster is designed for registered attendees, not Mass attendance.
- Event-specific revenue is an operational summary only and does not replace unified financial reporting.
