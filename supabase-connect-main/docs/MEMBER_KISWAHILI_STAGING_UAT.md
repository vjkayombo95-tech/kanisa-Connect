# Member Kiswahili Staging UAT Checklist

RC-2.7.0 prepares the actual Member Portal for a human Kiswahili staging walkthrough. This checklist does not assume missing features exist.

## Preconditions

- Use the staging environment only.
- Sign in with a real Member test account linked to a staging parish.
- Confirm the account opens the Member Workspace, not Church Admin, Finance, Pastoral, or Super Admin.
- Use a desktop browser and one mobile viewport or device.
- Confirm the language switcher is available from the workspace account menu.
- Have test data available for parish events, announcements, communities or channels, giving history, and pledges where possible.
- Do not translate or edit parish-authored, CMS-authored, Bible, payment reference, or user-entered content during UAT.

## Test Sequence

| # | Area | Action | Expected Result | PASS/FAIL | Defect Notes | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Sign in | Open staging and sign in as the Member test account. | User lands in the Member workspace or `/portal`; no admin workspace appears. |  |  |  |
| 2 | Workspace | Verify sidebar and header. | Sidebar shows Member groups only: Home, Liturgy, Community, Giving, plus account menu. |  |  |  |
| 3 | Language | Switch to Kiswahili. | Navigation, account menu, workspace chrome, and scoped page UI switch to Kiswahili. |  |  |  |
| 4 | Persistence | Refresh the page. | Kiswahili remains active and `<html lang>` remains synchronized. |  |  |  |
| 5 | Dashboard | Open `/portal`. | Dashboard interface labels, assistant sections, quick actions, giving card, and empty states are readable in Kiswahili; dynamic data remains as stored. |  |  |  |
| 6 | Kanisa AI | Open Kanisa AI and try `masomo ya leo`, `injili ya leo`, `michango yangu`, `wasifu`. | Supported member intents resolve to Member routes or provider-free responses; admin/finance-wide requests are blocked. |  |  |  |
| 7 | Command Center | Open Command Center and search English and Kiswahili terms. | Results show Member routes only, with localized labels/descriptions and keyboard navigation. |  |  |  |
| 8 | Bible | Open Bible landing, search, book, and chapter pages. | UI is localized; book labels localize where mapped; Scripture content is unchanged. |  |  |  |
| 9 | Daily Readings | Open Daily Readings and use previous/today/next. | Dates and labels localize; `sw` CMS content is preferred when available; English fallback is identified honestly. |  |  |  |
| 10 | Prayer Library | Open Prayer Library and search/filter. | Interface labels, filters, empty/loading/error states localize; CMS prayer titles/content remain authored. |  |  |  |
| 11 | Prayer Detail | Open a prayer detail. | Back/actions/metadata labels localize; prayer body and source remain stored content. |  |  |  |
| 12 | Saints | Open Saints listing. | Search, filters, cards, metadata, empty/loading/error states localize; saint names remain stored. |  |  |  |
| 13 | Saint Detail | Open a saint detail. | Interface labels and actions localize; biographies and prayers remain authored content. |  |  |  |
| 14 | Liturgical Calendar | Open Liturgical Calendar. | Month/day labels, feast cards, metadata, and date labels localize. |  |  |  |
| 15 | Parish Calendar | Open Parish Calendar. | Search, filters, date/time labels, categories, and empty states localize. |  |  |  |
| 16 | Events | Open Events and event detail if available. | Event UI localizes; event titles/descriptions remain parish-authored. |  |  |  |
| 17 | Announcements | Open Announcements. | Tabs, badges, empty states, and actions localize; announcement body remains parish-authored. |  |  |  |
| 18 | Communities | Open Communities/Channels. | Channel labels, comments, reactions, empty states, and actions localize. |  |  |  |
| 19 | Ministries | Open Ministries and a ministry detail. | Join/leave/request labels, status labels, schedule sections, and empty states localize. |  |  |  |
| 20 | Giving | Open Giving and walk through the form without submitting real payment unless staging data allows it. | Contribution types, payment methods, validation, confirmation, and amounts localize; values are unchanged. |  |  |  |
| 21 | Contribution History | Open Contribution History and use filters. | Filters, totals, dates, table labels, empty/error states, and receipt action localize. |  |  |  |
| 22 | Receipt | Open a contribution receipt. | Receipt labels, dates, payment method label, and actions localize; receipt number/reference remain unchanged. |  |  |  |
| 23 | Pledges | Open Pledges and payment dialog if test pledge exists. | Pledge statuses, amounts, dialog labels, validation, and actions localize; financial values remain unchanged. |  |  |  |
| 24 | Account menu | Open the account menu. | Profile, Account Settings, Help, language switcher, and Sign Out are visible and localized. |  |  |  |
| 25 | Profile/Settings | Select Profile and Account Settings. | Current architecture returns to the member account/dashboard surface; no missing route error occurs. |  |  |  |
| 26 | Mobile | Repeat dashboard, sidebar, Command Center, Bible, Prayer Library, Events, Giving, Receipt, and Pledges on mobile. | No horizontal overflow, unusable dialogs, clipped buttons, or inaccessible account menu. |  |  |  |
| 27 | English | Switch back to English. | Interface labels return to English; content remains stored as authored. |  |  |  |
| 28 | Refresh | Refresh in English. | English remains active where persistence supports it. |  |  |  |
| 29 | Sign out | Sign out from the account menu. | User returns to the public landing or sign-in page. |  |  |  |
| 30 | Sign in again | Sign in again with the same account. | Current architecture restores persisted language where supported and lands in Member workspace. |  |  |  |

## UAT Notes

- Manual browser UAT is not complete until this checklist is executed in staging.
- Log defects in `docs/MEMBER_KISWAHILI_UAT_DEFECT_LOG.md`.
- Classify missing standalone Notifications and Member Sacramental History as product gaps, not RC-2.7.0 localization defects.
- Use `docs/MEMBER_KISWAHILI_UAT_RUNBOOK.md` for the full session order, pre-UAT checks, mobile priorities, defect capture, and retest process.
- Use `docs/MEMBER_KISWAHILI_UAT_DATA_MATRIX.md` to decide whether a route should be tested with populated data or empty-state behavior.
