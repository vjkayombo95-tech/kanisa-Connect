# Member Event Request Workflow

RC-2.7.8 completes the existing `/portal/event-requests` feature as a member-to-parish-office approval workflow.

## Architecture Findings

- Member route: `/portal/event-requests`
- Church Admin route: `/church-admin/event-requests`
- Storage: existing `public.event_requests`
- Event conversion target: existing Church Admin Events workflow
- Special Mass conversion target: existing `mass_events` Mass Schedule workflow
- Mass Intentions remain separate and are not used for special Mass scheduling requests.

## Request Taxonomy

Stable stored identifiers:

- `parish_event`
- `ministry_group_event`
- `special_mass_request`
- `venue_facility_request`
- `prayer_formation_event`
- `other`

Localized labels are rendered in the UI only. Member-entered titles, descriptions, notes, and admin notes are not translated.

## Lifecycle

Supported statuses:

- `draft`
- `submitted`
- `under_review`
- `changes_requested`
- `approved`
- `rejected`
- `converted`
- `scheduled`
- `cancelled`

Legacy `pending` rows are migrated to `submitted`; legacy `completed` rows are migrated to `converted`.

## Member Flow

Members submit structured requests with title, purpose, preferred date/time, venue preference, expected attendance, group context when applicable, and notes. Submission does not publish an event, schedule a Mass, or create sacramental records.

Members can view only their own requests and parish office notes. Email-linked member rows are supported for staged accounts whose `members.user_id` is not yet populated.

## Calendar Visibility

Event Requests do not appear on any calendar while they are `draft`, `submitted`, `under_review`, `changes_requested`, `rejected`, or `cancelled`.

An approved but unconverted request appears only on the requester member's own calendar as a personal marker labelled `Approved / Awaiting Scheduling`. It is not visible to other members and is not treated as a confirmed parish event or Mass.

After conversion, the personal request marker disappears. The real `events` row follows normal Event Audience Targeting rules, including Everyone, All Members, and Specific Groups. The real `mass_events` row follows the existing Mass calendar authorization rules. Request ownership never grants access to the final Event or Mass if the final operational record's own authorization would hide it.

Approved request proposals do not expand recurrence. Recurring occurrences begin only after Church Admin converts the request into a real recurring Event.

## Church Admin Flow

Church Admins can view same-church requests, filter by status/type/search, add notes, mark under review, request changes, approve, or reject. Request Changes and Reject require an admin note.

Approved event-type requests expose `Create Event from Request`, which opens the existing Events surface with request context in the URL. Approved `special_mass_request` rows expose `Schedule Mass from Request`, which opens the existing Mass Schedule surface. The request table stores `converted_event_id` or `converted_mass_event_id` for idempotent linkage once the operational record is created; this also removes the personal approved-request calendar marker.

## Security Model

The migration tightens RLS:

- Members can create their own draft/submitted requests only.
- Members can read only their own requests.
- Members cannot update review fields, approve, reject, or convert requests.
- Church managers can read and review requests only for churches they can manage.
- Ministry/community request selections must match the member's existing memberships.

## Notifications And Kanisa AI

The workflow reuses existing UI surfaces and authorized data. No duplicate notification or external AI provider system is introduced. Kanisa AI can safely navigate members to `/portal/event-requests` and explain the workflow; approval and conversion remain admin-only actions.

Kanisa AI may answer request status questions from Event Request history. It must not describe unapproved requests as upcoming calendar events. After approval, it may include the requester-only approved marker in personal upcoming activity answers. After conversion, it should answer from the real Event or Mass feed so the request marker and final operational record are not duplicated.

## Mobile Behavior

The member form and admin inbox use stacked responsive grids and wrapping cards so long notes and descriptions remain readable on small screens.

## Known Limitations

- The Events and Mass Schedule pages receive request context through URL parameters; final conversion linkage still depends on those existing save flows recording the created target ID.
- Full notification fan-out is deferred to the existing notification architecture rather than introducing a new notification table.
