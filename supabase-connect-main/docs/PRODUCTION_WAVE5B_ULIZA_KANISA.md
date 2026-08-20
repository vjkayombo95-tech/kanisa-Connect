# Production Wave 5B: Uliza Kanisa

Wave 5B is an in-app, deterministic member service guide. It does not call a model provider, accept unrestricted database questions, or expose staff operations.

## Scope classification

- Safe member intents: own contribution total, contribution history, Mass intentions and timetable, announcements, prayers, reflections, Bible, daily readings, saints, parish calendar, and basic parish information.
- Navigation-only: giving, contribution history, Mass intentions, Mass timetable, announcements, prayers, reflections, Bible, daily readings, saints, calendar, Radio, and Live Mass.
- Data-read: authenticated member's own contribution total only.
- Sensitive staff intents excluded: church-wide finance, multi-member contributions, member roster analytics, operational dashboards, prayer-request aggregates, PDF reports, and administrative data.
- Unsupported/deferred: free-form theological answers, unrestricted natural-language queries, model-backed answers, WhatsApp, provider integrations, and staff routes.

## Feature behavior

The existing `kanisa_ai` feature key is used. The member service and direct route require an explicit enabled `church_features` row for the resolved church. Loading, missing feature metadata, missing church context, or a missing/disabled church override all fail closed. The release does not enable any church.

## Authorized data-read contract

QUERY:
`contributions.select("amount")` through the existing `fetchMemberContributionTotal` helper.

TENANT FILTER:
`church_id = resolved authenticated churchId`.

MEMBER FILTER:
`member_id = id returned by useLinkedMember for the authenticated user`.

RLS:
Final authority. No service-role browser access and no new RPC are introduced.

EXPECTED EMPTY STATE:
`Hakuna michango iliyorekodiwa kwenye akaunti yako kwa sasa.`

The assistant does not parse, accept, or forward a caller-supplied member ID. Errors return a fixed safe message without database details.

## Radio and Live Mass

Radio navigation is returned only when the existing effective Radio feature state is visible. Resolving the intent does not create media. Live Mass navigation is returned only when the existing authorized livestream hook reports an available stream. Wave 5B does not change either media architecture.
