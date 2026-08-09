# Member Catholic Content Localization

## Scope

RC-2.6.2 completes the interface localization pass for the Member Portal Catholic content surfaces:

- `/portal/library` via `MemberLibraryPage`
- `/portal/prayers/:prayerId` via `PortalPrayerPage`
- `/portal/library/:slug` and `/portal/saints/:saintId` via `MemberSaintDetailsPage`
- `/portal/liturgical-calendar` via `LiturgicalCalendarPage`

No backend schema, Supabase migration, or Catholic content translation was added.

## Audit Findings

Interface text requiring localization included page titles, descriptions, search placeholders, filter labels, result counts, empty/error states, card actions, metadata headings, share/copy actions, pagination, month navigation, and feast-day labels.

Dynamic content intentionally remains content-controlled:

- Prayer titles, summaries, bodies, categories, collections, and tags from CMS.
- Saint names, titles, biographies, quotes, reflections, prayers, patronage, country, and tags.
- Scripture text and Scripture references.

Stable identifiers now localize only at display time:

- `ordinary_time`, `advent`, `christmas`, `lent`, `easter`
- `solemnity`, `feast`, `memorial`, `optional_memorial`

## Changes

Prayer Library:

- Localized hero, search, filters, result counts, section headings, empty states, errors, clear filters, pagination, and `Open Prayer`.
- Added content-language badges when a displayed prayer language differs from the active interface language.

Prayer Detail:

- Completed localized metadata labels for category, language, and tags.
- Kept prayer body and summary unchanged.
- Reused existing localized copy/share/print/back/error/not-found labels.

Saints Listing:

- Localized saint category filters, featured badges, result counts, empty states, pagination, and `View Saint`.
- Feast dates now use locale-aware formatting.

Saint Detail:

- Localized back/share actions, error/not-found states, feast day, patronage, country, Scripture, biography/reflection/prayer headings, tags, and related saints.
- Saint biography, reflection, quote, and prayer content remain unchanged.

Liturgical Calendar:

- Localized title, description, today label, month controls, search, result counts, empty/error states, feast list, calendar metadata, and `View Saint`.
- Month and weekday labels are produced through `Intl` using the active app locale.

## Terminology

- Prayer Library: `Maktaba ya Sala`
- Featured Prayers: `Sala Zilizoangaziwa`
- Seasonal Prayers: `Sala za Majira ya Liturujia`
- Saints: `Watakatifu`
- Feast Day: `Sikukuu`
- Patronage: `Ulinzi`
- Liturgical Calendar: `Kalenda ya Liturujia`
- Solemnity: `Sherehe Kuu`
- Optional Memorial: `Kumbukumbu ya Hiari`

## Content Language

The interface may be Kiswahili while content remains English. In that case, Member-facing prayer cards show an explicit content-language badge such as `Maudhui yanapatikana kwa English`.

Matching content language does not show a fallback badge. No prayer or saint content is machine-translated.

## Date Formatting

Feast dates now route through `formatFeastDay(month, day, language)`, which uses the same `localeForLanguage` mapping as the wider localization foundation.

## Tests

`src/test/member-catholic-content-localization.test.ts` verifies:

- English and Kiswahili Catholic content keys exist.
- Authored prayer and saint content remains unchanged.
- Liturgical display identifiers map to translation keys without mutating stored values.
- Feast dates use locale-aware formatting.

## Remaining Debt

Within this sprint scope, remaining English may appear only from dynamic CMS/saint content or raw database values that have no stable display mapping yet. Outside this sprint, Parish Calendar, Announcements, Events, Contributions, Pledges, Communities, Ministries, Notifications, Profile, and Settings remain separate localization scopes.

