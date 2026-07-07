# Member UAT Defect Fix Prompt Template

Use this prompt for a focused VS Code AI defect-fix session after human staging UAT records defects.

```text
Fix the following Member Kiswahili staging UAT defects only.

Defect IDs:
- <DEFECT-ID-1>
- <DEFECT-ID-2>

Screenshots / observations:
- <paste screenshot references or observations>

Affected routes:
- <route>

Expected behavior:
<describe expected result>

Actual behavior:
<describe actual result>

Instructions:

1. Inspect the affected routes/components and identify the exact root cause.
2. Fix only the supplied defects.
3. Do not add unrelated features.
4. Do not redesign pages.
5. Do not add schema, migrations, RLS changes, payment changes, authentication changes, or Supabase changes.
6. Do not run supabase db push.
7. Preserve the existing localization architecture:
   - src/i18n.ts
   - src/lib/localization.ts
   - src/locales/en.json
   - src/locales/sw.json
8. Preserve workspace isolation.
9. Preserve Member financial isolation.
10. Preserve content-language boundaries:
    - Do not automatically translate Bible text, CMS content, parish-authored content, user-entered text, payment references, certificate numbers, or stored identifiers.
11. Add targeted regression tests where the defect can be automated.
12. Run:
    cmd /c npm run test
    cmd /c npm run build -- --logLevel error
13. Report:
    - exact files changed
    - exact defects fixed
    - tests added/updated
    - test result
    - build result
    - whether supabase db push was run
    - remaining risks
    - retest steps for the human tester
```
