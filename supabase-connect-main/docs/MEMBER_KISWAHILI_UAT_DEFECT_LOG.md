# Member Kiswahili UAT Defect Log

Use this template during staging UAT. Add one row per reproducible defect.

## Severity Definitions

- BLOCKER: Prevents sign-in, workspace access, or core Member Portal navigation.
- CRITICAL: Permission leak, financial isolation failure, data exposure, destructive behavior, authentication failure, or severe core journey failure.
- MAJOR: Core workflow broken, unusable mobile page, major untranslated Member interface, incorrect content-language behavior, or normal-use defect with a workaround.
- MINOR: Small localization inconsistency, formatting issue, low-impact UX defect, or secondary empty/error/loading-state issue.
- COSMETIC: Spacing, alignment, minor visual inconsistency, or low-risk polish issue.

## Triage Rules

1. Confirm the defect is reproducible before assigning owner.
2. Confirm the active language and route.
3. Confirm whether the issue is interface localization or intentionally stored content.
4. Confirm whether the issue affects only Member workspace or leaks another workspace.
5. Confirm whether financial values, references, or member-specific data are exposed incorrectly.
6. Assign the highest applicable severity.
7. Do not classify missing standalone Member Notifications, Member Sacramental History, Profile, or Account Settings as defects unless a current route/link promises that feature and fails.

## Release Rules

- BLOCKER: zero allowed for pilot.
- CRITICAL: zero allowed for pilot.
- MAJOR: must be fixed or explicitly accepted by product/QA before pilot.
- MINOR: may be deferred with documentation.
- COSMETIC: may be deferred.

## Fix Batch Rules

- Fix one coherent defect batch at a time.
- Use `docs/MEMBER_UAT_DEFECT_FIX_PROMPT.md` for AI-assisted fixes.
- Every code fix must preserve localization architecture, workspace isolation, Member financial isolation, and content-language boundaries.
- Run `cmd /c npm run test` and `cmd /c npm run build -- --logLevel error` before retest.
- Do not run `supabase db push` for localization/UI defects.

## Defects

| Defect ID | Date | Environment | Route | Viewport/Device | Active Language | Severity | Description | Expected Result | Actual Result | Screenshot Reference | Reproducibility | Assigned Owner | Status | Fix Reference | Retest Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SW-UAT-001 |  | staging |  |  |  |  |  |  |  |  | Always / Intermittent / Once |  | Open |  |  |
