# Kanisa AI Workspace Isolation

## Audit Findings

Before RC-2.4.0, Kanisa AI resolved its workspace from the authenticated user's role with `getWorkspaceIdForRole(userRole, isSuperAdmin)`. That ignored the active `WorkspaceProvider`.

This caused a mixed experience:

- The shell and diagnostics could show `member`.
- The Kanisa AI page could still resolve as `church_admin`.
- Assistant cards were mostly static by domain visibility.
- Parish capabilities did not distinguish member-safe actions from administrative actions.
- Intent routing detected an intent, then selected the first registered action for that intent.
- Shared intents such as Mass Intentions, Prayer Requests, and Contributions had admin/pastoral/finance permissions even when a member route existed.
- Command Center suggestions used role-derived workspace rather than active workspace.

## Root Cause

Workspace context existed, but Kanisa AI was not consuming it consistently. The active route shell was workspace-aware; AI discovery and command routing still leaned on role-derived defaults.

## Resolution Flow

The intended flow is now:

Identity

Active Workspace

Role

Permissions

Available Assistants

Available Capabilities

Authorized Intent

Workspace Route or Safe Unavailable State

## Central Resolver

`resolveKanisaAIExperience` centralizes:

- assistant discovery
- capability filtering
- suggested prompts
- allowed action intents
- allowed retrieval intents
- navigation targets
- provider availability state

The active workspace is passed through `createKanisaAIContext`. Pages and command surfaces should prefer `useWorkspaceContext()` and only fall back to role-derived workspace when no workspace shell is mounted.

## Workspace Experiences

Member receives:

- My Faith Assistant
- Bible & Readings Assistant
- Prayer Assistant
- Parish Life Assistant

Member capabilities are member-scoped, such as today's readings, Bible search, prayer library, saints, parish calendar, parish events, published announcements, my Mass intentions, my contributions, communities, and notifications.

Church Admin receives:

- Parish Operations Assistant
- Pastoral Operations Assistant
- Finance Intelligence
- Content Assistant

Church Admin capabilities remain parish operations scoped and do not include Super Admin platform routes.

Finance receives:

- Finance Intelligence
- Bible & Readings Assistant where workspace routes exist

Finance capabilities are finance-scoped and exclude pastoral and platform operations.

Pastoral receives:

- Bible & Readings Assistant
- Pastoral Operations Assistant
- Content Assistant

Pastoral capabilities exclude finance intelligence and platform operations.

Super Admin receives:

- Platform Operations Assistant
- Catholic CMS Assistant

Super Admin routes remain `/super-admin/...` and do not cross into Church Admin URLs.

## Capability Registry

Capabilities define:

- id
- label
- domain
- allowed workspaces
- intents
- route by workspace
- provider requirement

The same capability metadata is used to build assistant cards and workspace-safe prompt/action context.

## Command Center Isolation

The Command Center now resolves its workspace from `WorkspaceProvider` first. This keeps suggestions, workspace shortcuts, routed intent results, and recent intent commands inside the active workspace.

Member command searches should not surface audit logs, imports, jobs, tenant management, or parish-wide finance analytics.

## Intent Authorization

Intent detection is not authorization.

The router now selects registered actions by both intent and workspace. Shared intents can have separate actions:

- member Mass Intentions routes to member-safe `/portal/mass-intentions`
- pastoral/admin Mass Intentions route to operational pages
- member Contributions routes to personal contribution history
- finance/admin Contributions route to authorized finance surfaces

Member requests for parish-wide finance analytics return a permission-denied response instead of retrieving finance data.

## Data Scopes

The UI filtering is not a data boundary. RLS and backend authorization remain the primary data protection layer.

Kanisa AI uses these documented scopes:

- Member scope: current authenticated member and published/member-visible parish content
- Church scope: active church operational records where authorized
- Finance scope: active church financial records where authorized
- Pastoral scope: active church pastoral records where authorized
- Platform scope: Super Admin platform operations and Catholic CMS

## View As Member

Preview Member Experience must resolve `workspace = member`, even if the authenticated role is `admin` or `church_admin`.

The AI page and Command Center now consume the active workspace context, so preview mode receives member assistants, member capabilities, member prompts, and member routes.

## Provider-Required Behavior

Provider-required capabilities remain visible only where workspace-appropriate. Members do not see parish drafting tools such as Draft Homily. Authorized pastoral and church admin workspaces may see provider-required content drafting placeholders.

## Tests

`src/test/kanisa-ai-workspace-isolation.test.ts` covers:

- member assistant isolation
- member finance analytics denial
- finance capability isolation
- pastoral capability isolation
- super admin platform route ownership
- member preview context with admin role

## Remaining Technical Debt

- Command Center static command metadata should eventually be generated fully from the capability registry.
- More granular finance permissions can be layered into the resolver when role permission data is exposed uniformly.
- Retrieval handlers should continue to grow explicit scope checks as more cache-backed summaries are added.

## Conversational Layer

RC-2.5.0 adds `answerKanisaAIConversation`, which sits on top of the same workspace resolver, intent router, permission checks, and local/cache-first retrieval boundaries documented here.

The conversational page must continue to prefer `WorkspaceProvider` context over role-derived defaults, so Preview Member Experience receives member-scoped prompts, answers, actions, and routes.
