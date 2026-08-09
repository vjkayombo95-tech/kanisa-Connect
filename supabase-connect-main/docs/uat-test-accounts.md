# Multi-role authorization UAT accounts

## Scope and safety

These accounts are staging-only fixtures created by `npm run uat:seed`. The command requires the `staging` Git branch, the known linked Kanisa Connect staging project, a matching staging Supabase URL, a server-side service-role key, and an anon key for authenticated verification. It aborts if any guard fails.

Passwords are never stored in this document or tracked source. They are read from `UAT_TEST_PASSWORD` or generated once in the ignored local file `evaluation/uat/.uat-credentials.local.json`.

The bootstrap uses Supabase Auth Admin APIs to confirm accounts automatically. Database fixture records are written with the service-role client because the normal role-management RPC correctly requires a signed-in Church Admin. Direct writes are restricted to reserved UAT churches and the exact persona email list.

## Dedicated churches

| Church | Slug | Subscription | Purpose |
| --- | --- | --- | --- |
| Kanisa Connect UAT Parish | `kanisa-connect-uat` | Pro trial, at least 30 days remaining | Primary single-role and multi-role testing |
| Kanisa Connect UAT Expired Parish | `kanisa-connect-uat-expired` | Pro trial with an expiry date in the past | Subscription enforcement |
| Kanisa Connect UAT Other Parish | `kanisa-connect-uat-other` | Pro trial, at least 30 days remaining | Cross-tenant isolation |

All catalog features receive explicit church-feature rows. Role permission rows are populated from the reviewed `recommended_church_feature_permission()` behavior introduced by `20260721130000_harden_tenant_feature_permissions.sql`; the UAT bootstrap does not create a broader permission model.

## Personas

| Persona | Email | Roles | Expected workspace | Expected access |
| --- | --- | --- | --- | --- |
| Church Admin only | `uat.admin@kanisaconnect.test` | Church Admin | Church Operations | Church Admin grants |
| Pastor only | `uat.pastor@kanisaconnect.test` | Pastor | Pastoral Workspace | Pastor grants |
| Secretary only | `uat.secretary@kanisaconnect.test` | Secretary | Church Operations | Secretary grants |
| Treasurer only | `uat.treasurer@kanisaconnect.test` | Treasurer | Finance Workspace | Treasurer grants |
| Church Admin + Pastor | `uat.admin-pastor@kanisaconnect.test` | Church Admin, Pastor | Church Operations | Union of both roles |
| Pastor + Treasurer | `uat.pastor-treasurer@kanisaconnect.test` | Pastor, Treasurer | Pastoral Workspace | Union of both roles |
| Secretary + Treasurer | `uat.secretary-treasurer@kanisaconnect.test` | Secretary, Treasurer | Church Operations | Union of both roles |
| Admin + Pastor + Treasurer | `uat.multi-role@kanisaconnect.test` | Church Admin, Pastor, Treasurer | Church Operations | Union of all three roles |
| Member only | `uat.member@kanisaconnect.test` | Member | Member Portal | Member/self-service grants |
| No staff role | `uat.no-role@kanisaconnect.test` | No `user_roles` row; active membership | Member Portal | Member access only, no staff access |
| Expired subscription admin | `uat.expired-admin@kanisaconnect.test` | Church Admin | Church Operations shell | Subscription-gated features denied |
| Other church admin | `uat.other-church-admin@kanisaconnect.test` | Church Admin in the other UAT parish | Church Operations | Other parish allowed; primary parish denied |

## Running the bootstrap

From the repository root on the `staging` branch:

```sh
npm run uat:seed
```

The command creates or updates only the controlled fixtures, verifies Auth users, profiles, memberships, role tuples, representative permission calls, subscription denial, cross-tenant denial, duplicate absence, and the Church Admin invariant, then prints credentials and a PASS/FAIL result for every persona.

Rerun the same command to confirm idempotence. Existing role tuples are upserted using `(user_id, church_id, role)`, so a second role never overwrites the first.

## Browser test instructions

1. Obtain the password from the local credentials file or seed output.
2. Sign in as each persona and compare navigation with the expected workspace above.
3. Open allowed and denied pages directly by URL; hidden navigation alone is not sufficient.
4. With one session active, change a role from the Church Admin account and confirm navigation and permission state refresh without logout.
5. Remove one role from a multi-role account and verify remaining permissions survive.
6. Attempt a duplicate assignment and verify it is rejected without another staff row.
7. Confirm the expired account cannot use subscription-gated features.
8. Confirm the other-parish administrator cannot read or mutate the primary UAT parish.

## Reset

```sh
npm run uat:reset
```

Reset removes managed non-anchor UAT memberships and role assignments, then asks Supabase Auth to delete those managed accounts. If an account predates this fixture and Auth deletion is blocked by a non-UAT foreign-key reference, reset retains it and prints an explicit warning rather than deleting unrelated staging data. It deliberately retains one marked Church Admin anchor account in each reserved church, along with the churches and their protected feature, permission, and subscription configuration, so neither the final Church Admin invariant nor the mandatory recovery feature is disabled or bypassed. The next seed recreates the complete fixture set idempotently.

The reset refuses to operate when a reserved slug has an unexpected name/code, when an anchor is missing, or when an anchor lacks exactly one Church Admin role. It never selects users by the entire email domain and does not modify unrelated staging users.
