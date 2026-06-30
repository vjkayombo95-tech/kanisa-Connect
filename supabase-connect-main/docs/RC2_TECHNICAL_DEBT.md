# RC-2 Technical Debt Backlog

This backlog captures work intentionally deferred from the RC-1.2 production gate.

## TypeScript Strictness

- Restore `@typescript-eslint/no-explicit-any` from warning to error.
- Replace broad `any` usage with domain interfaces, Supabase generated types, `unknown`, and typed RPC result shapes.
- Highest-noise areas:
  - `src/pages/church-admin/ContributionsPage.tsx`
  - `src/pages/church-admin/MassIntentionsPage.tsx`
  - `src/pages/church-admin/CommunitiesPage.tsx`
  - `src/components/channels/ChannelWorkspace.tsx`
  - `src/contexts/AuthContext.tsx`
  - `src/hooks/use-church-data.ts`

## Fast Refresh Hygiene

- Split non-component exports from component files flagged by `react-refresh/only-export-components`.
- Move shared constants, helpers, and variant definitions into sibling utility files.

## Console Logging

- Finish replacing legacy fallback `console.warn` calls with `logWarning()` or DEV-only diagnostics.
- Keep `console.error` only for fatal bootstrap failures or error-boundary-level diagnostics.

## Bundle Follow-Up

- Continue splitting admin-only analytics and scanner dependencies.
- Consider a dedicated lazy route boundary for QR/scanner flows.
- Consider replacing the large PDF renderer path with an on-demand worker or server-side export later.

## Typing Infrastructure

- Regenerate and wire complete Supabase database types.
- Add typed wrappers for frequently-used RPCs.
- Add shared row types for church admin finance, member portal, and Catholic CMS workflows.
