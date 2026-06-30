# RC-1.2 Production Gate Report

## Verification Commands

- `npm run lint`: passes with warnings.
- `npm run build`: passes.

## Critical Lint Scope

Fixed or downgraded according to RC-1.2 scope:

- React Hook dependency warnings were addressed in touched critical paths.
- `no-constant-binary-expression` was fixed in `PortalHome.tsx`.
- Empty interface lint blockers were fixed in shared UI components.
- CommonJS Tailwind plugin import was replaced with ESM.
- `no-explicit-any` was moved to warning for RC-1 and tracked in `docs/RC2_TECHNICAL_DEBT.md`.

## Bundle Notes

- `xlsx` is dynamically imported by the Catholic Saints importer and emitted as a separate chunk.
- `jspdf` is dynamically imported by Mass Intentions PDF generation and emitted as a separate chunk.
- `AnalyticsReportPdf` is dynamically imported through the analytics assistant export path and emitted as an admin-only chunk.
- Recharts remains split into chart-related chunks; member portal contribution charts are lazy-loaded.
- Scanner/QR flows remain route-level/admin-flow chunks and are not part of the primary member dashboard route.

## Smoke Test Coverage

Static and build-gate verification was performed for:

- Authentication route/build coverage.
- Invitation flow files compile.
- Member portal routes compile.
- Catholic Library routes compile.
- Daily Readings route compiles.
- Church Admin routes compile.
- Super Admin Catholic CMS routes compile.
- Saint import code compiles and keeps `xlsx` lazy-loaded.
- Payments and contribution pages compile.
- Offline sync manager compiles.
- Notifications routes compile.

Manual browser execution was not performed in this pass.

## Remaining Risks

- Several legacy fallback `console.warn` calls remain and should be finished before final production hardening.
- `no-explicit-any` remains as warnings for RC-1 and must return to error in RC-2.
- Large admin-only PDF/chart chunks remain, though they are not initial member dashboard code.
- Full manual smoke testing with real staging credentials is still required.

## Recommendation

RC-1.2 is suitable for staging verification after the remaining production console warnings are reviewed. Final production release should wait for manual browser smoke testing.
