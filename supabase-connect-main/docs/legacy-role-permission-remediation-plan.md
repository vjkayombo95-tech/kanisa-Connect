# Legacy Role-Permission Conflict Remediation Plan

Status: approved and applied to staging on 2026-07-27; not applied to production.

Target: Supabase staging project `nunfrjcuimaytydnaqtt`.

Applied staging migration: `supabase/migrations/20260727130000_remediate_legacy_role_permission_conflicts.sql`.
The independently runnable read-only inventory is
`scripts/sql/preflight-legacy-role-permission-remediation.sql`.

## Decision summary

| Decision | Cells | Result |
|---|---:|---|
| Preserve: `INTENTIONAL_PROTECTED` | 14 | Keep granted |
| Remove: `CLEARLY_NON_APPLICABLE` | 519 | Set the named action column to `false` |
| Remove: `ROLE_BOUNDARY_VIOLATION` | 34 | Set the named action column to `false` |
| Requires product decision: `AMBIGUOUS_PRODUCT_DECISION` | 0 | None in the current inventory |
| **Total reviewed** | **567** | 14 preserved; 553 proposed removals |

The migration must not delete permission rows, change configurable cells, alter role assignments, or weaken the mandatory Church Admin recovery path.

## Exact church scopes

The inventory below uses named scopes to remain compact while still identifying every tenant explicitly.

### `ALL_7`

| Church ID | Church | Church Admin users | Pastor users | Secretary users | Treasurer users |
|---|---|---:|---:|---:|---:|
| `dcbf9ea0-7acf-4766-9c76-79ac4894ecd7` | Demo Catholic Parish | 1 | 0 | 0 | 0 |
| `2b4c3d9f-a10f-485a-b2af-2e35c7b955c3` | Kanisa Connect UAT Expired Parish | 1 | 0 | 0 | 0 |
| `33647844-1eec-4c5b-bfce-be0ca3c6c46a` | Kanisa Connect UAT Other Parish | 1 | 0 | 0 | 0 |
| `572c5be1-9839-4283-8595-c062cc1e91ce` | Kanisa Connect UAT Parish | 3 | 4 | 2 | 4 |
| `27fbab53-6b08-4cbd-a2f7-aaefa2a2dc51` | ST THERESIA | 1 | 0 | 0 | 1 |
| `f9309e91-c1da-4472-9b1f-de63b0e7aa6e` | ST JOSHUA | 1 | 0 | 0 | 0 |
| `af92dd3b-fcbe-4578-bbd9-ba341e5b2f9e` | St Mary | 1 | 0 | 0 | 0 |

### Subsets

- `UAT_3`: `2b4c3d9f-a10f-485a-b2af-2e35c7b955c3`, `33647844-1eec-4c5b-bfce-be0ca3c6c46a`, and `572c5be1-9839-4283-8595-c062cc1e91ce`.
- `GIVE_4`: `dcbf9ea0-7acf-4766-9c76-79ac4894ecd7`, `27fbab53-6b08-4cbd-a2f7-aaefa2a2dc51`, `f9309e91-c1da-4472-9b1f-de63b0e7aa6e`, and `af92dd3b-fcbe-4578-bbd9-ba341e5b2f9e`.

Fifteen distinct users inherit at least one affected role. Counts in the table are role-assignment counts and intentionally do not expose user identity.

## A. `INTENTIONAL_PROTECTED` — preserve

Every row below currently has `granted = true`, classification `RESTRICTED`, record scope `church`, and reason “This mandatory administrative recovery permission is platform controlled.”

| Church scope | Role | Feature | Actions | Cells | Inherited | Decision |
|---|---|---|---|---:|---|---|
| `ALL_7` | `church_admin` | `feature_permissions_admin` | `view`, `manage` | 14 | Yes; 9 Church Admin assignments across the seven churches | Preserve |

Evidence:

- `save_church_role_permissions` requires `feature_permissions_admin:manage` and refuses a non-platform actor’s attempt to weaken either restricted recovery cell.
- Feature-permission, church-setting, branding-storage, and related administrative policies use `feature_permissions_admin:manage`.
- The permission editor and route metadata use `manage`; the mandatory feature trigger and SQL tests protect the recovery path.
- Removing either grant could lock a church out of its authorization controls. These are intentional protections, not legacy defects.

## B. `CLEARLY_NON_APPLICABLE` — remove

Every inventory entry below currently has `granted = true`, classification `SYSTEM_PROTECTED`, record scope `none`, and reason “This feature and action combination is not supported by the application.” Each listed action applies to every church in its stated scope.

### Church Admin, `ALL_7`

| Feature | Granted actions proposed for removal |
|---|---|
| `announcements` | `approve` |
| `audio_processing` | `approve` |
| `bible_audio` | `approve`, `create`, `delete`, `edit`, `publish` |
| `bible_verses` | `approve`, `create`, `delete`, `edit`, `manage`, `publish` |
| `catholic_content` | `approve`, `create`, `delete`, `edit`, `publish` |
| `channels` | `approve`, `publish` |
| `communities` | `approve`, `publish` |
| `community_help` | `publish` |
| `contributions` | `delete`, `publish` |
| `event_requests` | `publish` |
| `families` | `approve`, `publish` |
| `finance_intelligence` | `approve`, `create`, `delete`, `edit`, `publish` |
| `give` | `approve`, `delete`, `edit`, `manage`, `publish` |
| `kanisa_ai` | `approve`, `create`, `delete`, `edit`, `publish` |
| `mass_intentions` | `publish` |
| `members` | `approve`, `publish` |
| `ministries` | `approve`, `publish` |
| `notifications` | `approve`, `delete` |
| `operations` | `approve`, `create`, `delete`, `edit`, `publish` |
| `pledges` | `delete`, `publish` |
| `prayer_requests` | `publish` |
| `reports` | `approve`, `create`, `delete`, `edit`, `publish` |
| `roles` | `approve`, `publish` |
| `sacraments` | `delete`, `publish` |
| `sermons` | `approve` |

This is 68 feature/action combinations across seven explicit churches: 476 cells. At least one Church Admin inherits every cell in every affected church (9 distinct role assignments in total).

### Church Admin, `UAT_3`

| Feature | Granted actions proposed for removal | Cells | Inherited |
|---|---|---:|---|
| `feature_permissions_admin` | `approve`, `create`, `delete`, `edit`, `publish` | 15 | Yes; 5 Church Admin assignments across the three churches |

### Treasurer, `ALL_7`

| Feature | Granted actions proposed for removal | Cells | Inherited |
|---|---|---:|---|
| `finance_intelligence` | `create`, `edit` | 14 | Yes only in Kanisa Connect UAT Parish (4) and ST THERESIA (1) |
| `reports` | `create`, `edit` | 14 | Yes only in Kanisa Connect UAT Parish (4) and ST THERESIA (1) |

### Code and backend review for non-applicable cells

- Route guards consume supported `view` or `manage` actions. They do not consume any pair listed above.
- The permission editor renders all seven generic columns, but the constraint RPC marks these cells SYSTEM_PROTECTED and the UI disables them. Removing their stored `true` values therefore removes no supported control.
- Workflow triggers use `publish` only for announcement/message status transitions and `approve` only for the explicitly modeled approval workflows. The listed unsupported transitions have no corresponding trigger branch.
- Bible, Catholic content, analytics, AI, and operations surfaces use read/manage or dedicated RPC/Edge Function contracts; no affected generic CRUD/approval/publish pair is consumed.
- Audio storage and CMS enforcement uses `audio_processing:view/create/edit/delete`; it does not use `audio_processing:approve` or generic `bible_audio` mutation grants.
- The legacy generic restrictive policies can still consult CRUD columns for a direct table request. In particular, legacy `contributions:delete` and `pledges:delete` grants may help a crafted direct request pass the feature-permission layer, subject to the remaining RLS policies. Removing them closes that unintended capability; supported UI does not expose those deletions.
- No mutation function, authorized RPC, route guard, permission hook, trigger, or focused test was found to require any listed pair. External clients outside this repository remain an operational risk and should be checked before production rollout.

Expected user-visible effect: none in supported workflows. Locked legacy checkboxes remain locked, navigation remains governed by supported view/manage grants, and direct or stale requests using unsupported action names begin returning authorization denial instead of inheriting a legacy `true` value.

## C. `ROLE_BOUNDARY_VIOLATION` — remove

### Exact inventory

| Church scope | Role | Feature | Action | Cells | Current inheritance | Reason |
|---|---|---|---|---:|---|---|
| `ALL_7` | `pastor` | `roles` | `view` | 7 | Kanisa Connect UAT Parish: 4; all others: 0 | Only Church Admins may administer church role assignments |
| `ALL_7` | `secretary` | `roles` | `view` | 7 | Kanisa Connect UAT Parish: 2; all others: 0 | Only Church Admins may administer church role assignments |
| `ALL_7` | `treasurer` | `roles` | `view` | 7 | Kanisa Connect UAT Parish: 4; ST THERESIA: 1; all others: 0 | Only Church Admins may administer church role assignments |
| `UAT_3` | `pastor` | `feature_permissions_admin` | `view` | 3 | Kanisa Connect UAT Parish: 4; other two: 0 | Only the Church Admin recovery role may hold this permission |
| `UAT_3` | `secretary` | `feature_permissions_admin` | `view` | 3 | Kanisa Connect UAT Parish: 2; other two: 0 | Only the Church Admin recovery role may hold this permission |
| `UAT_3` | `treasurer` | `feature_permissions_admin` | `view` | 3 | Kanisa Connect UAT Parish: 4; other two: 0 | Only the Church Admin recovery role may hold this permission |
| `GIVE_4` | `treasurer` | `give` | `create` | 4 | ST THERESIA: 1; other three: 0 | Outside the Treasurer role’s finance authority |

### Safety and workflow findings

`roles:view` is genuinely outside the approved role boundary:

- `/church-admin/roles` is guarded by `feature_permissions_admin:manage`, not `roles:view`.
- Role assignment/removal and role-list RPCs call `can_manage_church_roles`, which authorizes Church Admin/owner/platform actors. They do not consume `roles:view`.
- Invitation email authorization checks `roles:manage`, not `roles:view`.
- Removal has no supported staff UI effect. It prevents a direct effective-permission check from treating staff as authorized to view the role-management feature.

Non-admin `feature_permissions_admin:view` is genuinely unsafe and unnecessary:

- The feature is the mandatory Church Admin recovery mechanism.
- Administrative UI, RLS, triggers, storage policies, and save RPCs require `manage`; none use non-admin `view` as a supported workflow entitlement.
- Removal keeps all 14 Church Admin recovery grants intact and prevents recovery-feature visibility from being inherited by staff roles.

Treasurer `give:create` is not an ownership-limited Treasurer workflow:

- `give` is the member giving entry point and QR/navigation feature.
- `PortalGive` calls `record_contribution_with_key`; that RPC validates the caller’s membership/workspace authority and writes a `contributions` record. It does not check `give:create`.
- Treasurer finance work uses `contributions` and `pledges` permissions. No Treasurer mutation button, route guard, RPC, RLS policy, or trigger consumes `give:create`.
- Removal has no supported UI effect. A future assisted-giving workflow would require an explicit product design and server-enforced scope rather than retaining this broad legacy grant.

## D. `AMBIGUOUS_PRODUCT_DECISION`

Count: 0.

No current assignment remained ambiguous after tracing routes, hooks, mutation code, RPCs, RLS policies, triggers, and tests. This does not pre-approve future workflows: any new role/action combination must first define record scope and server enforcement.

## Preview and migration design

The draft SQL builds a temporary target-cell relation from explicit tenant UUIDs and explicit role/feature/action tuples. Its preview query returns:

- exact church ID and name;
- role, feature key, and action;
- current granted value;
- canonical classification and reason;
- safely determinable assigned-user count.

Before changing anything, the draft must assert:

- exactly 553 distinct target cells exist;
- every target is currently SYSTEM_PROTECTED;
- either all 553 are still `true` or all 553 are already `false` (idempotent replay);
- no RESTRICTED cell is targeted.

The update touches each affected permission row once and changes only action columns named by the target relation from `true` to `false`. It is tenant-explicit, contains no dynamic SQL, deletes no row, and does not update configurable or restricted cells.

## Expected counts

| Metric | Before | After |
|---|---:|---:|
| Permission rows | 881 | 881 |
| Conflicting granted cells reported by the audit | 567 | 14 |
| RESTRICTED granted cells | 14 | 14 |
| SYSTEM_PROTECTED granted cells | 553 | 0 |
| Non-applicable granted cells | 519 | 0 |
| Role-boundary granted cells | 34 | 0 |
| Configurable granted cells | 1,954 | 1,954 |
| Total granted cells | 2,521 | 1,968 |

The remaining 14 audit entries are intentional restricted recovery grants and should be reported separately from remediable conflicts.

## Fingerprint methodology

Compute MD5 over a newline-separated, deterministically ordered serialization of:

`church_id | role | feature_key | can_view | can_create | can_edit | can_delete | can_approve | can_publish | can_manage`

ordered by `church_id`, `role`, and `feature_key`.

- Read-only measured before fingerprint: `b02cc0ce3477c3126ceefbb1f22c3cb7`.
- Read-only projected after fingerprint: `e394c77baca206663f75b4631094ebde`.

These values use the methodology above and are separate from any earlier fingerprint calculated with a different serialization.

## Recovery strategy

The forward migration should be applied atomically after a fresh preview and backup. Recovery is also tenant- and cell-explicit:

1. Verify the current fingerprint equals the expected after fingerprint and that no later legitimate permission changes overlap the target rows.
2. Rebuild the same 553-cell static target relation.
3. In one transaction, set only the target action columns from `false` back to `true`.
4. Assert 553 target cells are granted, the fingerprint returns to the recorded before value, permission-row count remains 881, and the 14 restricted recovery cells remain granted.
5. Rerun the constraint audit, canonical persona checks, Church Admin anchor checks, and authorization SQL suites.

Recovery deliberately restores legacy authority and should be used only for a verified regression. A normal forward correction should instead add a specifically designed configurable permission with matching RLS/RPC enforcement.

## Risks and required verification after approval

- External or unpublished clients may have called unsupported permission pairs even though repository code does not. Review access logs/telemetry before production rollout.
- Revoking a legacy grant can immediately invalidate active-session permission caches through Broadcast; verify navigation and active-page behavior for affected staging personas.
- Generic RLS paths should become stricter for unsupported direct mutations. Confirm expected SQLSTATE `42501` denials.
- Before applying, record a fresh inventory, fingerprints, 12-persona validity, Church Admin anchors, and role-assignment counts.
- After applying, run the read-only audit, permission-constraint SQL suite, the three authorization SQL suites, focused authorization tests, full Vitest, build, changed-file ESLint, and `git diff --check`.

No staging or production data was modified while preparing this plan.
