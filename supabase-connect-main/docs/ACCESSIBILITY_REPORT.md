# Accessibility and UX Consistency Report

RC-24.4 reviewed the application shell, workspace framework, dashboards, member portal pages, church administration pages, finance surfaces, pastoral workflows, super admin pages, and shared UI primitives.

This pass intentionally avoided business logic, routes, Supabase, migrations, RPCs, authentication, payments, and importer behavior.

## Fixes Applied

- Restored visible keyboard focus across interactive elements.
- Added consistent `focus-visible` treatment for links, buttons, form fields, and custom interactive elements.
- Preserved reduced-motion preferences for premium card/button hover transforms.
- Marked shared skeleton loaders as decorative with `aria-hidden`.
- Added an accessible label to toast close buttons.
- Added `aria-current="page"` to shared church admin sidebar links.
- Added collapsed sidebar labels so icon-only collapsed navigation remains understandable to screen readers.
- Added workspace-level skip link to main content.
- Added `aria-current="page"` and navigation labelling to the workspace navigation framework.
- Connected dashboard sections to their headings through `aria-labelledby`.
- Added accessible alt text to member photo previews.
- Added accessible names to icon-only remove buttons in member/community management flows.

## Issues Found

### Keyboard Navigation

- Most Radix-based dialogs, sheets, dropdowns, selects, and toast components provide good keyboard foundations.
- Several custom card/action patterns are links styled as cards. These are keyboard reachable, but future custom interactive cards should preserve link/button semantics.
- Some legacy pages still use icon-only controls that need explicit `aria-label` review.

### Focus Visibility

- A global rule previously removed native focus indicators from inputs, selects, and textareas.
- Shared focus-visible styling has been restored, but a future visual QA pass should check focus rings against every dark and gold surface.

### Forms and Search

- Many forms use visible labels, but several older compact forms still rely heavily on placeholder text or labels without `htmlFor`/`id` pairing.
- Search fields should consistently use visible labels or `aria-label` when the label is visually hidden.

### Dialogs and Drawers

- Shared Radix dialog/sheet components provide focus trapping and escape behavior.
- Long dialogs should continue using internal scrolling and clear titles/descriptions.
- Destructive confirmations should maintain a clear cancel action and focus return.

### Tables

- Tables use semantic table primitives.
- Many data tables do not yet include captions or explicit descriptions.
- Some action columns have blank headers; these should use visually hidden text such as "Actions".
- Wide tables should continue to use horizontal scrolling on mobile.

### Loading, Empty, and Error States

- Skeletons are widely used and are now hidden from assistive tech by default.
- Loading text remains inconsistent across some legacy admin pages.
- Empty states exist on most major tables, but tone and action guidance vary.
- Error states should continue moving toward the shared error handling standard from RC-24.2.

### Color and Contrast

- Primary gold on dark surfaces is generally strong.
- Muted foreground text can be low contrast in dense cards and tables.
- Destructive buttons and badges should be checked in both normal and hover/focus states.
- Disabled controls rely mostly on opacity; verify contrast during final QA.

### Responsive UX

- Workspaces and dashboards use responsive grids and mobile navigation.
- Large tables remain the main 320px and 375px risk.
- Calendar, Bible reader, contribution history, reports, and data import screens should be included in real-device mobile QA.

## Workspace Notes

- Member: dashboard, Bible, daily readings, saints, prayer, reflection, giving, contribution history, receipts, events, announcements, and calendar have consistent page-level structure, but table/action accessibility needs continued review.
- Pastoral: workflow-driven pages benefit from shared status badges and cards; future action bars should keep button labels explicit.
- Church Administration: most dense tables work semantically, but action columns and icon-only controls need cleanup over time.
- Finance: report and contribution screens are table-heavy and should receive captions, action headers, and mobile table QA.
- Super Admin: import, CMS, audit, logs, and analytics pages are complex; they need the most manual keyboard and screen reader testing.

## Accessibility Checklist

- Keyboard: all controls reachable with Tab and operable with Enter/Space.
- Focus: visible focus ring on links, buttons, fields, tabs, menus, and dialogs.
- Navigation: current page indicated with `aria-current` where applicable.
- Structure: one clear page title and logical section headings.
- Forms: labels associated with inputs; errors announced or linked to fields.
- Buttons: icon-only controls have accessible names.
- Tables: headers, captions/descriptions, action column labels, and mobile overflow.
- Dialogs: title, description, focus trap, escape close, and focus return.
- Loading: skeletons decorative; meaningful loading/error text where needed.
- Color: contrast checked for text, disabled controls, status badges, and destructive states.
- Motion: reduced-motion preference respected for decorative animation.

## WCAG-Related Notes

- Focus visibility improvements support WCAG 2.4.7.
- Skip link support improves bypass navigation for WCAG 2.4.1.
- `aria-current` improvements support orientation and current-location awareness.
- Skeleton `aria-hidden` avoids noisy decorative announcements.
- Icon-button labels support accessible name requirements for WCAG 4.1.2.
- Continued label/input association work is needed for full WCAG 1.3.1 and 3.3.2 coverage.

## Remaining Recommendations

- Run automated axe checks on representative routes in every workspace.
- Perform manual keyboard testing at 320px, 375px, 768px, 1024px, and 1440px.
- Add captions or `aria-label`/`aria-describedby` to major tables.
- Replace blank table action headers with visually hidden "Actions" labels.
- Continue adding `aria-label` to legacy icon-only buttons.
- Standardize form field `id` and `htmlFor` usage in older pages.
- Review muted text contrast on dense cards and tables.
- Verify dark-mode contrast if alternate themes are enabled.
- Test VoiceOver/TalkBack on the member portal, contribution flow, calendar, Bible reader, and admin tables.
