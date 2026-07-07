import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useScriptureReference } from "@/hooks/useScriptureLinks";
import type { BibleReferenceBook } from "@/lib/bible-reference-parser";
import { cn } from "@/lib/utils";

export type ScriptureLinkProps = {
  reference: string;
  books?: BibleReferenceBook[];
  className?: string;
  children?: ReactNode;
};

export function ScriptureLink({ reference, books: providedBooks, className, children }: ScriptureLinkProps) {
  const resolved = useScriptureReference(reference, providedBooks);

  if (!resolved) {
    return <>{children ?? reference}</>;
  }

  return (
    <Link
      to={resolved.href}
      aria-label={resolved.ariaLabel}
      className={cn(
        "cursor-pointer font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
    >
      {children ?? reference}
    </Link>
  );
}
