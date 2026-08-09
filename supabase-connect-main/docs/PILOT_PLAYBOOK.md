# Pilot Playbook

## Overview

Kanisa Connect Version 1.0 Pilot Edition is intended to validate daily parish operations with a real parish before wider release.

Pilot goals:

- Confirm that members, priests, church administrators, finance officers, and platform administrators can complete their daily workflows.
- Validate workspace routing, permissions, dashboards, Bible search, Catholic content, parish communication, finance operations, and support readiness.
- Gather usability feedback from real parish staff and parishioners.
- Identify critical launch defects before broader rollout.

Expected duration: 4 to 8 weeks.

Success criteria:

- Users complete core daily workflows without assistance.
- No critical bugs remain open.
- Performance is stable during parish usage.
- Parish staff report that workflows are clear and practical.
- Pilot stakeholders accept known limitations.

Pilot scope:

- One or a small number of churches.
- Member portal, pastoral workspace, church admin workspace, finance workspace, and super admin workspace.
- Existing Version 1.0 functionality only.

## Before Pilot

Deployment checklist:

- Confirm production frontend deployment and rollback artifact.
- Confirm Supabase project reference and environment variables.
- Confirm TLS, domain, and route refresh behavior.
- Run `npm run test`.
- Run `npm run build`.

Environment verification:

- Production environment variables match `docs/PRODUCTION_CONFIGURATION.md`.
- No service role key is exposed to the frontend.
- Staging and production projects are clearly separated.

Database verification:

- Migrations are applied.
- RLS policies are enabled and reviewed.
- Church-scoped role RPCs are deployed.
- Backups are enabled and restorable.

Email verification:

- Invitation email sending works.
- Password reset email works.
- Sender name and reply-to are appropriate for pilot support.

Storage verification:

- Church assets bucket works.
- Avatar uploads work.
- Billing receipt storage works if enabled.
- Catholic content storage is available if used.

Role verification:

- Member opens `/portal`.
- Priest opens `/pastoral`.
- Church admin opens `/church-admin`.
- Finance officer opens `/finance`.
- Super admin opens `/super-admin`.
- No role can access another workspace by navigation.

Sample data:

- One church.
- One priest.
- One church admin.
- One finance officer.
- Several members.
- A few announcements, events, prayer requests, Mass intentions, contributions, and calendar entries.

Performance verification:

- Dashboard load feels stable on desktop and mobile.
- Bible search handles whitespace and common book aliases.
- Large reports and exports are acceptable for pilot scale.

Backup verification:

- Database backup is enabled.
- Storage backup approach is documented.
- Rollback process is understood.

## Parish Onboarding

1. Create Church.
2. Invite Priest.
3. Invite Church Admin.
4. Invite Finance Officer.
5. Invite Members.
6. Import Catholic Content.
7. Verify Calendar.
8. Verify Bible.
9. Verify Daily Readings.
10. Verify Saints.

## Daily Activities

Member:

- Review the dashboard.
- Read today's readings or Bible passage.
- Submit prayer requests.
- Request Mass intentions.
- View announcements and calendar.
- Give or review contribution history where enabled.

Priest:

- Review today's ministry dashboard.
- Review prayer requests.
- Review and schedule Mass intentions.
- Check calendar and announcements.
- Read daily readings for pastoral preparation.

Church Admin:

- Review dashboard priorities.
- Manage members and invitations.
- Publish announcements.
- Maintain events, calendar, communities, ministries, and attendance.
- Review reports and settings.

Finance:

- Review finance dashboard.
- Record and reconcile contributions.
- Review pledges and receipts.
- Prepare reports.
- Monitor finance intelligence.

Super Admin:

- Monitor platform dashboard.
- Review churches and onboarding status.
- Check platform health, jobs, logs, and Catholic content.
- Support parish issues.

## Weekly Review

Ask the parish:

- What worked?
- What confused users?
- What features were missing?
- Which workflows took too long?
- Were any permissions surprising?
- Did any page feel unfinished?
- Did mobile use feel reliable?

## Success Metrics

- Daily active users.
- Weekly active users.
- Prayer requests submitted and completed.
- Mass intentions requested and scheduled.
- Contributions recorded.
- Attendance records captured.
- Announcements published.
- Events created and viewed.
- Bible usage.
- Daily readings usage.
- Calendar usage.
- Assistant usage.

## Exit Criteria

The pilot is considered successful if:

- Users complete daily workflows.
- No critical bugs remain.
- Feedback is positive enough to continue rollout.
- Performance is stable.
- Known limitations are accepted or scheduled.
