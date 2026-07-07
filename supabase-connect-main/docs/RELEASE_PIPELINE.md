# Release Pipeline

## Branch Strategy

Recommended:

- `main`: production-ready releases only.
- `staging`: integrated release candidate branch.
- `feature/*`: scoped feature or fix branches.
- `hotfix/*`: urgent production fixes.
- `release/*`: release stabilization branches when needed.

## Release Flow

1. Merge feature/fix work into `staging`.
2. Run tests and build.
3. Complete release checklist.
4. Deploy staging.
5. Run UAT and smoke tests.
6. Create release tag from approved commit.
7. Deploy production.
8. Monitor after deployment.

## Version Tagging

Pilot tag:

```text
v1.0.0-PILOT
```

Patch tags:

```text
v1.0.1
v1.0.2
```

Use annotated tags when possible and link release notes.

## Hotfix Flow

1. Branch from production tag or `main`.
2. Apply minimal fix.
3. Run tests and build.
4. Deploy to staging if time permits.
5. Deploy production.
6. Merge back into `main` and `staging`.

## Rollback Strategy

Frontend:

- Redeploy the last known good artifact.
- Keep environment variables unchanged.
- Smoke test login and dashboards.

Database:

- Prefer forward fixes.
- Take fresh backup before emergency changes.
- Restore in recovery project first where possible.

## Required Gates

- Tests pass.
- Build passes.
- Release checklist complete.
- Known issues accepted.
- Rollback artifact identified.
- Production monitoring owner assigned.
