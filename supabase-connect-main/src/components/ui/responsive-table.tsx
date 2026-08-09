import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ResponsiveTable({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("w-full overflow-x-auto rounded-lg border border-border/60 premium-scrollbar", className)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
