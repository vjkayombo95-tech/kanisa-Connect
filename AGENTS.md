# Kanisa Connect Engineering Agent Protocol

## Purpose

This repository permits high-autonomy AI-assisted engineering for local,
reversible development work while preserving strict human control over
remote systems, releases, destructive operations, credentials, and
production-impacting actions.

The agent should complete approved engineering goals with minimal
micromanagement.

The default local execution loop is:

inspect -> plan -> implement -> test -> diagnose -> fix -> retest ->
security/diff review -> commit -> stop at approval boundary.

Do not stop merely because the first implementation or test attempt fails.

---

## Repository Boundary

Git repository root is the directory containing this `AGENTS.md`.

Primary application working directory:

`supabase-connect-main/`

Run application package commands from that directory unless repository
evidence for the task requires another location.

Before beginning substantial implementation work, inspect relevant
repository documentation and existing implementation patterns rather than
assuming architecture.

Important documentation includes, where applicable:

- `README.md`
- `supabase-connect-main/README.md`
- `supabase-connect-main/docs/DEPLOYMENT_WORKFLOW.md`
- `supabase-connect-main/docs/BASELINE_MIGRATION_STRATEGY.md`
- `supabase-connect-main/docs/FRESH_DATABASE_MIGRATION_COMPATIBILITY.md`
- `supabase-connect-main/docs/MIGRATION_AUDIT.md`
- `supabase-connect-main/docs/MIGRATION_ARCHIVE_PLAN.md`
- `supabase-connect-main/docs/STAGING_SETUP.md`
- `supabase-connect-main/docs/STAGING_CHECKLIST.md`
- `supabase-connect-main/docs/SECURITY_ADMIN_BOOTSTRAP.md`
- `supabase-connect-main/docs/security-audit-report.md`
- `supabase-connect-main/docs/error-log-security.md`
- `supabase-connect-main/docs/operations/PRODUCTION_RELEASE_GATE.md`
- `supabase-connect-main/docs/production-launch-checklist.md`
- `.github/workflows/ci.yml`

Repository evidence overrides assumptions.

---

## Goal-Driven Autonomy

When the human gives an engineering goal, carry it through the complete
local engineering loop without requesting approval for ordinary reversible
implementation decisions.

The agent MAY autonomously:

- inspect repository files, history, tests, and documentation
- search code and configuration
- formulate an implementation plan
- create a feature branch from verified clean synchronized `main`
- edit files necessary for the approved goal
- create or update tests
- run local tests
- run TypeScript checks
- run lint
- run builds
- run local static/security diagnostics
- diagnose failures
- modify the implementation to fix failures
- repeat the test/fix cycle
- review authorization/security implications
- inspect migrations and database code locally
- create migrations locally when required by the approved goal
- run local-only database tests when the target is conclusively proven local
- inspect the final diff
- make a local feature-branch commit after Definition of Done passes
- report completion or a genuine blocker

Do not ask the human to choose between ordinary implementation details
when one option can be selected safely from repository evidence.

---

## Decision Policy

Proceed autonomously when a decision is:

1. within the approved goal,
2. reversible,
3. local-only,
4. supported by repository evidence or established engineering practice,
5. not destructive,
6. not externally consequential,
7. and does not cross an approval boundary below.

Choose the smallest safe change that satisfies the goal.

Ask the human only when:

- product requirements materially change,
- multiple choices have materially different user/business consequences,
- the required action is destructive,
- the action affects an external or remote system,
- credentials/secrets are involved,
- a security-sensitive decision cannot be resolved from repository evidence,
- or an explicit approval boundary is reached.

Migrations, authentication, authorization, RLS, SECURITY DEFINER functions,
and service-role paths require explicit security review even when developed
locally.

---

## Mandatory Human Approval Boundaries

STOP and request explicit human approval BEFORE performing any of the
following:

### Git / Remote Repository

- push any branch
- push directly to `main`
- open a pull request
- merge a pull request
- delete a remote branch
- create/publish a release or tag
- force push
- rewrite shared history

Direct pushes to `main` are prohibited unless the human explicitly defines
an exceptional recovery procedure.

### Staging

- write to the Staging database
- apply a Staging migration
- seed or mutate Staging data
- repair Staging migration history
- use service-role credentials against Staging
- change Staging infrastructure/configuration

### Production

- write to the Production database
- apply a Production migration
- seed or mutate Production data
- repair Production migration history
- use service-role credentials against Production
- modify Production infrastructure/configuration
- trigger a Production release/deployment manually
- delete or alter Production user/content data

### Credentials / External Systems

- create, rotate, reveal, copy, or modify secrets
- change environment credentials
- expose service-role credentials
- publish data/content to an external service
- perform externally consequential API writes
- modify billing/payment configuration

### Destructive Operations

- `git reset --hard`
- force checkout that discards work
- deleting unknown/unrelated files
- cleaning another worktree
- destructive filesystem cleanup
- dropping/truncating tables
- bulk deleting data
- irreversible migration actions
- rewriting migration history

If approval is required, stop at the boundary and state the exact proposed
action, target, reason, and risk.

Approval for one action does not imply approval for later actions.

---

## Git Workflow

For normal feature work:

1. verify repository state
2. ensure worktree is clean or understand pre-existing changes
3. synchronize/verify `main` when the task requires a fresh branch
4. create a narrowly named feature branch
5. implement the approved goal
6. test and fix until gates pass
7. review the complete diff
8. commit locally on the feature branch
9. STOP before push and request approval

Never silently discard pre-existing user work.

Never clean, stash, reset, overwrite, or revert unrelated changes merely to
obtain a clean worktree.

If unexpected user changes make the task unsafe, stop and report them.

---

## Supabase and Database Safety

Treat database target identity as a security boundary.

Known project references:

Staging:
`nunfrjcuimaytydnaqtt`

Production:
`cbaxiiqlzrwvmuplhusm`

Never infer database safety merely from the current directory, CLI login,
environment name, or command history.

Before any approved remote database operation, verify all relevant target
signals, including:

- intended environment
- project reference
- database URL/environment variable being used
- Supabase CLI linked project when relevant
- exact migration/command being executed

If target signals disagree or are ambiguous:
STOP.

The Supabase CLI link may point at a different environment from the one
intended for a task. Never casually relink projects.

### Remote database rules

Remote Staging and Production writes always require human approval.

Never use:

`supabase db push --include-all`

by default.

It is prohibited unless the human explicitly approves a documented
migration-recovery procedure that requires it.

Do not repair remote migration history automatically.

Direct SQL migration application and migration-ledger repair are separate
consequential actions and require appropriate approval.

Do not assume application deployment means database migrations were
applied.

### Local database

Local database operations may run autonomously only when the target is
conclusively proven local.

Before local DB writes, verify the target is local and cannot resolve to
Staging or Production.

Do not use remote credentials for local testing.

Test fixtures must be bounded and cleaned up or transactionally rolled
back.

---

## Service Role and Secrets

Service-role credentials must never be:

- placed in frontend code
- exposed through `VITE_*`
- logged
- committed
- pasted into reports
- embedded in fixtures

Service-role operations against remote systems require human approval.

Use least privilege.

Do not print secrets while verifying configuration.

If a secret appears in repository changes, stop and classify it as a
security issue.

---

## Security and Multi-Tenancy

Kanisa Connect is multi-tenant.

For changes involving tenant data, authentication, permissions, RLS,
SECURITY DEFINER functions, RPCs, admin operations, church roles, or global
content:

explicitly review:

- caller identity
- tenant/church isolation
- cross-tenant access
- anonymous access
- authenticated member access
- church-staff access
- super-admin access
- least privilege
- search_path for SECURITY DEFINER functions
- grants/revokes
- RLS policy interactions
- direct-table bypasses around RPC boundaries

Do not treat frontend hiding as authorization.

Authorization must be enforced at the trusted backend/database boundary
where appropriate.

---

## Migration Discipline

When a goal requires a migration:

- inspect existing schema and migration history first
- create the smallest forward-only migration
- preserve historical compatibility unless the goal explicitly requires a
  breaking change
- review RLS, grants, constraints, indexes, functions, triggers, and
  rollback/recovery implications
- add focused regression tests where practical
- test locally when a conclusively local database is available
- never apply remotely without approval

Do not modify old applied migrations merely to change live behavior unless
a documented recovery/baseline procedure explicitly requires it.

---

## Failure Loop

The agent owns ordinary local failures.

If a test, typecheck, lint, build, or local runtime check fails:

1. inspect the actual failure
2. identify the root cause
3. determine whether it was introduced by the current task
4. fix it when within scope
5. rerun the relevant gate
6. repeat until resolved

Do not return to the human after every ordinary test failure.

Stop only when:

- Definition of Done passes,
- a genuine external blocker prevents progress,
- required information cannot be derived safely,
- continuing requires crossing an approval boundary,
- continuing would require destructive action,
- or a material product/security decision requires human judgment.

If a failure is clearly pre-existing and unrelated, prove that distinction
and report it rather than expanding scope indefinitely.

---

## Scope Control

Prefer the smallest coherent implementation that satisfies the approved
goal.

Do not opportunistically refactor unrelated code.

Do not add dependencies unless justified.

Do not change product behavior outside the goal merely because an
alternative design seems cleaner.

Do not implement deferred features unless they become necessary for the
approved goal.

Preserve existing contracts unless the goal explicitly changes them.

---

## Testing and Validation

Determine relevant gates from repository CI and the affected area.

From `supabase-connect-main/`, common gates include where applicable:

`npx tsc --noEmit`

`npm run lint`

`npm test -- --no-file-parallelism --reporter=dot`

`npm run build`

Also run focused tests for the changed area.

Do not blindly run expensive unrelated suites when a narrower validated
gate is sufficient, but before Definition of Done ensure CI-relevant
coverage is adequate for the change.

Always run:

`git diff --check`

before final local completion.

Warnings must be distinguished from failures.

Do not claim PASS for a command that did not actually complete
successfully.

---

## Definition of Done

A local engineering goal is DONE only when all applicable conditions are
satisfied:

- requested goal is implemented
- behavior matches the approved contract
- relevant focused tests pass
- relevant regression tests pass
- TypeScript passes where applicable
- lint passes where applicable
- build passes where applicable
- database runtime verification passes where applicable
- security/authorization implications are reviewed
- migration implications are reviewed where applicable
- no unrelated changes are included
- no secrets are introduced
- no temporary/debug artifacts remain
- `git diff --check` passes
- complete final diff has been reviewed
- feature branch is committed locally
- resulting commit SHA is reported
- worktree state is reported
- no remote action was performed without explicit approval

If an applicable gate cannot run, report it explicitly and explain why.
Do not silently redefine DONE.

---

## Completion States

End autonomous work in exactly one conceptual state:

### DONE - AWAITING REMOTE APPROVAL

Local implementation and applicable Definition of Done gates passed.
Feature branch is committed locally.
No remote action has been taken.

Report:

- goal
- branch
- base
- commit SHA
- changed files
- tests/gates
- security review
- DB/migration status
- P0/P1/P2 findings
- worktree status
- exact next approval-gated action

### BLOCKED - HUMAN DECISION REQUIRED

Use when a material requirement, security decision, or product decision
cannot safely be inferred.

Report one concise decision request with options and consequences.

### BLOCKED - EXTERNAL/ENVIRONMENT

Use when credentials, unavailable infrastructure, third-party systems, or
other external conditions prevent completion.

### STOPPED - APPROVAL BOUNDARY

Use when local work is complete up to an action that requires approval.

Never represent approval-gated remote work as already completed.

---

## Reporting Severity

Use:

P0 - critical security/data-loss/release-blocking issue

P1 - significant correctness/security/reliability issue that should block
completion

P2 - non-blocking improvement, cleanup, or additional coverage

P2 findings do not automatically block completion unless the approved goal
requires them.

---

## Documentation Discipline

Keep this file focused on stable engineering policy.

Do not continuously add feature-specific state, current commit SHAs,
temporary migration lists, or active wave status to `AGENTS.md`.

Changing project state belongs in task briefs, release documents, or
dedicated project documentation.

If this policy itself needs material weakening, especially around remote
writes, production, destructive operations, or credentials, require human
approval.
