# Release Checklist

Use this checklist before tagging or deploying Kanisa Connect v1.0.0 Pilot Edition.

## Build And Tests

- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] No unexpected console errors in pilot smoke testing.
- [ ] Build warnings are reviewed and accepted.

## Workspace Validation

- [ ] Member opens `/portal`.
- [ ] Pastoral opens `/pastoral`.
- [ ] Church Admin opens `/church-admin`.
- [ ] Finance opens `/finance`.
- [ ] Super Admin opens `/super-admin`.
- [ ] Exactly one workspace shell is mounted.
- [ ] Exactly one sidebar is active.
- [ ] Breadcrumbs and active sidebar state are correct.
- [ ] Browser refresh works on deep links.

## Performance Validation

- [ ] Dashboard loading is stable.
- [ ] Bible search is responsive.
- [ ] Reports and exports are acceptable for pilot scale.
- [ ] Large vendor chunk warnings are accepted for v1.0.0 Pilot.
- [ ] No obvious duplicate requests are visible during smoke testing.

## Security Validation

- [ ] Supabase project reference is correct.
- [ ] No service role key is exposed to the frontend.
- [ ] RLS policies are enabled.
- [ ] Storage policies are verified.
- [ ] Role assignments are verified.
- [ ] Cross-role access checks are completed.

## Accessibility Validation

- [ ] Keyboard navigation works for critical flows.
- [ ] Focus indicators are visible.
- [ ] Dialog focus trapping is acceptable.
- [ ] Mobile touch targets are usable.
- [ ] Critical forms have labels.

## Pilot Validation

- [ ] Member daily workflow passes.
- [ ] Priest daily workflow passes.
- [ ] Church Admin daily workflow passes.
- [ ] Finance daily workflow passes.
- [ ] Super Admin daily workflow passes.
- [ ] Bible search variants pass.
- [ ] No critical pilot blockers remain.

## Production Polish

- [ ] Loading states are acceptable.
- [ ] Empty states are useful.
- [ ] Error messages are friendly.
- [ ] Success feedback is clear.
- [ ] Mobile layouts are acceptable.
- [ ] Known limitations are documented.

## Documentation Complete

- [ ] Pilot Playbook.
- [ ] Release Notes.
- [ ] Known Issues.
- [ ] Roadmap.
- [ ] Backlog.
- [ ] Architecture Decisions.
- [ ] Support Guide.
- [ ] Operations Checklist.
- [ ] Documentation Index.

## Release Tag Preparation

- [ ] Confirm branch is `staging`.
- [ ] Confirm final commit hash.
- [ ] Create release tag `v1.0.0-PILOT`.
- [ ] Publish release notes.
- [ ] Deploy production artifact.
- [ ] Run production smoke tests.
- [ ] Confirm rollback plan.
