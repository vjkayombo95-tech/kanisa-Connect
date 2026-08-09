# Member Portal Kiswahili Completion

## Scope

RC-2.6.1 extends the English/Kiswahili localization foundation into high-traffic Member Portal surfaces. This is interface localization only.

No Catholic content was machine-translated. Bible text, Daily Readings content, prayers, saints, announcements, and authored CMS fields remain controlled by their stored content language.

## Completed Coverage

- Member Daily Readings page toolbar, hero, date controls, source badges, loading/error/empty states, reading-card labels, reflection/prayer section headings, and passage actions.
- Member Daily Readings CMS lookup now uses the active interface language so `sw` content is preferred when available, with honest English fallback labeling.
- Prayer detail page back navigation, actions, toast copy, error/empty states, source and collection labels, favorites placeholder, and content-language badges.
- Member Bible landing, book, and chapter pages: toolbar copy, search labels, reference validation, empty/error states, testament labels, chapter controls, and navigation copy.
- Member Bible book display labels now localize common Catholic book names for Kiswahili interface mode while preserving stored Scripture text.
- RC-2.6.2 completes the scoped Catholic content interface pass for Prayer Library listing, Prayer Detail metadata, Saints listing, Saint Detail, and Liturgical Calendar. See [Member Catholic Content Localization](MEMBER_CATHOLIC_CONTENT_LOCALIZATION.md).
- RC-2.6.3 completes the scoped parish-life interface pass for Parish Calendar, Events, Announcements, Communities, Ministries, and Command Center parish-life shortcuts. See [Member Parish Life Localization](MEMBER_PARISH_LIFE_LOCALIZATION.md).
- RC-2.6.4 completes the scoped Member Giving, Contribution History, Pledges, account-command, and receipt localization pass.
- RC-2.7.0 audits the actual Member Portal route inventory and prepares the staging UAT package. See [Member Localization Final Audit](MEMBER_LOCALIZATION_FINAL_AUDIT.md) and [Member Kiswahili Staging UAT](MEMBER_KISWAHILI_STAGING_UAT.md).
- Dashboard experience shell labels for greeting, focus, priorities, briefing, operational snapshot, activity timeline, and quick actions.
- Kanisa AI deterministic conversation responses for member-facing Daily Readings, Prayer Library, Calendar, Contributions, and Mass Intentions.
- Localization tests for Kiswahili Kanisa AI responses and member portal UI/content language separation.

## Member Route Inventory

| Route | Component | RC-2.6.1 Status |
| --- | --- | --- |
| `/portal` | `MemberDashboard` | Previously localized through dashboard experience shell; widget data copy remains source-owned. |
| `/portal/dashboard` | `PortalDashboard` | Previously localized for shared dashboard shell labels. |
| `/portal/daily-readings` | `DailyReadingsPage` | Completed in prior pass; content language remains CMS-owned. |
| `/portal/prayers/:prayerId` | `PortalPrayerPage` | Completed in prior pass; authored prayer text remains CMS-owned. |
| `/portal/bible` | `MemberBibleHomePage` | Completed in this continuation pass. |
| `/portal/bible/:bookId` | `MemberBibleBookPage` | Completed in this continuation pass. |
| `/portal/bible/:bookId/chapter/:chapterNumber` | `MemberBibleChapterPage` | Completed in this continuation pass. |
| `/portal/kanisa-ai` | `KanisaAIHome` | Covered by RC-2.4/RC-2.5 AI workspace localization and deterministic responses. |
| `/portal/events`, `/portal/calendar`, `/portal/event-requests` | Events and calendar pages | Parish Calendar and Events interface copy completed in RC-2.6.3; Event Request form/admin copy already localized. |
| `/portal/announcements`, `/portal/give`, `/portal/contribution-history`, `/portal/contribution-receipt/:contributionId`, `/portal/pledges` | Parish and giving pages | Announcements interface copy completed in RC-2.6.3; giving and pledge surfaces completed in RC-2.6.4. |
| `/portal/mass-intentions` | `PortalMassIntentions` | Core form/status copy already localized through mass-intention namespaces. |
| `/portal/library`, `/portal/library/:slug`, `/portal/saints/:saintId`, `/portal/liturgical-calendar` | Catholic library and saints pages | Catholic content interface chrome completed in RC-2.6.2; authored content remains content-controlled. |
| `/portal/ministries`, `/portal/community-help`, `/portal/channels`, `/portal/reflections`, `/portal/sermons` | Community/content pages | Ministries and Communities/channels interface copy completed in RC-2.6.3; remaining pages stay tracked below. |

## Interface And Content Boundary

Interface labels live in:

- `src/locales/en.json`
- `src/locales/sw.json`

Content language remains separate:

- CMS Daily Readings and Prayer Library records keep their authored text.
- The interface may show `Maudhui ya Kiingereza` when the requested Kiswahili content falls back to an English record.
- Stored statuses and database enum values are not translated in persistence.

## Remaining Translation Debt

- Standalone Member Notifications, Member Sacramental History, Profile, and Account Settings are product gaps or partial account-menu surfaces, not complete Member routes.
- Legacy or secondary routes such as `/portal/bible-verses`, `/portal/sermons`, and `/portal/dashboard` need staging smoke review.
- Some dashboard widgets still render data-specific source summaries and should be reviewed in browser UAT.

## RC-2.7.0 UAT Package

- [Member Localization Final Audit](MEMBER_LOCALIZATION_FINAL_AUDIT.md)
- [Member Kiswahili Staging UAT Checklist](MEMBER_KISWAHILI_STAGING_UAT.md)
- [Member Kiswahili UAT Defect Log](MEMBER_KISWAHILI_UAT_DEFECT_LOG.md)

## Verification

Use the standard project checks:

- `cmd /c npm run test`
- `cmd /c npm run build`

No Supabase migration or database push is required for this localization sprint.
