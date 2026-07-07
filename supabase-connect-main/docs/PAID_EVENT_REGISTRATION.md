# Paid Event Registration

RC-2.9.0 extends the existing `public.events` and `public.event_attendances` model. It does not create a second calendar or treat event fees as contributions.

## Schema Contract

- `events.registration_required` enables registration controls.
- `events.registration_type` is `free` or `paid`.
- `events.registration_fee` stores the event fee for paid registrations.
- `events.registration_deadline` and `events.registration_capacity` are enforced by `public.register_for_event`.
- `event_attendances.registration_status`, `payment_status`, `amount_due`, and `currency` store each member's registration state.
- `event_registration_payments` stores payment evidence for event fees only.

## Authorization

Members may register only for events already authorized by `public.can_view_event`. Request ownership or RSVP history does not bypass audience targeting.

Church managers can review event registrations and payment evidence through same-church management policies.

## Payment Boundary

Event payment records are not inserted into `contributions`. A paid event registration creates event-payment evidence that remains pending until church review. This mirrors the existing pledge-payment evidence pattern.

Approved event registration payments are included in unified church financial reporting through `public.get_church_financial_summary`. Pending or rejected evidence is excluded, and no duplicate contribution row is created.

## Recurring Events

Registration applies once to the parent recurring event series. Generated calendar occurrences do not create separate registration or payment rows.

## Staging Notes

Apply migrations through the normal release process. This task did not run `supabase db push` and did not modify staging directly.
## RC-2.9.4 Registration Roster

Paid event registrations now feed the Church Admin Event Registration & Attendance Roster. The roster uses `public.get_event_registration_roster(p_event_id)` and keeps paid-event payment state on `event_attendances` plus `event_registration_payments`.

The roster may display event-level expected revenue, verified revenue, and pending verification for the selected event only. Unified parish finance totals remain owned by `public.get_church_financial_summary(...)`; event roster data must not be used as a duplicate church-wide financial source.

See `docs/EVENT_REGISTRATION_ATTENDANCE_ROSTER.md` for authorization, export, and attendance-status details.
