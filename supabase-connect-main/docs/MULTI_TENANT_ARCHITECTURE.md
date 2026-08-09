# Multi-Tenant Architecture

Kanisa Connect is moving toward self-service SaaS onboarding where thousands of churches can be provisioned without manual engineering work. RC-28.1 introduces the application-layer tenant foundation only. It does not add database migrations, route changes, payment integration, or changes to existing church behavior.

## Tenant Model

A tenant is the future ownership boundary above a church. Every church belongs to exactly one tenant.

Current application data is still church-scoped through `church_id`. The tenant abstraction prepares a clean migration path where tenant-level configuration can be introduced without rewriting existing church functionality.

Tenant contains:

- Church metadata: name, slug, code, email, phone, address.
- Branding: logo, primary color, secondary color, accent color, parish banner, app icon, white-label name.
- Feature flags: livestream, community help, finance, Mass intentions, Bible, volunteer module, notifications, reports, future AI.
- Subscription plan: free, starter, growth, diocese, enterprise.
- Storage configuration: tenant bucket prefix and storage paths for church assets, member assets, receipts, and imports.
- Notification settings: email, SMS, push, WhatsApp, sender name.
- Regional settings: country, language, timezone, currency, date format, liturgical region, future local holiday region.

The initial implementation lives in `src/lib/tenant/`:

- `types.ts`: shared Tenant, provisioning, feature, branding, regional, and platform status types.
- `feature-flags.ts`: centralized tenant feature flag engine.
- `branding.ts`: branding defaults and completeness check.
- `subscription.ts`: SaaS plan definitions.
- `regional.ts`: regional defaults.
- `storage.ts`: tenant storage path builder.
- `provisioning.ts`: provisioning draft and lifecycle plan builder.
- `platform-status.ts`: platform readiness evaluator.

## Provisioning Lifecycle

The provisioning service prepares a future automated flow. It currently produces plans and tenant drafts only.

Lifecycle:

1. Create tenant record.
2. Create church metadata.
3. Prepare storage folders.
4. Create default roles.
5. Register workspace.
6. Apply settings.
7. Apply feature flags.
8. Prepare calendar.
9. Create default communities.
10. Create default ministries.

Future provisioning should be idempotent. Each step should be safe to retry and should report a clear status. Storage, feature flags, and default content should be provisioned after the church record exists, but before members are invited.

## Feature Flag Strategy

Tenant feature flags are calculated from plan defaults plus tenant overrides.

Plan defaults provide commercial packaging. Tenant overrides allow support or enterprise configuration without changing route logic.

Flags introduced:

- Livestream
- Community Help
- Finance
- Mass Intentions
- Bible
- Volunteer Module
- Notifications
- Reports
- Future AI

Future migration recommendation: create tenant-level feature tables or extend existing `church_features` with `tenant_id`. Keep the app-side API stable through the tenant feature engine.

## Branding Strategy

Branding is tenant-owned, not page-owned. A tenant can eventually support parish-branded apps and white-label deployments.

Supported fields:

- Logo
- Primary color
- Secondary color
- Accent color
- Parish banner
- App icon
- White-label name

Future migration recommendation: keep current `churches.logo_url`, `banner_url`, and `theme_color` as compatibility fields, then add a tenant branding source of truth when tenant tables are introduced.

## Subscription Layer

RC-28.1 introduces plan configuration only. It does not integrate payments.

Plans:

- Free
- Starter
- Growth
- Diocese
- Enterprise

Plan definitions include member/church limits and included features. Existing payment and billing flows remain unchanged.

Future migration recommendation: map existing billing plans to the new SaaS plan vocabulary in a compatibility layer before changing persisted billing data.

## Regional Configuration

Regional settings prepare Kanisa Connect for churches beyond the first Tanzanian deployment.

Supported fields:

- Country
- Language
- Timezone
- Currency
- Date format
- Liturgical region
- Future local holiday region

Future migration recommendation: store regional settings at tenant level, with church-level overrides only where a multi-parish tenant truly needs different local settings.

## Platform Health

`PlatformStatus` evaluates whether a tenant is ready for pilot or production.

Checks:

- Configuration complete
- Storage ready
- Branding complete
- Daily Readings loaded
- Bible available
- Notifications configured

Pilot readiness allows warning-level gaps. Production readiness requires all checks to pass.

## Scaling Strategy

Scaling should preserve church isolation and keep hot paths cacheable.

Recommendations:

- Keep all operational data scoped by tenant and church.
- Add compound indexes on future tenant-scoped tables.
- Keep storage paths tenant-prefixed.
- Cache mostly-static Catholic content globally when it is not tenant-specific.
- Cache tenant settings and feature flags aggressively.
- Keep provisioning async and resumable.
- Use tenant status checks to block incomplete launches before members are invited.

## Deployment Strategy

The current deployment can continue to run as a single application. Multi-tenant support should be introduced behind stable app-side services before schema changes.

Recommended sequence:

1. Ship app-side tenant abstractions.
2. Add tenant tables and backfill one tenant per existing church.
3. Route all configuration reads through tenant services.
4. Add provisioning jobs.
5. Add self-service onboarding UI.
6. Add plan/payment integration later.

## Future Diocese Model

A diocese tenant can own many churches.

Future diocese capabilities:

- Shared liturgical and regional settings.
- Parish-specific branding overrides.
- Diocese-wide announcements.
- Cross-parish reporting.
- Priest assignments across parishes.
- Central subscription and billing.
- Tenant-level security and audit review.

The key rule remains: tenant is the commercial and operational boundary; church remains the parish ministry boundary.
