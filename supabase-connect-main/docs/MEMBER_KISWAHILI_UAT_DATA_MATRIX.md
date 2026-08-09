# Member Kiswahili UAT Data Matrix

This matrix lists the minimum staging data needed for meaningful Member Portal UAT. It reflects the current routes, not desired future features.

| Feature | Route | Required Staging Data | Existing Bootstrap Coverage | Expected Populated Behavior | Expected Empty-State Behavior | UAT Priority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Member workspace home | `/portal` | Auth user, profile, member row, church row, user role | Covered | Member dashboard opens with parish context and member-specific widgets. | Missing member/church context should show friendly unavailable states. | High | Must confirm workspace isolation. |
| Member dashboard alternate | `/portal/dashboard` | Same as `/portal` | Covered | Dashboard route renders without admin redirect for real member. | Empty widgets explain missing data. | Medium | Secondary route; smoke test. |
| Legacy portal home | `/portal/bible-verses` | Church/member context, Bible verse data if used | Partial | Legacy route renders or redirects safely. | No blank page. | Low | Not primary UAT path. |
| Kanisa AI | `/portal/kanisa-ai` | Member workspace context; optional cached route data | Covered by app context, not data-specific | Kiswahili prompts resolve to supported Member actions/responses. | Provider-required/fallback states are localized and honest. | High | No provider integration expected. |
| Bible landing | `/portal/bible` | Bible books/chapters/verses | Depends on Bible seed/import | Search and book selection work; book labels localize. | Empty/error state explains unavailable Bible data. | High | Scripture content remains unchanged. |
| Bible book | `/portal/bible/:bookId` | Selected book chapters | Depends on Bible seed/import | Chapter list opens. | Empty chapters state appears. | High | Stored book IDs unchanged. |
| Bible chapter | `/portal/bible/:bookId/chapter/:chapterNumber` | Selected chapter verses | Depends on Bible seed/import | Reader, previous/next, verse actions work. | Empty verses state appears. | High | No false content-language claims. |
| Daily Readings | `/portal/daily-readings` | Published `content_daily_readings` rows for dates; languages optional | Covered by RC-2.7.2 bootstrap for yesterday/today/tomorrow when CMS table exists; legacy `daily_readings` placeholder remains optional | Shows readings; prefers `sw` row where available; labels English fallback. | Empty state for missing readings. | High | Seeded CMS rows are clearly marked as staging UAT, not official liturgical text. |
| Prayer Library | `/portal/library` | Published CMS prayers/categories/tags; saints also appear in library surfaces | Covered by RC-2.7.2 bootstrap with one published member-visible CMS prayer | Search/filter/listing show authored content with localized UI. | Empty library state appears. | High | Prayer body remains authored UAT content. |
| Prayer Detail | `/portal/prayers/:prayerId` | A published CMS prayer row | Covered by RC-2.7.2 bootstrap via slug `uat-sala-ya-asubuhi` | Detail metadata/actions localize; body unchanged. | Not-found state appears. | Medium | Use seeded slug or list navigation. |
| Saints listing | `/portal/library` | Active saints | Covered by saint Excel workbooks | Saints list/search/filter works. | Empty saints/library state appears if no saints. | High | Saints content is authored. |
| Saint Detail | `/portal/library/:slug`, `/portal/saints/:saintId` | Active saint with slug/id | Covered | Detail renders biography, prayer, image/placeholder. | Not-found state appears. | High | Verify image placeholder behavior. |
| Liturgical Calendar | `/portal/liturgical-calendar` | Saints with feast month/day | Covered | Calendar and feast cards render. | Empty month/day states appear. | High | Feast content remains authored. |
| Parish Calendar | `/portal/calendar` | Events and/or Mass events | Events and Mass RSVP covered | Calendar shows parish events and localized filters. | No scheduled items state appears. | High | Verify dates/times. |
| Events | `/portal/events` | Published/upcoming events | Covered | Event cards and RSVP/attendance flows render where applicable. | No events state appears. | High | Event titles remain parish-authored. |
| Event Requests | `/portal/event-requests` | Member/church context | Covered | Request form can submit in staging if policies allow. | Validation states appear. | Medium | Not primary nav. |
| Announcements | `/portal/announcements` | Published announcements | Covered | Announcements show localized chrome and stored content. | No announcements state appears. | High | Body remains parish-authored. |
| Ministries | `/portal/ministries` | Ministry records; optional member memberships/events | Covered by RC-2.7.2 bootstrap with one ministry and member membership when tables exist | Ministry list/detail/join states render if data exists. | No ministries/no matches state appears. | High | Seeded ministry: UAT Choir Ministry. |
| Ministry detail | `/portal/ministries/:ministryId` | One ministry row | Covered by RC-2.7.2 bootstrap when ministries table exists | Detail panel opens. | Not-found/list fallback appears. | Medium | Smoke from seeded list item. |
| Community Help | `/portal/community-help` | Member/church context; optional help requests | Not clearly covered | Request/list states render. | Empty state appears. | Medium | Verify no silent mutation failure. |
| Communities/Channels | `/portal/channels` | Channel/community records and optional messages | Covered by RC-2.7.2 bootstrap with one community channel, membership, and starter message when chat tables exist | Channels, messages, comments, reactions render. | No channels/no messages state appears. | High | Seeded channel is member-visible through `chat_channel_members`. |
| Sermons | `/portal/sermons` | Sermon records | Not covered | Sermon list renders if data exists. | No sermons state appears. | Low | Legacy/secondary route. |
| Prayer Requests | `/portal/prayer-requests` | Member/church context; optional prayer requests/comments | Covered by RC-2.7.2 bootstrap with one approved member prayer request and comment | Community/my request tabs render; comments/pray actions localize. | No prayer requests states appear. | High | RC-2.7.0 localized visible copy. |
| Mass Intentions | `/portal/mass-intentions` | Member/church context; optional member intentions | Covered by RC-2.7.2 bootstrap with one pending member intention | Form/list/statuses render where data exists. | Empty state or form-only state appears. | High | Preserve intention text. |
| Giving | `/portal/give` | Member/church context; contribution categories optional | Member/church covered; contributions covered | Giving flow localizes and can submit only in staging if payment path is safe. | Validation explains missing member/context. | High | Do not change payment architecture. |
| Contribution History | `/portal/contribution-history` | Member contributions | Covered | Filters, totals, table, receipt action show member-only contributions. | No contributions state appears. | High | Financial isolation is critical. |
| Contribution Receipt | `/portal/contribution-receipt/:contributionId` | A contribution owned by member | Covered | Receipt renders labels and stored references. | Not found/permission state appears. | High | Use seeded member contribution. |
| Pledges | `/portal/pledges` | Member row; optional community and pledge rows | Covered by RC-2.7.2 bootstrap with one community and one partial pledge when tables exist | Existing pledges/payment dialog render if data exists. | No pledges or community-required state appears. | High | Financial values remain unchanged and member-scoped. |
| Account menu | Shared workspace sidebar | Auth user/profile | Covered | Profile, Account Settings, Help, language switcher, Sign Out visible. | Missing profile should still allow sign out. | High | No standalone Profile/Settings route exists. |

## Bootstrap Coverage Summary

- Covered: auth users, profiles, church, member records, roles, saints, CMS Prayer Library prayer, CMS Daily Readings rows, contributions, member pledge, community, ministry, channel/message, prayer request/comment, member Mass intention, Mass RSVP records, event attendance, events, announcements, notifications, invitation.
- Partial: Bible data, dashboard summaries.
- Uncovered or intentionally empty: sermons, standalone Profile/Settings, standalone Notifications, Member Sacramental History.

## Smallest Future Bootstrap Improvement

RC-2.7.2 covers the smallest useful Member UAT data set for Prayer Library, Daily Readings, Pledges, Ministries, Channels, Prayer Requests, and Mass Intentions. Remaining data gaps should be handled only if a UAT script explicitly needs those surfaces populated.
