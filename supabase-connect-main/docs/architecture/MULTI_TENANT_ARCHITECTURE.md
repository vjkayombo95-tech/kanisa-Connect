# Multi-Tenant Architecture

## Table of Contents

- [Purpose](#purpose)
- [Scope](#scope)
- [Current Tenant Model](#current-tenant-model)
- [Church Isolation](#church-isolation)
- [Workspace Model](#workspace-model)
- [Ownership and Shared Resources](#ownership-and-shared-resources)
- [Cross-Tenant Protection](#cross-tenant-protection)
- [Design Decisions](#design-decisions)
- [Architecture Invariants](#architecture-invariants)
- [Future Diocese Support](#future-diocese-support)
- [Future Considerations](#future-considerations)
- [Related Documents](#related-documents)

## Purpose

Define the current church-scoped tenant boundary and the safe evolution path toward broader SaaS and diocese tenancy.

## Scope

This document distinguishes the implemented `church_id` boundary from app-side tenant planning abstractions. It covers data, authorization, workspaces, storage, and shared platform resources.

## Current Tenant Model

**Implemented.** The church is the operational tenant boundary. Most parish records include `church_id`; authenticated context resolves one active church for the current workspace. Roles and memberships are also church-specific.

**Application foundation only.** `src/lib/tenant/` contains planning types and services for branding, plans, regional settings, storage paths, feature defaults, provisioning plans, and platform readiness. It does not mean a persisted tenant-above-church schema or automated provisioning system is complete.

## Church Isolation

RLS and authorized RPCs restrict users to churches where they have an applicable role or active membership. Member-owned records add a user/member ownership predicate. Platform administrators use separately reviewed global paths.

Church identity is selected from authoritative database context, not trusted route parameters, query strings, or local storage. A caller-supplied `church_id` is always revalidated by the database.

## Workspace Model

Workspaces organize user experience, not tenant ownership. Member, Pastoral, Church Administration, Finance, Community Leader, and Super Admin routes consume the authenticated context and feature/permission model.

Multiple roles may contribute navigation and actions within one church. A workspace must never imply access to another church or bypass action-level permission checks.

## Ownership and Shared Resources

Church-owned resources include members, roles, contributions, pastoral workflows, events, settings, permissions, feature state, subscriptions, and church assets.

Shared platform resources include intentionally global Catholic content, feature catalog definitions, platform operations, and other explicitly global configuration. Shared data must be marked and authorized as such; absence of `church_id` must not be accidental.

Storage paths should include church or tenant ownership for private assets and evidence. Public Catholic content may use shared paths when publication is intentional.

## Cross-Tenant Protection

Protection is layered:

- RLS predicates enforce church scope.
- RPCs validate authenticated church membership or permission.
- Realtime church topics admit only current role holders or active members.
- Storage policies validate bucket and path ownership.
- UI context avoids presenting cross-church routes or cache data.
- Tests use other-church personas and direct API attempts, not navigation checks alone.

The database is the final boundary if client context becomes stale.

## Design Decisions

- Keep church as the implemented ministry boundary.
- Keep tenant identity explicit in tables, cache keys, topics, logs, and storage paths.
- Separate globally shared Catholic/platform resources from church-owned data.
- Introduce higher-level tenancy only through a migration and compatibility plan.

## Architecture Invariants

- No tenant-scoped table or RPC may rely solely on frontend church selection.
- Cross-church reads, writes, subscriptions, and storage access are denied by default.
- Additive roles aggregate only within the same church.
- Cache keys for church data include the authoritative church identifier.
- Shared resources are globally scoped only by an explicit design decision.

## Future Diocese Support

**Future Enhancement.** A diocese may become a commercial/administrative tenant containing multiple churches. Potential capabilities include shared regional settings, diocese content, cross-parish reporting, priest assignments, and central billing.

This requires persisted tenant and membership models, tenant-aware RLS, backfill of one tenant per current church, explicit parish overrides, and controls preventing diocese visibility from becoming unrestricted church mutation access.

## Future Considerations

**Future Enhancement:** resumable church provisioning, tenant-level branding, plan limits, regional defaults, white-label support, and multi-church user selection. Safe membership transfer/revoke semantics remain unresolved because `members` and `user_roles` are independent assignments.

## Related Documents

- [Authorization Architecture](AUTHORIZATION_ARCHITECTURE.md)
- [Database Architecture](DATABASE_ARCHITECTURE.md)
- [Security Architecture](SECURITY_ARCHITECTURE.md)
- Existing detail: [`MULTI_TENANT_ARCHITECTURE.md`](../MULTI_TENANT_ARCHITECTURE.md)
