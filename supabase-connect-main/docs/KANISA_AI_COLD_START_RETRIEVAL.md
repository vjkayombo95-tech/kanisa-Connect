# Kanisa AI Cold-Start Retrieval

RC-2.8.1 fixes the UAT defect where Kanisa AI required a page cache to answer Catholic content questions.

## Observed Defect

In a fresh Member session, "Who is today's saint?" returned an implementation-facing empty state because the conversation engine only inspected React Query cache data.

## Retrieval Architecture

The conversation flow is now:

1. Detect intent.
2. Check workspace permissions.
3. Use valid local cache when available.
4. If cache is missing, call an existing authorized retrieval path.
5. Seed the same React Query cache key used by the existing formatter.
6. Return a direct structured answer.
7. Offer contextual preview and full-page navigation.

The synchronous formatter remains the single response renderer. `answerKanisaAIConversationAsync` performs cold-start retrieval first, then delegates to the same formatter.

## Supported Retrievers

- Saint of the Day: queries active Saints by today's feast month/day.
- Daily Readings: uses `fetchMemberCmsDailyReadingByDate`.
- Prayer Library: uses `fetchPublishedCmsPrayers` and member visibility filters.
- Events: uses `fetchParishCalendarFeed`, preserving audience targeting and recurrence behavior.
- Mass Intentions: resolves the authenticated member with `fetchMemberForUser`, then queries member-owned Mass intentions.
- Contributions: resolves the authenticated member with `fetchMemberForUser`, then queries member-owned contributions.

## Cache Policy

- Valid cache: use immediately.
- Missing cache: retrieve through an authorized service/query.
- Retrieval success: populate the existing cache key used by the formatter.
- Retrieval empty: return an honest member-facing empty state.
- Retrieval error: return a localized friendly error with Retry.

Cache state, adapter names, Supabase errors, and internal query keys are not shown to normal users.

## Security Model

Cold-start retrieval does not use service-role keys and does not bypass RLS.

Member financial and pastoral data stays member-owned:

- Mass intentions filter by the resolved member id and church id.
- Contributions filter by the resolved member id and church id.
- Events use the existing calendar feed, which includes event audience targeting, recurrence expansion, and approved request calendar rules.
- Catholic CMS content uses published/member-visible filters.

## Content Language

Interface labels follow the active UI language. Authored content remains in its stored language and is not machine-translated.

Daily Readings preserve the language preference through the existing localized content selection helper.

## Loading And Retry

The Kanisa AI page now awaits the async retrieval path before posting the assistant message. The user message appears immediately, the existing loading state remains visible, and the assistant message is added once retrieval completes.

Recoverable retrieval failures return a Retry action that resubmits the same question.

## Known Limitations

- Saint retrieval matches today's feast date from the current browser date.
- Prayer search still uses deterministic text matching, not semantic AI search.
- Follow-up memory remains limited to the current in-memory conversation.
