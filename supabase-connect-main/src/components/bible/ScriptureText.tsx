import { Link } from "react-router-dom";

import { useScriptureLinks } from "@/hooks/useScriptureLinks";
import type { BibleReferenceBook } from "@/lib/bible-reference-parser";
import { cn } from "@/lib/utils";

type ScriptureTextProps = {
  text: string | null | undefined;
  books?: BibleReferenceBook[];
  className?: string;
};

export function ScriptureText({ text, books: providedBooks, className }: ScriptureTextProps) {
  const content = text ?? "";
  const parts = useScriptureLinks(content, providedBooks);

  if (!content) return null;

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.type === "reference" ? (
          <Link
            key={`${part.value}-${index}`}
            to={part.href}
            aria-label={part.ariaLabel}
            className={cn(
              "cursor-pointer font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            )}
          >
            {part.value}
          </Link>
        ) : (
          <span key={`${part.value}-${index}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}
