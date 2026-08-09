# Security Architecture

## Table of Contents

- [Purpose](#purpose)
- [Scope](#scope)
- [Trust Boundaries](#trust-boundaries)
- [Authentication and Sessions](#authentication-and-sessions)
- [Authorization and Least Privilege](#authorization-and-least-privilege)
- [Application Security](#application-security)
- [Secrets and Trusted Services](#secrets-and-trusted-services)
- [Database Function Security](#database-function-security)
- [Audit, Encryption, and Data Handling](#audit-encryption-and-data-handling)
- [Design Decisions](#design-decisions)
- [Architecture Invariants](#architecture-invariants)
- [Future Considerations](#future-considerations)
- [Related Documents](#related-documents)

## Purpose

Define Kanisa Connect's security boundaries and the controls required to protect identities, churches, sensitive records, external integrations, and operational credentials.

## Scope

This document covers the browser, Supabase Auth, database, Storage, Edge Functions, webhook boundaries, secrets, sessions, audit behavior, and common web threats. Operational incident response is covered by [Backup and Disaster Recovery](BACKUP_AND_DISASTER_RECOVERY.md).

## Trust Boundaries

| Boundary | Trust decision |
|---|---|
| Browser | Untrusted for enforcement; may hold only public client configuration and user session material |
| Supabase Auth | Establishes authenticated identity and JWT claims |
| PostgreSQL | Authoritative data, tenant, permission, and invariant boundary |
| Storage | Bucket/path policies determine object access |
| Edge Functions | Trusted only when secrets, signatures, JWTs, and internal headers are validated |
| External providers | Untrusted input until signature and schema validation pass |
| Service role | Highly privileged server credential; never available to a browser |

## Authentication and Sessions

**Implemented.** Supabase Auth manages sessions. The client uses the public anon/publishable key and bearer session token. Startup configuration validates the environment and expected Supabase project before authenticated routes initialize.

Session rules:

- Login, logout, recovery, and invitation redirects use configured approved domains.
- Logout clears application authorization context and subscriptions.
- Invalid refresh tokens fail to login rather than retaining stale privilege.
- CAPTCHA, provider policy, password policy, rate limits, and production redirect configuration are operational Supabase settings and must be verified before release.

## Authorization and Least Privilege

Authorization is database-first. RLS, triggers, authorized RPCs, Storage policies, and private Broadcast policies enforce scope. Route guards are UX only.

Tenant isolation is mandatory. Church users see only their church and owned/member-visible records. Super Admin paths are explicit and audited. Service-role operations are restricted to trusted jobs, workers, and integrations.

See [Authorization Architecture](AUTHORIZATION_ARCHITECTURE.md).

Role-permission administration applies a database-owned constraint model in addition to effective permission checks. PostgreSQL classifies each role/feature/action as configurable, platform-restricted, or system-protected; validates the actor and church; and rejects the entire atomic batch when it contains an unauthorised change. The browser renders those decisions but does not recreate or enforce them. Existing grants that exceed a new boundary require reviewed remediation and are never silently deleted by a hardening migration.

## Application Security

### SQL Injection

Supabase query builders and RPC parameters carry user values as bound data. New code must not concatenate user input into SQL. Controlled migration-time dynamic SQL must format identifiers and literals safely and restrict inputs to reviewed catalog values.

### Cross-Site Scripting

React escapes rendered text by default. Rich HTML uses the established sanitization path, including DOMPurify where HTML rendering is required. `dangerouslySetInnerHTML` or equivalent rendering of untrusted content requires explicit sanitization and security review.

### CSRF

Supabase API mutations use bearer tokens rather than ambient application cookies, reducing conventional cookie-CSRF exposure. State-changing endpoints must not use GET. Edge Functions must maintain explicit CORS/origin policy where browser callable, and external webhooks use provider signatures rather than browser CSRF tokens.

### Input and Output Safety

Validate identifiers, amounts, states, file paths, MIME types, and workflow transitions at the server. User-facing errors must not disclose SQL, stack traces, tokens, provider secrets, or private pastoral/financial content.

## Secrets and Trusted Services

- Never commit secrets.
- Never expose service-role or provider secrets through `VITE_*` variables.
- Store WhatsApp, worker, service-role, and future provider secrets only in trusted deployment secret stores.
- Avoid logging credentials, access tokens, full payment references, or sensitive webhook bodies.
- Rotate credentials after suspected disclosure.
- Distinct internal functions use distinct secrets where implemented.

## Database Function Security

`SECURITY DEFINER` functions are privileged code. They must:

- set an explicit controlled `search_path`;
- schema-qualify sensitive objects where practical;
- check `auth.uid()` or an explicit trusted service context;
- revalidate church, ownership, feature, permission, and lifecycle rules;
- avoid caller-controlled dynamic object resolution; and
- return only necessary data.

PostgreSQL grants function execution to `PUBLIC` by default. Internal, trigger-only, service-only, and non-public helpers revoke that default and grant `EXECUTE` only to intended roles. A security-definer helper must not become an accidental public RPC.

## Audit, Encryption, and Data Handling

Audit and operational records exist for role changes, billing review, platform operations, imports, jobs, and selected security-sensitive workflows. Audit events must store sufficient actor, tenant, action, target, and outcome context without becoming an authorization source.

Transport uses HTTPS/TLS through hosting and Supabase. At-rest protections rely on the configured managed platform and backup/storage controls; production configuration must be verified operationally. Private objects use signed or policy-controlled access.

Logs and metrics must minimize personal, financial, and pastoral data.

## Design Decisions

- Assume the browser and external payloads are hostile.
- Use defense in depth, not a single authorization check.
- Centralize secrets in trusted environments.
- Prefer narrow transactional RPCs to broad privileged table access.
- Treat role-permission configuration as a bounded delegation problem: an administrator cannot grant authority beyond the target role's reviewed maximum.
- Fail closed when identity, tenant, Realtime authorization, or authoritative context cannot be established.

## Architecture Invariants

- Service-role credentials never enter client code or logs.
- Tenant and ownership checks remain server-enforced.
- External webhooks are authenticated before persistence or dispatch.
- Security-definer functions use controlled search paths and narrow grants.
- No frontend workaround broadens RLS or Storage policies.
- Permission-matrix locks have matching RPC validation, and unsupported combinations fail secure.
- Sensitive logs exclude secrets and unnecessary private content.

## Future Considerations

**Future Enhancement:** external security monitoring, formal threat-model reviews per release, centralized secret rotation, stronger fraud controls, automated dependency scanning, and documented data-retention policies. These additions complement rather than replace current database controls.

## Related Documents

- [Authorization Architecture](AUTHORIZATION_ARCHITECTURE.md)
- [Deployment Architecture](DEPLOYMENT_ARCHITECTURE.md)
- [Observability Architecture](OBSERVABILITY_ARCHITECTURE.md)
- Existing review: [`SECURITY.md`](../SECURITY.md)
