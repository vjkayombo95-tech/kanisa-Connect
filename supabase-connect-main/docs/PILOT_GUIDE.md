# Pilot Guide

This guide describes how to run a controlled Version 1.0 RC1 parish pilot.

## Pilot Objectives

The pilot should verify that Kanisa Connect can support real parish activity safely and reliably:

- Members can access parish content and giving workflows.
- Parish teams can manage members, events, announcements, workflows, and finance.
- Role-based workspaces make sense to users.
- Contributions, receipts, and reports are operationally usable.
- Calendar and workflow integrations are understandable.
- Low-bandwidth/mobile behavior is acceptable.
- Operational support can triage issues quickly.

## Recommended Pilot Duration

Recommended duration: 2 to 4 weeks.

Suggested phases:

1. Week 0: Setup, training, role assignment, and seed data validation.
2. Week 1: Member dashboard, announcements, events, calendar, and content.
3. Week 2: Giving, receipts, finance, reports, and pledges.
4. Week 3-4: Pastoral workflows, Community Help, Mass Intentions, and operational monitoring.

## Pilot Roles

Include at minimum:

- 5 to 20 members.
- 1 priest or pastoral lead.
- 1 church admin/secretary.
- 1 finance/treasurer user.
- 1 super admin/platform operator.
- 1 support owner for issue triage.

Each tester should record device, browser, network quality, role, and route when reporting issues.

## Success Criteria

Pilot is successful when:

- Users can sign in and reach the correct workspace.
- Member dashboard loads progressively.
- Giving flow completes and receipt page works.
- Contribution history filters and receipt actions work.
- Admin can manage members, announcements, events, and settings.
- Finance can review contributions, receipts, reports, and dashboard summaries.
- Pastoral workflows load and update expected states.
- Calendar views and filters are usable on mobile and desktop.
- No cross-tenant data exposure occurs.
- No unrecoverable operational incident occurs.
- Support can resolve or classify reported issues within agreed response windows.

## Feedback Collection

Collect:

- Task success/failure.
- Confusing labels or navigation.
- Slow screens.
- Mobile layout issues.
- Accessibility issues.
- Missing empty/error states.
- Finance/report mismatches.
- Receipt or payment reference issues.
- Any privacy concern.

Recommended feedback template:

```text
Role:
Device:
Browser:
Network:
Route:
What I tried:
What happened:
What I expected:
Screenshot/video:
Severity: Low / Medium / High / Critical
```

## Issue Reporting

Severity definitions:

- Critical: security exposure, data loss, payment/receipt corruption, or login outage.
- High: core pilot workflow blocked.
- Medium: workaround exists but workflow is degraded.
- Low: copy, polish, minor layout, or non-blocking issue.

Triage rules:

- Critical issues pause the pilot until resolved or mitigated.
- High issues require same-day review.
- Medium issues enter the pilot backlog.
- Low issues are grouped for post-pilot polish.

## Rollback Plan

Before pilot starts:

- Identify previous stable frontend artifact.
- Confirm database backup.
- Confirm storage backup/export path.
- Confirm production environment variable snapshot.
- Assign rollback decision owner.

Rollback triggers:

- Authentication outage.
- Cross-tenant data access.
- Receipt/privacy breach.
- Payment/contribution data corruption.
- Severe performance outage across pilot users.

Rollback steps:

1. Freeze new deploys.
2. Preserve logs and screenshots.
3. Redeploy last known good frontend artifact.
4. If data is affected, follow `docs/BACKUP_AND_RECOVERY.md`.
5. Smoke test login, dashboard, giving, receipts, admin, and finance.
6. Communicate status to pilot stakeholders.

## Pilot Exit Review

At the end of the pilot, review:

- UAT checklist completion.
- Issue count by severity.
- Security findings.
- Performance feedback.
- Accessibility feedback.
- Operational support burden.
- Parish satisfaction.
- Version 1.1 backlog.
