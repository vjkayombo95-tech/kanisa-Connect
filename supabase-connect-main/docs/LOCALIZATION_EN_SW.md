# English/Kiswahili Localization Foundation

## Scope

RC-2.6.0 establishes a centralized English/Kiswahili interface localization foundation for Kanisa Connect. It does not translate Catholic CMS content, database enum values, Bible text, prayers, Daily Readings, saints, or announcements automatically.

## Audit Findings

- i18next and react-i18next were already installed and initialized in `src/i18n.ts`.
- Existing translation files lived in `src/locales/en.json` and `src/locales/sw.json`; a few pages already used `useTranslation`.
- Workspace navigation, account menu, preview banner, Kanisa AI Home, and Command Center still had many hardcoded interface strings.
- Workspace navigation strings came from the registry and were rendered directly.
- CMS content language is modeled separately through `content_languages` and content rows.
- Stored statuses such as `published`, `draft`, and `pending` are stable identifiers and must remain untranslated in storage.

## Architecture

The application uses one i18next instance:

- `src/i18n.ts` initializes resources and persistence.
- `src/lib/localization.ts` owns locale resolution, supported language helpers, document language updates, date/number/currency formatters, status label key mapping, and content fallback selection.
- `src/locales/en.json` and `src/locales/sw.json` hold interface translations.
- Shared shell components call `t(...)` at render time instead of duplicating workspace registries.

## Language Resolution

Resolution order:

1. Persisted preference in `localStorage` under `ecclesia-language`.
2. Tanzania pilot default: `/portal` member routes default to Kiswahili.
3. Other workspaces default to English.
4. Invalid values fall back safely through the same policy.

The browser language is not the sole authority. This keeps the Tanzania member pilot predictable.

## Language Switcher

The existing language switcher is now mounted in the shared workspace account menu. It is available from the desktop sidebar account section and the mobile drawer account section.

Accessibility behavior:

- Keyboard-accessible buttons.
- `aria-label` on the switcher group and buttons.
- `aria-pressed` exposes the active language.
- `<html lang>` updates when the interface language changes.

## Interface Language vs Content Language

Interface locale controls navigation, labels, buttons, headings, placeholders, messages, status labels, and Kanisa AI interface text.

Content language controls Catholic content records such as prayers, Bible text, Daily Readings, reflections, saints, and announcements.

Choosing Kiswahili interface does not translate English Catholic content. Member Daily Readings now prefer a matching `sw` content row when requested. If only English eligible content exists, the fallback helper identifies that fallback as English so UI can label it honestly.

## Member Portal Coverage

Fully localized foundation:

- Workspace title and description.
- Sidebar group labels.
- Primary navigation labels.
- Account menu labels.
- Preview banner.
- Shared workspace breadcrumbs and header labels.
- Language switcher.
- Kanisa AI Home interface.
- Command Center presentation shell.
- Common status display mappings.

RC-2.6.1 expands member-facing page chrome for the Tanzania pilot. See [Member Portal Kiswahili Completion](MEMBER_PORTAL_KISWAHILI_COMPLETION.md) for the current page-level coverage matrix and remaining body-copy debt.

RC-2.6.2 completes the scoped Catholic content surfaces for Prayer Library, Prayer Detail, Saints, Saint Detail, and Liturgical Calendar. See [Member Catholic Content Localization](MEMBER_CATHOLIC_CONTENT_LOCALIZATION.md).

RC-2.6.3 completes the scoped member parish-life surfaces for Parish Calendar, Events, Announcements, Communities, Ministries, and related Command Center shortcuts. See [Member Parish Life Localization](MEMBER_PARISH_LIFE_LOCALIZATION.md).

RC-2.7.0 stops broad localization implementation and moves the actual Member Portal into staging UAT readiness. It documents the current route inventory, missing Member experiences, mobile/accessibility risks, and executable human UAT checklist. See [Member Localization Final Audit](MEMBER_LOCALIZATION_FINAL_AUDIT.md).

Partially localized:

- Member pages that already used `useTranslation`, including existing Mass Intentions and Event Requests paths.
- Daily Readings, Prayer detail, dashboard shell, and Kanisa AI deterministic response chrome are now covered.
- Standalone Member Notifications, Member Sacramental History, Profile, and Account Settings are not complete Member routes today and should be handled as future product sprints if approved.

## Kanisa AI Coverage

Kanisa AI Home now reads interface strings from the translation files and passes the active interface language into the AI orchestrator context.

Localized areas:

- Header and description surfaces.
- Composer label, placeholder, buttons, and keyboard hint.
- Empty and loading states.
- Conversation metadata labels.
- Assistant card labels.
- Recent command labels.
- Command Center placeholder, title, description, buttons, and result empty state.

The deterministic engine remains provider-free.

## Kiswahili Intent Aliases

The intent classifier now recognizes core Kiswahili requests including:

- `masomo ya leo`
- `masomo ya dominika`
- `injili ya leo`
- `fungua biblia`
- `tafuta sala`
- `sala ya uponyaji`
- `sala ya amani`
- `matukio ya parokia`
- `kalenda ya parokia`
- `michango yangu`
- `nia za misa`
- `mtakatifu wa leo`

Member finance isolation also recognizes Kiswahili parish-wide finance phrases such as `mwenendo wa michango ya parokia` and denies them in the Member workspace.

## Navigation And Command Center

Navigation remains a single registry. Labels are translated during rendering with keys derived from group and item ids, for example:

- `navigation.groups.member-finance`
- `navigation.items.daily-readings`

Routes, feature flags, ownership, and permission filtering remain unchanged.

Command Center uses translated registry labels for display and adds common Kiswahili search aliases. Execution still runs through the AI router and workspace permission checks.

## Dates, Numbers, Currency, And Status

`src/lib/localization.ts` provides:

- `formatLocalizedDate`
- `formatLocalizedTime`
- `formatLocalizedNumber`
- `formatLocalizedCurrency`
- `getStatusLabelKey`

Statuses remain stored as stable enum strings. Display labels resolve through translation keys such as `status.published`.

## Testing

`src/test/localization-foundation.test.ts` covers:

- Member Portal Kiswahili default.
- Persisted preference override.
- English and Kiswahili key resolution.
- Missing translation fallback.
- Member navigation label resolution without route changes.
- Kiswahili Kanisa AI intent classification.
- Kiswahili member finance isolation.
- Content language preference and explicit English fallback detection.
- Status display label mapping without mutating stored values.

## Progressive Rollout Plan

Next localization migrations should replace hardcoded text inside Member Portal pages first:

1. Portal Dashboard and quick actions.
2. Bible and Daily Readings page-level UI.
3. Remaining giving and sacramental surfaces.
5. Standalone Member Notifications, Member Sacramental History, Profile, and Account Settings as future product sprints if approved.
6. Remaining browser-discovered empty/error/loading states from the RC-2.7.0 UAT defect log.
7. Administrative page-level text after shared shell patterns are stable.

## Readiness Assessment

Member Portal Tanzania pilot readiness improved materially because navigation, account access, workspace shell, Command Center, and Kanisa AI are now Kiswahili-ready and default to Kiswahili on `/portal`.

The whole application is not yet fully bilingual. Shared framework and Kanisa AI are localized; page-level operational screens remain partial translation debt.
