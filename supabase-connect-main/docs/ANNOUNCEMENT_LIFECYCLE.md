# Announcement Lifecycle & Scheduling

Kanisa Connect announcements now behave as scheduled parish communication objects while reusing the existing announcements module.

## Lifecycle

Announcements move through these states:

- `draft`: saved but not visible to members.
- `scheduled`: publish date is in the future.
- `active`: published and visible to the selected audience.
- `featured`: active and promoted in announcement lists.
- `expired`: past the expiry date.
- `archived`: hidden from active management and member views.

The lifecycle is resolved by database helpers and refreshed by the admin and portal readers. No separate event row is created for calendar display.

## Scheduling

Church administrators can set:

- publish date and time
- expiry date and time
- timezone
- publish immediately
- never expire
- featured status
- notification strategy
- parish calendar visibility

## Audience

Supported audience targets are:

- everyone
- members
- visitors
- priests / pastoral
- church admin
- finance
- super admin
- ministry
- community

The member portal RPC filters announcements by publication window, archive state, and audience.

## Calendar Integration

When `show_on_calendar` is enabled, the Parish Calendar Engine renders a calendar reference from the announcement itself. This avoids duplicate data and keeps updates in one source.

## Automation & Assistant Hooks

The lifecycle fields are available to the existing automation, dashboard, assistant, and calendar cache consumers:

- `ANNOUNCEMENT_PUBLISHED`
- `ANNOUNCEMENT_EXPIRING`
- assistant event priorities
- dashboard timeline cards
- command-center navigation to announcements

Provider-based AI was not changed. Existing template generation remains provider-free and separate from lifecycle scheduling.

## Notes

Future public QR pages can use the announcement id and lifecycle fields. The admin UI currently exposes a QR placeholder action without creating a new public route.
