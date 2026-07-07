# Kanisa AI Contextual Previews

RC-2.8.0 changes Kanisa AI from route-first discovery to answer-first retrieval.

## Answer Hierarchy

Kanisa AI should respond in this order:

1. Direct answer from authorized local data.
2. Contextual preview inside the Kanisa AI conversation.
3. Full workspace page navigation when the user wants the complete record.

The preview layer does not call an external AI provider and does not bypass workspace authorization. It uses the same React Query cache, cold-start retrieval policy, and deterministic route policy as the existing conversation engine.

Cold-start retrieval is documented in [Kanisa AI Cold-Start Retrieval](KANISA_AI_COLD_START_RETRIEVAL.md). Cache is an optimization, not a prerequisite for answers.

## Preview Types

`KanisaAIConversationPreview` supports:

- `saint`
- `prayer`
- `daily_reading`
- `event`
- `mass_intention`
- `contribution_summary`

The preview model is reusable and rendered by `KanisaAIPreviewDialog`.

## Saint Answers

For "Who is today's saint?", Kanisa AI checks the existing `saint-of-day` cache. When a saint is available, the answer includes:

- saint name
- feast day
- patronage
- category or rank when available
- short biography or summary
- preview action
- full saint page action

If the cache does not contain a saint, Kanisa AI queries the authorized Saints source for today's feast date. If no published saint exists for today, it returns an honest empty state and offers the Saints page. It does not invent saint data.

## Other Contextual Answers

Daily Readings, Prayer Library matches, upcoming authorized Events, Mass Intentions, and Contribution summaries now expose preview actions when the current workspace cache contains eligible data.

Member-only data remains member-scoped:

- Mass intentions use `my-mass-intentions` for members.
- Contributions use `my-contributions` for members.
- Parish calendar events use the authorized `parish-calendar-events` cache for the active workspace.

## Navigation

Preview actions stay inside the conversation. Full-page actions use the existing workspace-owned routes:

- `/portal/...`
- `/church-admin/...`
- `/pastoral/...`
- `/finance/...`
- `/super-admin/...`

## Provider Boundary

Generative prompts still return provider-required states until a Kanisa AI provider is configured. Contextual previews only summarize data already loaded into authorized Kanisa Connect surfaces.
