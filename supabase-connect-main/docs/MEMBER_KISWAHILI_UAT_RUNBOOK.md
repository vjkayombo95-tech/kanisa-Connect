# Member Kiswahili UAT Runbook

RC-2.7.1 prepares a disciplined human staging UAT session for the current Member Portal. It does not create missing Member features, seed data, apply migrations, or run `supabase db push`.

## A. Pre-UAT Checks

1. Confirm staging URL.
   - Use the staging frontend deployment, not production.
   - Confirm the red `STAGING - TEST DATA ONLY` banner appears.

2. Confirm staging project identity.
   - The expected staging project ref is configured through `VITE_EXPECTED_SUPABASE_PROJECT_REF`.
   - Confirm the frontend env points to the staging Supabase URL.
   - Do not expose or paste service-role keys in test notes.

3. Confirm Member test account.
   - Use the Member UAT account from the staging bootstrap report or QA credential handoff.
   - Confirm it is linked to the Demo Catholic Parish or the chosen test parish.

4. Confirm required staging data.
   - Review `docs/MEMBER_KISWAHILI_UAT_DATA_MATRIX.md`.
   - Confirm the latest approved staging bootstrap has run after RC-2.7.2 if populated Prayer Library, Daily Readings, Pledges, Ministries, Channels, Prayer Requests, or Mass Intentions are required.
   - If data is missing, decide whether to test the empty state or pause for an approved bootstrap/data-prep run.

5. Confirm latest staging frontend deployment.
   - Build source must include RC-2.6.x and RC-2.7.x localization changes.
   - Deployment should be from the `staging` branch or the agreed staging deploy context.

6. Confirm browser/device setup.
   - Desktop browser with DevTools available.
   - Mobile viewport/device for critical mobile checks.
   - Screenshot capture available.

## B. Desktop Test Session

Run this sequence in order and record results in `docs/MEMBER_KISWAHILI_UAT_DEFECT_LOG.md`.

1. Sign in.
2. Confirm Member workspace.
3. Switch to Kiswahili.
4. Refresh.
5. Verify language persistence.
6. Dashboard.
7. Kanisa AI.
8. Command Center.
9. Bible.
10. Daily Readings.
    - Confirm the staging UAT reading for today appears if `content_daily_readings` exists.
11. Prayer Library.
    - Confirm `Sala ya Asubuhi ya UAT` appears if CMS prayer tables exist.
12. Prayer Detail.
13. Saints.
14. Saint Detail.
15. Liturgical Calendar.
16. Parish Calendar.
17. Events.
18. Announcements.
19. Communities/Channels.
    - Confirm `UAT St. Monica Community Channel` and its starter message appear if chat tables exist.
20. Ministries.
    - Confirm `UAT Choir Ministry` appears if ministry tables exist.
21. Prayer Requests.
    - Confirm the seeded approved prayer request is visible to the member.
22. Mass Intentions.
    - Confirm the seeded pending Mass intention appears under the member's intentions.
23. Giving.
24. Contribution History.
25. Contribution Receipt.
26. Pledges.
    - Confirm the seeded partial pledge is visible if pledge tables/RPCs are available.
27. Account menu.
28. Switch to English.
29. Refresh.
30. Switch back to Kiswahili.
31. Sign out.
32. Sign in again.

Expected results:

- Member routes remain inside `/portal`.
- No Church Admin, Finance, Pastoral, or Super Admin navigation appears.
- Interface labels switch language.
- Stored data remains unchanged and is not automatically translated.
- Financial values, transaction references, receipt identifiers, and user-entered text remain exact.

## C. Mobile Test Session

Repeat the critical flows on mobile viewport/device. Prioritize:

- Navigation drawer.
- Account menu.
- Language switcher.
- Dashboard.
- Kanisa AI composer.
- Command Center.
- Bible reader.
- Prayer Library.
- Calendar and Events.
- Communities/Channels.
- Giving forms.
- Contribution History.
- Receipt view.
- Pledge dialogs.

Record any horizontal overflow, clipped buttons, unusable dialogs, focus traps, or inaccessible menu actions.

## D. Defect Capture

For every defect, record:

- Defect ID.
- Route.
- Screenshot reference.
- Active language.
- Desktop/mobile.
- Viewport/device.
- Steps to reproduce.
- Expected result.
- Actual result.
- Severity.
- Reproducibility.

Use the severity definitions and release rules in `docs/MEMBER_KISWAHILI_UAT_DEFECT_LOG.md`.

## E. Retest Process

1. Group defects into one coherent fix batch.
2. Fix only the supplied defects.
3. Add regression tests where the defect can be automated.
4. Run targeted tests when available.
5. Run `cmd /c npm run test`.
6. Run `cmd /c npm run build -- --logLevel error`.
7. Redeploy staging.
8. Retest the exact defect steps.
9. Update defect status and retest result.

Do not run `supabase db push` unless a separate approved database task explicitly requires it.
