# Member Localization Final Audit

## RC-2.7.2 UAT Data Note

The staging bootstrap now prepares the missing Member UAT data required to verify localized populated states without changing application logic or database schema. The added bootstrap-owned records cover CMS Prayer Library, CMS Daily Readings, Pledges, Ministries, Channels, Prayer Requests, and Mass Intentions where the corresponding tables already exist.

The seed content is intentionally marked as staging UAT data. User-entered text, parish-authored content, financial values, references, and identifiers remain stored exactly as seeded and are not translated by the localization layer.

RC-2.7.0 is a UAT-readiness audit of the actual Member Portal. It does not add missing product features, content, schema, migrations, payment logic, authentication logic, or RLS changes.

## Actual Member Route Inventory

| Route | Component | Navigation Label | Visible In Member Navigation | Localization Status | Dynamic Content Behavior | Mobile Relevance | Feature Flag / Permission | Staging UAT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/portal` | `MemberDashboard` | Dashboard | Yes | Mostly localized shell and widgets; dashboard data remains source-owned. | User/church/parish data unchanged. | High | Member workspace | Yes |
| `/portal/dashboard` | `PortalDashboard` | Not primary nav | No | Dashboard shell localized; some broad dashboard data cards may need browser review. | User/church/parish data unchanged. | High | Member workspace | Yes |
| `/portal/bible-verses` | `PortalHome` | Legacy Bible Verse route | No | Legacy route; not primary UAT path. | Scripture unchanged. | Medium | Member workspace | Smoke only |
| `/portal/kanisa-ai` | `KanisaAIHome` | Kanisa AI | Yes | Localized shell, suggestions, deterministic responses, and provider-required states. | Retrieved content remains source language. | High | `kanisa_ai` | Yes |
| `/portal/bible` | `MemberBibleHomePage` | Bible | Yes | Localized. | Scripture text unchanged; book labels localize where mapped. | High | `bible_verses` | Yes |
| `/portal/bible/:bookId` | `MemberBibleBookPage` | Bible child route | No | Localized. | Stored book identifiers unchanged. | High | `bible_verses` | Yes |
| `/portal/bible/:bookId/chapter/:chapterNumber` | `MemberBibleChapterPage` | Bible child route | No | Localized. | Verse text unchanged. | High | `bible_verses` | Yes |
| `/portal/daily-readings` | `DailyReadingsPage` | Daily Readings | Yes | Localized. | Prefers `sw` CMS content when available; English fallback labelled. | High | `catholic_content` | Yes |
| `/portal/library` | `MemberLibraryPage` | Saints | Yes | Localized Catholic library interface. | CMS prayer/saint titles, tags, bodies remain authored. | High | `catholic_content` | Yes |
| `/portal/library/:slug` | `MemberSaintDetailsPage` | Detail route | No | Localized detail interface. | Saint/prayer content remains authored. | High | `catholic_content` | Yes |
| `/portal/saints/:saintId` | `MemberSaintDetailsPage` | Detail route | No | Localized detail interface. | Saint content remains authored. | High | `catholic_content` | Yes |
| `/portal/liturgical-calendar` | `LiturgicalCalendarPage` | Liturgical Calendar | Yes | Localized. | Feast/saint content remains authored. | High | `catholic_content` | Yes |
| `/portal/prayers/:prayerId` | `PortalPrayerPage` | Prayer detail | No | Localized. | Prayer body/source remain authored. | Medium | `catholic_content` | Yes |
| `/portal/reflections` | `PortalReflectionPage` | Reflection | Yes | Basic localized coverage; verify in browser. | Reflection content remains authored. | Medium | `catholic_content` | Yes |
| `/portal/reflections/:reflectionId` | `PortalReflectionPage` | Reflection detail | No | Basic localized coverage; verify in browser. | Reflection content remains authored. | Medium | `catholic_content` | Yes |
| `/portal/calendar` | `ParishCalendarPage` | Parish Calendar | Yes | Localized parish-life interface. | Parish event titles/descriptions unchanged. | High | `events` | Yes |
| `/portal/events` | `PortalEvents` | Events | Yes | Localized parish-life interface. | Parish event content unchanged. | High | `events` | Yes |
| `/portal/event-requests` | `EventRequests` | Not primary nav | No | Existing localized request form. | Submitted request text unchanged. | Medium | Member workspace | Smoke only |
| `/portal/announcements` | `PortalAnnouncements` | Announcements | Yes | Localized parish-life interface. | Announcement content unchanged. | High | `announcements` | Yes |
| `/portal/ministries` | `PortalMinistries` | Ministries | Yes | Localized parish-life interface. | Ministry names/descriptions unchanged. | High | `ministries` | Yes |
| `/portal/ministries/:ministryId` | `PortalMinistries` | Ministry detail | No | Localized parish-life interface. | Ministry content unchanged. | High | `ministries` | Yes |
| `/portal/community-help` | `PortalCommunityHelp` | Community Help | Yes | Localized parish-life interface; browser review needed for all request states. | User-entered request text unchanged. | High | `community_help` | Yes |
| `/portal/channels` | `PortalChannels` | Communities | Yes | Localized comments/channel interface. | Messages and channel names unchanged. | High | `channels` | Yes |
| `/portal/sermons` | `PortalSermons` | Not primary nav | No | Legacy/community content path; needs smoke review. | Sermon content unchanged. | Medium | Member workspace | Smoke only |
| `/portal/prayer-requests` | `PortalPrayerRequests` | Prayer Requests | Yes | Mostly localized but still has known hardcoded toast copy in comment/prayer interactions. | Prayer request text unchanged. | High | `prayer_requests` | Yes |
| `/portal/mass-intentions` | `PortalMassIntentions` | Mass Intentions | Yes, in Liturgy and Giving | Existing localized form/status coverage. | Intention text and Mass names unchanged. | High | `mass_intentions` | Yes |
| `/portal/give` | `PortalGive` | Giving | Yes | Localized RC-2.6.4. | Financial values and references unchanged. | High | `give` | Yes |
| `/portal/contribution-history` | `PortalContributionHistoryPage` | Contribution History | Yes | Localized RC-2.6.4. | Stored categories/references unchanged. | High | `contributions` | Yes |
| `/portal/contribution-receipt/:contributionId` | `PortalContributionReceiptPage` | Receipt detail | No | Localized RC-2.6.4. | Receipt number/reference unchanged. | High | `contributions` | Yes |
| `/portal/pledges` | `PortalPledges` | Pledges | Yes | Localized RC-2.6.4. | Pledge amounts/status identifiers unchanged. | High | `pledges` | Yes |

## Navigation Findings

- Navigation references are all Member-owned `/portal` routes.
- No Member navigation entries point to Church Admin, Finance, Pastoral, or Super Admin paths.
- Navigation has no standalone Member Notifications, Profile, Settings, or Sacramental History entries.
- Account menu Profile and Account Settings currently resolve to the existing member account/dashboard surface rather than standalone pages.

## Missing Member Experiences

| Experience | Status | Notes |
| --- | --- | --- |
| Member Sacramental History | MISSING | Pastoral sacrament management exists, but no Member route exists. Do not create in RC-2.7.0. |
| Member Notifications | MISSING | Church Admin notifications route exists, but no Member route exists. Do not create in RC-2.7.0. |
| Profile | PARTIAL | Account menu exposes Profile, but it routes to the existing member surface rather than a standalone profile page. |
| Account Settings | PARTIAL | Account menu exposes Account Settings, but it routes to the existing member surface rather than a standalone settings page. |

## Hardcoded String Findings

### BLOCKING

- None found in code audit that blocks a Kiswahili staging walkthrough.

### MAJOR

- Some legacy or secondary routes such as `/portal/sermons`, `/portal/bible-verses`, and `/portal/dashboard` need browser smoke review because they are not the primary localized route path.

### MINOR

- Some dashboard data-card summaries may still read in English depending on available source data.
- Some fallback values may be source-language or data-driven rather than interface translations.

### INTENTIONAL

- Bible text, prayer bodies, saint biographies, Daily Readings content, announcement bodies, event names/descriptions, ministry names/descriptions, channel messages, user-entered requests, transaction references, receipt numbers, and CMS tags remain exactly as stored.

## Language Persistence Findings

- The app uses one i18next architecture through `src/i18n.ts`, `src/lib/localization.ts`, and `src/locales/en.json` / `src/locales/sw.json`.
- Member routes default to Kiswahili for the Tanzania pilot unless a persisted preference exists.
- The workspace shell, mobile drawer, account menu, Kanisa AI, and Command Center consume the same i18next state.
- `<html lang>` synchronization is part of the localization foundation and should be verified manually in staging after refresh and sign-in.

## Surface Findings

- Dashboard: Ready for staging UAT, with dynamic/source data intentionally unchanged. Browser review should focus on greeting, priorities, giving card, quick actions, and mobile stacking.
- Kanisa AI: Member workspace isolation and Kiswahili intent aliases are covered by tests. Browser UAT should verify composer text, provider-required messages, and structured responses.
- Command Center: Member routes are isolated to `/portal`; Kiswahili discovery terms exist for scoped member commands. Browser UAT should verify keyboard and mobile behavior.
- Bible: Interface is localized and stored Scripture is preserved. Book display names localize where mapped.
- Daily Readings: Interface localizes and `sw` content preference with explicit English fallback is implemented. No readings are populated by this sprint.
- Catholic Content: Prayer Library, Prayer Detail, Saints, Saint Detail, and Liturgical Calendar are localized at interface level. Authored CMS content remains unchanged.
- Parish Life: Calendar, Events, Announcements, Communities/Channels, and Ministries are localized at interface level. Parish-authored content remains unchanged.
- Giving/Pledges: Giving, Contribution History, Receipt, Pledges, Payment Dialog, and Dashboard Giving Card are localized. Financial isolation and stored references remain unchanged.
- Account: Account menu, language switcher, and Sign Out are shared workspace features. Profile/Settings are partial because no standalone member routes exist.

## Mobile And Accessibility Findings

- Mobile UAT is required for dialogs, filter bars, Bible navigation, calendar views, receipt views, Command Center, Kanisa AI composer, and account menu.
- Existing scoped components use standard buttons, dialogs, labels, and accessible names in most primary flows.
- Browser UAT should verify focus order and screen-reader names for icon-only controls, especially Bible navigation, Command Center, receipt actions, and mobile drawer controls.

## Tests

- Added `member-kiswahili-uat-readiness.test.ts` to guard Member route ownership, documented missing Member routes, and Member navigation translation key coverage.
- Existing tests cover localization foundation, Catholic content localization, parish-life localization, giving/account localization, Kanisa AI workspace isolation, and content/interface separation.

## Fixes Made During RC-2.7.0

- Localized the visible Member Prayer Requests interface and feedback copy, including submit dialog labels, privacy labels, optional offering breakdown, offline sync card, tabs, empty states, prayer/comment toasts, prayer status labels, date display, and comment placeholders.
- Preserved prayer request privacy values, request/comment bodies, offline sync payloads, rate limiting, member financial isolation, and database write behavior.

## Remaining Localization Debt

- Smoke-test legacy `/portal/bible-verses`, `/portal/sermons`, and `/portal/dashboard`.
- Decide future product ownership for Member Notifications, Member Sacramental History, standalone Profile, and standalone Account Settings.

## Readiness Recommendation

The current Member Portal is ready for a full Kiswahili staging UAT walkthrough, with the known caveat that manual browser testing has not yet been executed. Use `MEMBER_KISWAHILI_STAGING_UAT.md` and log defects in `MEMBER_KISWAHILI_UAT_DEFECT_LOG.md`.

## RC-2.7.1 Staging UAT Preparation

- UAT runbook: [Member Kiswahili UAT Runbook](MEMBER_KISWAHILI_UAT_RUNBOOK.md)
- Data matrix: [Member Kiswahili UAT Data Matrix](MEMBER_KISWAHILI_UAT_DATA_MATRIX.md)
- Defect fix prompt: [Member UAT Defect Fix Prompt](MEMBER_UAT_DEFECT_FIX_PROMPT.md)

### Staging Deployment Readiness Notes

- Current branch expected for UAT preparation: `staging`.
- Frontend staging mode exists through `npm run build:staging`.
- Staging environment variables are structured through `.env.staging.example`.
- Local secret files must not be committed or pasted into test notes.
- The working tree contains many uncommitted RC-2.6.x/RC-2.7.x changes, so deployment should use a reviewed commit or intentionally packaged staging branch state rather than an accidental dirty working tree.

### Migration Assumptions For Human Verification

- Required Daily Readings/Catholic CMS migration chain:
  - `20260704100000_create_catholic_cms_foundation.sql`
  - `20260704110000_create_cms_daily_readings.sql`
  - `20260704120000_daily_readings_import_batches.sql`
  - `20260704121000_ensure_daily_readings_import_batch_link.sql`
- RC-2.6.x and RC-2.7.x localization work introduced no new database migrations.
- Human tester or release owner should verify staging migration history before UAT if the staging database was recently reset.

### Observability Notes

- Member UAT pages generally expose loading, empty, and friendly error states through existing page-state components, toast feedback, or localized fallback messages.
- Failed mutations in Prayer Requests, Giving, Pledges, Mass Intentions, and parish-life interactions should show user-facing feedback.
- Offline Prayer Requests expose pending offline sync state.
- Kanisa AI uses provider-required and permission-denied responses instead of silent failure.
- No new monitoring platform was added in RC-2.7.1.
