# Tenant feature/action permission inventory

This inventory classifies backend and browser mutation paths after the July 2026 tenant-permission hardening. “Record RLS” means the pre-existing tenant/owner policy still has to pass in addition to the feature check.

## Enforced tenant paths

| Surface | Paths | Enforcement |
| --- | --- | --- |
| Direct/RPC table mutations | Tenant feature roots and dependent records: members/families/communities/ministries, invitations, announcements/messages/notifications, events/attendance/audiences/RSVP/payments/requests, prayers/comments/prayer marks, Mass intentions, sermons/sacraments, contributions/categories, pledges/payments/targets, and community-help requests/comments/donations | Existing record RLS plus restrictive feature policies and `enforce_feature_mutation_permission`; lifecycle changes require `approve` or `publish`. This also catches SECURITY DEFINER RPC writes. |
| Role mutations | `assign_church_member_role`, `remove_church_member_role`, role-management queries, invitation creation/revocation | `can_manage_church_roles` now delegates to `feature_permissions_admin/manage`; invitation rows require `roles/create|edit|delete`; final Church Admin trigger is unconditional. |
| Feature mutations | `set_church_feature_enabled`, `save_church_role_permissions`, Super Admin global/church controls | Authenticated RPC authorization, strict tenant IDs, applicability validation, mandatory-feature triggers, and explicit-row reset. |
| Edge Functions | `send-invitation`, `audio-cms`, `member-audio`, `operations-health`, `operations-metrics` | Caller-scoped `has_church_feature_permission` before privileged reads, writes, signed URLs, or delivery. |
| Internal Edge Functions | `audio-worker`, `whatsapp-webhook`, `whatsapp-send`, `whatsapp-dispatch` | Trusted secret/signature plus service-role tenant feature/subscription eligibility. |
| Storage | `audio`, `audio-reports`, `audio-indexes`, `audio-transcripts`, `audio-alignments` | Tenant-prefixed path and restrictive action policies layered with existing bucket policies. Signed upload/read URLs are also permission-checked by `audio-cms`. |
| Exports | Event registration CSV/PDF, Mass Intention PDF, Finance Intelligence PDF, finance export route | Explicit `manage` checks. Exporting data already delivered to an authorized browser is not a separate confidentiality boundary; source reads remain protected by record RLS and `view`. |
| Notifications | WhatsApp inbound, queue, dispatch, direct internal send; notification-row mutations | `notifications` subscription/tenant feature checks. User marking their own notification read is an explicit record-owned exception. |

## Deliberate non-tenant / bootstrap exceptions

These paths do not use church action permissions because they are either platform-only or must establish the tenant relationship before a tenant role exists:

- Authentication, public registration, church creation, join-code lookup, invitation lookup, and accepting an invitation. Token/email validation and record-scoped checks remain authoritative. Acceptance may only transition the matching invite from pending to accepted.
- A user creating or editing their own linked `members` profile. Existing member-own-record RLS remains authoritative; staff creation and edits require `members/create|edit`.
- Super Admin billing, subscription review, trial extension, platform feature catalog, platform fees, audit/system jobs, Catholic CMS/import, Bible catalog/audio generation, and system health operations. These remain protected by platform Super Admin checks and are not church-delegable actions.
- Scheduler bookkeeping (`automation_runs`, `automation_logs`, `system_jobs`, `system_alerts`) and provider delivery receipts. Any tenant announcement/notification created by the scheduler still crosses a feature-aware table trigger.
- `church-assets`, `avatars`, `billing-receipts`, `record-preservation-proofs`, `catholic-content`, and `bible-audio` storage. They keep their specialized ownership, billing, member-record, or platform-Super-Admin policies. They are not governed by a tenant-configurable feature in the current catalog.
- QR/SVG/CSV templates that contain no tenant records (invite QR and import templates). Their source workflows remain permission-protected, but creating a local representation is not a backend data mutation.

## Paths requiring a feature assignment before future tenant use

Unknown/new platform features receive an empty plan mapping, disabled church rows, and deny-all role rows. New Edge Functions, RPCs, buckets, exports, or notification workflows must select an existing feature/action or add a catalog entry and plan mapping before release. Missing mappings and missing rows deny.
