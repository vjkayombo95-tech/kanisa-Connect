# Catholic Daily Experience

RC-LITURGY-01 makes the member portal landing route a daily Catholic companion. It composes completed platform modules without changing the Speech Engine, Universal Audio Platform, Synchronization Engine, Bible Index Engine, or Study Workspace.

## Architecture

`LiturgyHomePage` is the daily landing experience for `/portal`.

Component hierarchy:

- `TodaysLiturgicalDayCard`
- `TodaysReadingsCard`
- `TodaysSaintCard`
- `PrayerOfTheDayCard`
- `TodaysHomilyCard`
- `ContinueReadingCard`
- `ContinueListeningCard`
- `UpcomingCelebrationsCard`
- Personal study preview for recent bookmarks, notes, and favorites

The existing member dashboard remains available at `/portal/dashboard`.

## Data Flow

The page uses React Query for all daily data:

- Liturgical day and legacy readings: `fetchTodayLiturgicalReadings`
- CMS readings: `fetchMemberCmsDailyReadingByDate`
- Saint of the day: `fetchSaintOfDayFromLiturgy`
- Prayer of the day: `fetchTodayPrayer`
- Universal audio: `loadAudioContent`, `loadAudioTracks`, and existing audio progress tables
- Study preview: existing `content_bookmarks`, `content_notes`, and `content_favorites`

Tomorrow's liturgical readings are prefetched after the page loads.

## Integration Points

Today's Gospel opens the Premium Bible Reader by parsing the reading reference with `parseBibleReference` and routing through `bibleReferenceToPath`.

Prayer and homily playback use `UniversalAudioPlayer` with persisted RC-AUDIO metadata when a published audio track exists.

Continue Reading uses the Bible Reader progress keys already persisted by RC-BIBLE-02.

Continue Listening uses existing RC-AUDIO progress and track data.

Personalization reads existing Study Workspace rows. It does not create new study tables or duplicate bookmark/note/favorite logic.

## Accessibility

Cards use semantic headings, accessible labels, keyboard-focusable links, visible focus states inherited from the design system, and graceful empty states. The layout is mobile-first and scales to desktop with responsive grids.

## Performance

The page lazy-loads `UniversalAudioPlayer`, uses React Query cache settings from the daily Catholic content layer, prefetches tomorrow's readings, and avoids duplicate reading requests by sharing the same liturgical query keys used elsewhere.

## Future Expansion

The landing experience is prepared for:

- Mass Intentions
- Confession schedule
- Parish announcements
- Events
- Volunteer opportunities
- Donations
- Live Mass

These should be added as additional cards or sections that consume existing domain services rather than changing the completed platform architecture.
