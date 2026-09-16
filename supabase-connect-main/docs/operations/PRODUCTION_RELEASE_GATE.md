# Production release gate

Every production release must be traceable to a reviewed commit on `main`.
The required GitHub check is the **Build and validate** job from `.github/workflows/ci.yml`.

## Pre-merge

1. Confirm the pull request targets `main` and has an approved review.
2. Confirm **Build and validate** passed for the exact pull-request head SHA.
3. Confirm the pull request contains no pending migration unless that migration has a separate approval and rollout plan.
4. Confirm no environment file, credential, fixture output, or generated artifact is included.

## Automated CI

The **Build and validate** job runs without Supabase credentials, service-role keys, deployment tokens, or database access.

Required checks:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test:ci`
- `npm run build`
- `git diff --check` and a clean checkout sanity check

Run `npm run verify` locally before opening a pull request when practical.

`npm run test:ci` runs the stable Vitest suite and explicitly leaves out only `src/test/production-dashboard-mobile-responsive-browser.test.tsx`. That real-browser responsive test currently has a known afterAll browser cleanup timeout even when its assertions pass. Wave 19 Slice 2 owns stabilizing that test and returning it to the required CI gate. To run it manually, use `npm run test:browser-responsive`.

## Post-merge and deployment provenance

1. Record the resulting `main` SHA.
2. Verify the hosting provider deployment reports that exact SHA; do not infer it from deployment time alone.
3. Record the provider, deployment identifier, deployed SHA, operator, and timestamp in the release record.
4. Run the bounded production smoke checks for login, member navigation, tenant isolation, and any changed workflow.
5. Record the smoke result and any console, routing, RPC, or chunk errors.

## Rollback trigger

Start the approved provider rollback procedure when any of these occurs:

- production smoke fails;
- a severe error regression appears;
- a security or tenant-isolation regression is suspected;
- the deployed SHA differs from the approved `main` SHA.

Do not improvise database rollback. Database or migration recovery requires its own approved plan.

## Required GitHub configuration

Repository code cannot enforce branch protection. Configure `main` manually to:

- require a pull request before merging;
- require the **Build and validate** status check;
- require the branch to be up to date when concurrent main changes could invalidate review;
- prevent force pushes;
- prevent branch deletion.

GitHub-hosted CI performs validation only. It receives no Supabase credentials and does not deploy or mutate staging or production.
