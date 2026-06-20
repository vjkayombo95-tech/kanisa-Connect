export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: Response } | null)?.context;

  if (context && typeof context.clone === "function") {
    try {
      const body = await context.clone().json() as { error?: unknown; message?: unknown };
      const message = typeof body.error === "string" ? body.error : body.message;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text;
      } catch {
        // Use the standard error message below when the response cannot be read.
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
