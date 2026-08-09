# Error Handling and Logging

Kanisa Connect uses a shared application logger in `src/lib/error-logger.ts`.
Use it for production-safe diagnostics and consistent user-facing error messages.

## Logging Policy

- Use `logError(error, context)` for unexpected exceptions.
- Use `logSupabaseError(error, context)` for Supabase queries, RPCs, and storage calls.
- Use `logWarning(message, context)` for recoverable fallbacks or unusual states.
- Use `logInfo(message, context)` for important operational events.
- Use `logDebug(message, context)` only for development diagnostics. Debug logs are ignored in production and are not persisted.

Avoid direct `console.log`, `console.warn`, and `console.error` in application code. The shared logger prints useful details in development, records production-safe context, and avoids breaking user flows if logging fails.

## Error Categories

- Validation: show the specific validation message when it is safe and actionable.
- Network: tell the user to check their connection and try again.
- Permission: tell the user they do not have permission for the action.
- Session: ask the user to sign in again.
- Supabase/RPC/storage: log the technical details, then show a safe fallback message.
- Unexpected: log the exception and show a generic retry message.

## User-Facing Messages

Use `getUserFriendlyErrorMessage(error, fallback)` before showing errors in toasts, dialogs, or inline states.

Good messages are:

- Human-readable.
- Short and actionable.
- Free of SQL, RPC, table, bucket, stack, or policy details.
- Specific enough to help the user decide what to do next.

Example:

```ts
logSupabaseError(error, {
  component: "ContributionHistory",
  operation: "select",
  table: "contributions",
  church_id: churchId,
});

toast({
  title: "Unable to load contributions",
  description: getUserFriendlyErrorMessage(
    error,
    "Contribution history could not be loaded. Please try again.",
  ),
  variant: "destructive",
});
```

## React Query

For query failures:

- Log the failure in the query function or `onError`.
- Keep existing cache and fallback behavior unchanged.
- Prefer skeletons for loading and clear empty/error states for failure.

For mutation failures:

- Log the original error.
- Show a concise destructive toast or inline form error.
- Do not expose raw Supabase messages unless they are safe validation messages.

## Accessibility

- Error dialogs should receive focus when opened.
- Inline form errors should be associated with their input where practical.
- Toasts should use the existing toast system so assistive technologies receive announcements consistently.
- Do not rely on color alone to communicate an error.

## Production Behavior

Production logging must not:

- Expose service keys, tokens, stack traces, SQL, or private user data to end users.
- Block user actions if the logging endpoint fails.
- Persist debug-only diagnostics.
- Change business logic or retry behavior.

When adding new modules, wire errors through the shared logger first. That keeps diagnostics useful for support while keeping the member experience calm and readable.
