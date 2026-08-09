# Performance Review

## Summary

Kanisa Connect is acceptable for controlled pilot deployment. The primary remaining performance work is bundle-size hygiene and browser smoke/load validation with realistic pilot data.

## Large Bundles

Known large vendor areas:

- PDF generation.
- Charts.
- XLSX import/export.
- Scanner/QR libraries.
- UI/motion vendor bundles.

These are currently accepted for v1.0 Pilot because they are isolated and feature-specific.

## Code Splitting

- Major route groups are lazy loaded.
- Heavy vendor chunks are separated in Vite config.
- Future work should lazy-load rarely used PDF/export tools more aggressively if pilot data shows slow first load.

## Lazy Loading

Route-level lazy loading is in place. Continue watching:

- Super Admin Catholic content pages.
- Finance reports and exports.
- Import tools.
- PDF-heavy reports.

## Dashboard Rendering

- Dashboards reuse existing hooks and React Query cache.
- Workspace shell remains unified.
- Personal Assistant and dashboard event intelligence avoid AI provider calls.

## Caching

- React Query is used throughout core data flows.
- Avoid adding duplicate direct Supabase calls where hooks already exist.
- Keep query keys stable and workspace-scoped.

## Duplicate Queries

No new duplicate query issue was introduced in deployment readiness work. Browser network review should be part of pilot smoke testing.

## Long-Running Operations

Monitor:

- Reports.
- Exports.
- Imports.
- Catholic content operations.
- Automation jobs.

## Recommendations

- Add Playwright smoke tests for dashboard route loads.
- Track dashboard and report load times during pilot.
- Review chunk warnings after pilot stabilization.
- Keep `VITE_ENABLE_PLEDGE_REALTIME=false` unless realtime load behavior has been tested.
