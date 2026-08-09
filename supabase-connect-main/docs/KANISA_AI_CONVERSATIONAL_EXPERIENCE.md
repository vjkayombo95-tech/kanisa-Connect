# Kanisa AI Conversational Experience

## Previous UX Problem

Kanisa AI had workspace isolation and assistant discovery, but the page still behaved like a directory. Users could inspect assistant cards and capabilities, but there was no obvious primary place to ask questions and receive an answer.

## Architecture Audit

Current reusable infrastructure:

- `classifyKanisaIntent` detects deterministic intents.
- `resolveKanisaAIExperience` resolves workspace-specific assistants, capabilities, prompts, actions, and routes.
- `decideKanisaAIRoute` authorizes an intent in the active workspace.
- `routeKanisaAIRequest` handles navigation, permission denial, provider-required placeholders, and cache-first summaries.
- React Query caches already hold readings, prayers, calendar events, contributions, invitations, and Mass intention data after pages load.
- `KanisaCommandCenter` remains optimized for fast navigation and command execution.

The gap was rendering. Results were not presented as a conversation with structured sections, actions, empty states, and follow-up affordances.

## Conversational Request Flow

Question

Conversation composer

User message

Intent detection

Workspace context

Permission check

Cache or local route lookup

Structured response

Actions and suggested follow-up

## Response Model

`KanisaAIConversationResponse` includes:

- `id`
- `intent`
- `status`
- `title`
- `summary`
- `message`
- `sections`
- `actions`
- `suggestions`
- `sourceType`
- `providerRequired`

Supported statuses:

- `success`
- `empty`
- `unavailable`
- `unauthorized`
- `provider_required`
- `error`

## Local And Cache-First Answers

The conversation engine answers from existing local data and capabilities. It does not call an AI provider.

RC-2.8.1 adds cold-start retrieval, so cache is no longer a prerequisite for these answers. When the cache is empty, `answerKanisaAIConversationAsync` uses an existing authorized retrieval path, seeds the appropriate cache key, and then renders the same structured response.

Implemented local/cache-first answer types:

- Today's Saint from `saint-of-day`
- Daily Readings from `member-cms-daily-reading`
- Prayer Library results from `member-catholic-library-prayers`
- Parish Calendar summaries from `parish-calendar-events`
- Member contribution summaries from `my-contributions`
- Finance/admin contribution summaries from `contributions`
- Member Mass intentions from `my-mass-intentions`
- Admin/pastoral Mass intentions from `mass-intentions-admin`
- Church Admin pending invitations from `church-invitations`
- Super Admin platform navigation for system jobs and Catholic CMS/import surfaces

If local cache is empty, the response returns an `empty` state with a relevant workspace action.

## Contextual Preview Layer

RC-2.8.0 adds a reusable preview layer documented in [Kanisa AI Contextual Previews](KANISA_AI_CONTEXTUAL_PREVIEWS.md).
RC-2.8.1 adds the cold-start retrieval policy documented in [Kanisa AI Cold-Start Retrieval](KANISA_AI_COLD_START_RETRIEVAL.md).

The conversation answer hierarchy is:

- direct answer from authorized local data
- contextual preview modal
- full workspace page navigation

Preview payloads are carried on `KanisaAIConversationAction.preview` or section items. The UI renders them through `KanisaAIPreviewDialog`, so saints, prayers, daily readings, events, Mass intentions, and contribution summaries share one preview architecture.

The "Who is today's saint?" flow no longer falls through to the generic `Ready to Open` module card. It answers with the saint's name, feast day, patronage, category/rank, and summary when content is available, then offers preview and full-page actions.

## Workspace-Specific Prompts

The page uses prompts from `resolveKanisaAIExperience`, so prompt behavior stays aligned with workspace capability resolution.

Examples:

- Member: readings, healing prayers, events, contributions, Mass intentions, saints
- Church Admin: parish priorities, invitations, events, prayer requests, giving trends, Mass intentions
- Finance: giving trends, pledge completion, financial reports
- Pastoral: prayer requests, Mass intentions, sacraments
- Super Admin: content health, Daily Readings Manager, system jobs, import status

## English/Kiswahili Interface Localization

The conversational interface is wired into the shared localization foundation documented in [English/Kiswahili Localization Foundation](LOCALIZATION_EN_SW.md).

Kanisa AI receives the active interface language through `KanisaAIContext.language`, renders its interface through `src/locales/en.json` and `src/locales/sw.json`, and recognizes core Kiswahili deterministic intents without calling an AI provider.

RC-2.6.1 localizes the deterministic response chrome for member-facing Daily Readings, Prayer Library, Calendar, Contributions, and Mass Intentions responses. Authored Catholic content returned from cache remains in its stored content language.

Interface language remains separate from Catholic CMS content language.

## Structured Result Rendering

The Kanisa AI Home renders:

- metrics
- item lists
- metadata
- status badges
- workspace-safe action buttons
- provider-required states
- unauthorized/unavailable states

Assistant cards remain below the conversation as secondary discovery content.

## Action Routing

Actions use workspace-owned routes:

- Member actions use `/portal/...`
- Church Admin actions use `/church-admin/...`
- Finance actions use `/finance/...`
- Pastoral actions use `/pastoral/...`
- Super Admin actions use `/super-admin/...`

Members do not receive Church Admin routes. Super Admin platform actions do not route through Church Admin.

## Follow-Up Limitations

The conversation is deterministic and provider-free. It supports current-page session continuity and structured local responses, but it does not provide semantic memory.

Examples:

- Asking for readings can return readings and actions.
- Follow-up like "Open the Gospel" should be handled as navigation or a clear available action when supported.
- "Show another" for prayers is future work unless the current cache result supports alternate local matches.

## Provider-Required Behavior

Generative requests such as drafting homilies, reflections, newsletters, or deep explanations return `provider_required`.

Kanisa AI does not fabricate generated text and does not present templates as AI output.

## Authorization

Conversation answers reuse the same intent routing and permission model as RC-2.4.0.

Example:

- Member "Show my contributions" is allowed and routes to personal contribution history.
- Member "Show parish giving trends" returns unauthorized and suggests personal contributions.
- Member "Open audit logs" returns unavailable in Member Workspace.

## Empty, Error, And Loading States

Empty cache data returns a friendly empty state and action.

Unexpected errors return a safe retry message without raw Supabase errors, SQL, stack traces, or internal function names.

The UI displays a short processing state while deterministic local routing runs.

Cold-start retrieval errors include a Retry action that resubmits the same user question.

## Conversation Persistence Boundary

Conversation messages are in-memory only for this sprint.

No database chat history, schema, or persistence was added.

## Command Center Distinction

Command Center is for fast navigation and command execution.

Kanisa AI Home is for conversational questions, structured answers, follow-up actions, and workspace-aware retrieval.

Both reuse shared AI routing and workspace resolution.

## Testing

`src/test/kanisa-ai-conversation.test.ts` covers:

- empty submission response
- user and assistant message creation
- Today's Saint cache answer and preview action
- Daily Readings cache answer
- Prayer Library member-visible results
- Mass Intention preview action
- Contribution summary preview action
- member-safe contribution routing
- parish-wide finance denial for members
- provider-required generation
- Super Admin system jobs route ownership
- platform request blocking in Member Workspace

RC-2.4.0 workspace isolation tests remain in place.

## Remaining Technical Debt

- Add richer follow-up handling for "show another" and previous-result-specific actions.
- Expand cache adapters for more dashboard-specific operational summaries.
- Generate Command Center static metadata fully from the capability registry.
- Add persisted conversation history only after privacy and retention requirements are defined.
