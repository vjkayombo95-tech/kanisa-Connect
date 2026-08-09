# RC-PARISH-01 Parish Companion

## Architecture

`MyParishPage` is a member workspace route at `/portal/my-parish`. It is a parish companion hub, not a replacement for the existing Liturgy Home. The page is composed of reusable widgets:

- `TodaysMassWidget`
- `MassScheduleWidget`
- `ConfessionTimesWidget`
- `ParishAnnouncementsWidget`
- `UpcomingEventsWidget`
- `VolunteerOpportunitiesWidget`
- `MassIntentionsWidget`
- `LiveStreamWidget`
- `ContactParishWidget`
- `QuickGiveWidget`
- `EmergencyPrayerRequestsWidget`
- `ParishNotificationsWidget`
- `ParishSpiritualBridgeWidget`

The widgets keep the first screen focused on today's Catholic life: Gospel, prayer, Mass, announcements, events, giving, livestreams, and saved reading/listening progress.

## Data Flow

The page consumes existing services and member modules:

- Parish calendar data comes from `useParishCalendarEvents`, backed by the shared parish calendar feed.
- Announcements come from `fetchPortalAnnouncements`.
- Volunteer opportunities use `fetchMinistrySummaries` and calendar training/ministry events.
- Giving is delegated to `/portal/give`, `/portal/pledges`, and contribution history.
- Mass intentions are summarized from the existing Mass intentions table and submitted through `/portal/mass-intentions`.
- Live Mass and archive links reuse the existing sermons/livestream surface.
- Today's Gospel and prayer use the existing liturgy, CMS daily reading, Bible reference, and prayer services.
- Listening restoration reads `audio_progress` and Universal Audio track metadata through `loadAudioTracks`.
- Reading restoration reads the same Bible Reader local progress keys used by the synchronized reader.

## Parish Lifecycle

1. A parishioner opens `/portal/my-parish`.
2. The page loads today's Catholic companion data and the next 21 days of parish calendar data.
3. Calendar events are classified into Mass, confession, ministry, and general parish events.
4. The primary Mass widget shows today's Mass or the next available Mass with reminder, navigation, and livestream actions.
5. The widgets link into existing full workflows for RSVP, giving, prayer requests, Mass intentions, ministry joining, and livestream archives.

## Notifications

`ParishNotificationsWidget` surfaces the notification categories required for RC-PARISH-01:

- Upcoming Mass
- Today's Gospel
- Feast day and daily Catholic content through Daily Readings and Liturgy
- Parish events

The widget is presentation-level integration. Notification delivery remains owned by the existing notification system.

## Performance

The hub keeps rendering work light:

- Calendar classification is memoized with `useMemo`.
- Query stale times prevent noisy reloads.
- Widgets are narrow and reusable.
- Full workflows are linked instead of duplicated inside the hub.
- Universal Audio platform data is consumed only for restoration metadata, leaving playback ownership with existing audio surfaces.

## Extension

Future parish content can be added as new widgets that consume the same service boundaries. Examples:

- Sacrament preparation status
- Parish groups and small communities
- Pastoral appointments
- Campaign-specific giving cards
- Push notification preferences
- Parish office hours and staff directory

New widgets should link to existing workflow pages when a full workflow already exists.
