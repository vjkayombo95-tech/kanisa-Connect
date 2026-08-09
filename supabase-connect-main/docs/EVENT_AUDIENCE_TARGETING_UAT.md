# Event Audience Targeting UAT

RC-2.7.7 staging UAT verifies that targeted parish events are visible only to authorized members. Run the staging bootstrap after the RC-2.7.7 migrations have already been applied.

Do not publish passwords, service-role keys, or raw staging secrets in defect notes.

## Test Identities

The staging bootstrap prepares these Demo Catholic Parish member identities:

| Identity | Membership |
| --- | --- |
| Choir Member | Choir only |
| Youth Member | Youth Ministry only |
| General Member | No Choir or Youth Ministry membership |
| Multi-Group Member | Choir and Youth Ministry |

The Church Admin account owns event setup and can see every event for operational management.

## Test Events

| Event | Audience | Notes |
| --- | --- | --- |
| UAT Choir Rehearsal | Choir | Weekly recurring parent event with recurrence metadata |
| UAT Youth Retreat | Youth Ministry | One-time event |
| UAT Choir + Youth Meeting | Choir and Youth Ministry | One-time combined group event |
| UAT Parish Meeting | All Parish Members | Uses `all_members` |
| UAT Public Parish Event | Everyone | Uses `everyone` |

The recurring Choir Rehearsal remains one parent event. The calendar engine expands occurrences for Month, Week, Day, Agenda/List, and Kanisa AI after RLS has authorized the parent event.

## Visibility Matrix

| Event | Choir Member | Youth Member | General Member | Multi-Group Member |
| --- | --- | --- | --- | --- |
| Choir Rehearsal | Visible | Hidden | Hidden | Visible |
| Youth Retreat | Hidden | Visible | Hidden | Visible |
| Choir + Youth Meeting | Visible | Visible | Hidden | Visible |
| Parish Meeting | Visible | Visible | Visible | Visible |
| Public Event | Visible | Visible | Visible | Visible |

## Browser Procedure

For each member identity:

1. Sign in to the Member workspace.
2. Open Member Calendar or Events.
3. Verify Month View matches the visibility matrix.
4. Switch to Week View and Day View around each event date and verify the same matrix.
5. Open Agenda/List and verify hidden events do not appear.
6. Search for hidden event names. Hidden events must not appear.
7. Open an authorized event detail and verify title, description, date/time, location, and recurrence display correctly.
8. Verify the recurring Choir Rehearsal appears as generated occurrences only for authorized Choir and Multi-Group members.

## Direct Access Security

For an unauthorized member, try a copied or guessed restricted event URL/ID:

- Youth Member opening Choir Rehearsal.
- Choir Member opening Youth Retreat.
- General Member opening Choir Rehearsal, Youth Retreat, or Choir + Youth Meeting.

Expected result:

- Backend returns no restricted event row.
- UI displays a safe not-found or unauthorized state.
- No restricted title, description, location, group targets, recurrence, or time metadata is disclosed.

## Cross-Church Safety

Verify at backend/design level and during staging checks:

- `event_audience_targets` cannot point to a ministry or community from another church.
- A member from another church cannot access Demo Catholic Parish targeted events.
- The target validation trigger remains enabled.
- Event SELECT RLS uses `public.can_view_event(auth.uid(), events.id)`.

## Kanisa AI Procedure

Kanisa AI must consume only the authorized calendar feed.

| Identity | Prompt | Expected Result |
| --- | --- | --- |
| Choir Member | `When is choir rehearsal?` | Authorized answer |
| Choir Member | `Vijana wana retreat lini?` | No restricted Youth event disclosure |
| Youth Member | `Vijana tuna retreat lini?` | Authorized answer |
| Youth Member | `When is choir rehearsal?` | No restricted Choir event disclosure |
| General Member | `When is choir rehearsal?` | No restricted event disclosure |
| General Member | `Parish meeting ni lini?` | Authorized answer |
| Multi-Group Member | `When is choir rehearsal?` | Authorized answer |
| Multi-Group Member | `Vijana tuna retreat lini?` | Authorized answer |

## Defect Logging

Log defects in [Staging UAT Defect Log](STAGING_UAT_DEFECT_LOG.md). Include workspace, route, identity used, event name, expected visibility, observed visibility, and whether the issue was browser-only or backend/RLS related.
