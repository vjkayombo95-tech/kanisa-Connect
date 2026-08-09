# Known Issues

## Critical

No critical known issues are open at the time of the Pilot Edition documentation pack.

## High

- Live Supabase RLS, storage policies, and email delivery still require environment verification before the first parish pilot.
- Cross-role browser smoke tests should be run against the deployed pilot environment.

## Medium

- `CommunityLeaderLayout` remains outside the primary Workspace Framework and should be migrated or documented as a separate workspace.
- Some lower-traffic admin pages still use older empty/loading copy.
- Large vendor chunks remain for PDF, charts, XLSX, scanner, and export workflows.
- Browserlist data is stale and should be refreshed as part of dependency hygiene.

## Low

- Some legacy pages may still use inconsistent capitalization such as "Mass intentions" versus "Mass Intentions".
- Some table-heavy pages need final captions, headers, and screen-reader polish.
- A few older workflows still use generic button text such as "Create" where a more specific verb would be clearer.

## Future

- AI provider integrations are intentionally not included in v1.0.0 Pilot.
- Mobile app is not included in v1.0.0 Pilot.
- Website Builder is not included in v1.0.0 Pilot.
- Public API is not included in v1.0.0 Pilot.
