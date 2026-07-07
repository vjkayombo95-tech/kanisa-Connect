# Performance Report

RC-24.3 focused on safe production optimizations without changing routes, APIs, business logic, database schema, or UI behavior.

## Largest Bundles Observed

The production build before this pass showed the heaviest assets around:

- Analytics PDF generation: `AnalyticsReportPdf` and `@react-pdf/renderer`.
- Spreadsheet import/export: `xlsx`.
- QR scanning: `react-qr-reader` and scanner dependencies.
- Charts: `recharts` and D3 internals.
- PDF/image export utilities: `jspdf` and `html2canvas`.

These are legitimate feature bundles, but they should stay isolated from ordinary dashboard, portal, and authentication startup paths.

## Optimizations Applied

- Added explicit Rollup manual chunks for heavy feature libraries:
  - `pdf-vendor`
  - `jspdf-vendor`
  - `html2canvas-vendor`
  - `xlsx-vendor`
  - `charts-vendor`
  - `qrcode-vendor`
  - existing `scanner-vendor`
- Lazy-loaded the QR scanner component inside the already lazy `/scan` route so the page shell can render before camera/scanner code hydrates.
- Added lazy image loading and async decoding to saint administration preview/list images that are not required for first paint.

## Expected Impact

- Lower JavaScript evaluation pressure on normal startup routes because heavy reporting, spreadsheet, chart, scanner, and QR libraries are isolated behind route or feature boundaries.
- Faster route transition perception on the QR scanner page because static page chrome can render before the scanner module finishes loading.
- Reduced image decode contention on low-end Android devices for saint administration screens.
- Better long-term cache behavior because large vendor libraries now have stable, feature-specific chunk names.

## Remaining Bottlenecks

- `@react-pdf/renderer` remains very large. It is lazy-loaded, but generating analytics PDFs will still be expensive on low-end devices.
- `xlsx` remains large. Keep spreadsheet workflows isolated to import/export screens.
- Charting libraries remain sizable. Avoid rendering charts on dashboard startup unless the user is on a chart-heavy screen.
- Scanner dependencies remain heavy by nature. The scanner route should remain isolated from normal member and admin navigation.
- Some pages still contain large components that would benefit from smaller subcomponents and tab-level lazy loading.
- Browserslist data is stale in the local build environment, which may affect generated browser targets until updated.

## Recommendations

- Keep all PDF, spreadsheet, scanner, and analytics features behind dynamic imports.
- Consider server-side PDF generation for analytics reports if mobile PDF generation feels slow during pilot testing.
- Split large admin pages by active tab when tabs contain independent heavy UI.
- Continue using route-level lazy loading for new workspace pages.
- Avoid importing `recharts`, `xlsx`, `jspdf`, `html2canvas`, `@react-pdf/renderer`, or scanner packages from shared layout/provider files.
- Collect field metrics during pilot testing for first contentful paint, interaction latency, and slow route transitions on low-end Android devices.
