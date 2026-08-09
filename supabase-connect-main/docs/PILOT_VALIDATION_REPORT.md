# Pilot Validation Report

## Summary

RC-35.0 validated the pilot-readiness surface after the Workspace Framework migration. The sprint stayed within quality, usability, navigation, consistency, and production-readiness scope.

No database schema, Supabase architecture, authentication, payments, automation, Bible data, liturgical data, importer, or AI provider integration was changed.

## Workflows Validated

### Member

- Registration, login, forgot password routes remain available.
- Member workspace routes stay under `/portal/*`.
- Dashboard, Bible, Bible search, today's readings, saints, liturgical calendar, prayer requests, Mass intentions, giving, contribution history, announcements, Kanisa AI, and calendar navigation were reviewed through route ownership and workspace registry checks.

### Pastoral

- Dashboard and child pages now share the Pastoral workspace shell.
- Prayer Requests, Mass Intentions, Calendar, Daily Readings, Bible, Saints, Announcements, Events, and Kanisa AI remain under `/pastoral/*`.
- Sidebar and header ownership are unified through `WorkspaceRouteLayout`.

### Church Admin

- Dashboard, Members, Invitations/Roles, Attendance, Communities, Ministries, Events, Calendar, Reports, Finance, Bible, Saints, Daily Readings, Settings, and Kanisa AI are routed through the Church Admin workspace shell.
- Legacy Church Admin layout and sidebar were removed in the previous unification pass and remain absent from active routing.

### Finance

- Dashboard and child pages now share the Finance workspace shell.
- Contributions, Receipts, Pledges, Reports, Finance Intelligence, Calendar, Bible, Saints, Daily Readings, Exports, Audit Logs, Settings, and Kanisa AI remain under `/finance/*`.

### Super Admin

- Dashboard, Churches, Subscriptions, Billing Verification, Record Preservation, Features, Revenue, Logs, Audit Logs, System Logs, Platform Health, Jobs, Catholic Content, Imports, Activity, Settings, and Kanisa AI route through the Super Admin workspace shell.
- Super Admin legacy layout and sidebar remain removed from active routing.

## Issues Discovered And Fixed

### Medium: Bible Reference Detection Was Inconsistent Outside The Bible Page

The Bible page parser already normalized most whitespace variants, but the Command Center and AI intent classifier used stricter reference detection. That meant a reference such as `Matthew 3 : 16 - 17` could parse correctly in Bible search but fail to classify consistently as scripture elsewhere.

Fix applied:

- Added shared `looksLikeBibleReference` helper in `src/lib/bible-reference-parser.ts`.
- Reused that helper in `src/lib/ai/intent.ts`.
- Reused the same normalization in `src/components/ai/KanisaCommandCenter.tsx`.
- Added regression coverage for all required Bible reference variants.

Validated variants:

- `Matthew 3:16`
- `Matthew 3 : 16`
- `Matthew 3:16-17`
- `Matthew 3 : 16 - 17`
- `Mathayo 3:16`
- `Mathayo 3 : 16`
- `Mt 3:16`
- `MATTHEW 3:16`
- `matthew 3:16`
- leading spaces
- trailing spaces
- multiple spaces
- tabs
- mixed whitespace

## Workspace Validation

Confirmed by source audit:

- Primary authenticated workspace routes use `WorkspaceRouteLayout`.
- `WorkspaceLayout` owns the shared shell.
- `WorkspaceNavigation` owns primary sidebar rendering.
- `WorkspaceRenderer` avoids nested shells when dashboard components render inside an existing workspace context.
- Development diagnostics identify current workspace, layout, sidebar, and mounted workspace ID.
- Legacy `ChurchAdminLayout`, `PortalLayout`, `SuperAdminLayout`, `ChurchAdminSidebar`, and `SuperAdminSidebar` are absent from active route imports.

Documented exception:

- `CommunityLeaderLayout` remains active for staff/community-leader routes because those pages depend on its outlet context. It is documented as remaining legacy debt in `docs/WORKSPACE_UNIFICATION.md`.

## UX Improvements

- Bible and Command Center reference handling now responds consistently to parishioner-style input, including extra spaces and mixed casing.
- Scripture commands now display normalized references, reducing visual noise in command results.
- Workspace route ownership remains consistent, reducing unexpected layout changes during navigation.

## Accessibility Notes

- Workspace shell keeps skip-to-content support.
- Command Center and Bible reference search improvements reduce keyboard-entry fragility.
- Remaining pilot audit should include browser-based keyboard traversal for high-use forms and tables.

## Performance Notes

- No new queries were introduced.
- No data-loading logic was duplicated.
- Bible reference detection is pure local normalization.
- Workspace shell reuse from RC-34.1 remains intact.

## Verification

- `npm run test`: passed outside sandbox after sandbox blocked Vitest config loading.
- `npm run build`: passed.

Build warnings observed:

- Browserslist data is stale.
- Existing large production chunks remain above 500 kB, especially PDF/chart/export-related vendor bundles.

## Remaining Recommendations

- Add a dedicated Community Leader workspace registry entry or migrate those routes into an existing owned workspace.
- Add browser smoke tests for deep links across all five primary workspaces.
- Add Playwright checks for one sidebar/header/assistant instance after workspace navigation.
- Review large vendor chunks after pilot stabilization, especially PDF, chart, XLSX, and scanner bundles.
- Continue empty-state and mobile table audits with real parish test data.

## Overall Readiness Score

88 / 100

Kanisa Connect is suitable for controlled parish pilot deployment. The main product risk is no longer core architecture; it is final field validation with real users, real church data, and role-specific browser smoke tests.
