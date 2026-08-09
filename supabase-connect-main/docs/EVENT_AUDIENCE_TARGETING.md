# Event Audience Targeting

RC-2.7.7 adds audience targeting to parent parish events without duplicating event rows. Recurring generated occurrences inherit audience access from the parent event after the parent has passed database authorization.

## Model

- `events.audience_mode` stores `everyone`, `all_members`, or `specific_groups`.
- `event_audience_targets` stores UUID relationships from an event to either a ministry or community.
- Ministry membership is resolved through `member_ministries` and the legacy `members.ministry_id`.
- Community membership is resolved through `member_communities`, `members.community_id`, and `members.jumuiya_id`.
- Parish-created ministry and community names are display labels only, not security identifiers.

## Security

`public.can_view_event(auth.uid(), events.id)` is the shared RLS boundary for event reads. Members can read events in their church only when event visibility is member-safe and the audience mode allows them. Church admins, workspace managers, platform super admins, and super admins retain operational access.

Direct event-detail reads must use the same authorized calendar/event query path. If a member guesses an event ID or URL for a restricted targeted event, the backend should return no event row and the UI should render a safe not-found or unauthorized state without disclosing title, description, location, or recurrence metadata.

`event_audience_targets` is protected by same-church validation. The trigger rejects target rows where the event and ministry/community belong to different churches.

## Calendar Flow

Authorized parent events are queried first, then the existing recurrence engine expands them for the requested visible date range. Month, Week, Day, Agenda, Member Calendar, and Kanisa AI consume the same expanded feed.

## UAT Fixture Coverage

The staging bootstrap prepares Choir, Youth Ministry, General, and Multi-Group member accounts, plus five parent events for audience validation:

- `UAT Choir Rehearsal`: weekly parent event targeted to Choir.
- `UAT Youth Retreat`: one-time event targeted to Youth Ministry.
- `UAT Choir + Youth Meeting`: one-time event targeted to both ministries.
- `UAT Parish Meeting`: `all_members`.
- `UAT Public Parish Event`: `everyone`.

See [Event Audience Targeting UAT](EVENT_AUDIENCE_TARGETING_UAT.md) for the full browser, direct-access, and Kanisa AI test matrix.

## Future Notifications

Targeted event notifications should use `event_audience_targets` as the recipient source and resolve active members at send time. A future notification sprint should avoid sending during imports/bootstrap and should treat recurrence updates as parent-series updates rather than per-occurrence notification rows.
