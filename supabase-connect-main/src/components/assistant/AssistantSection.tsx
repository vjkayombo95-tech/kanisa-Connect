import type { ReactNode } from "react";

type AssistantSectionProps = {
  title: string;
  children: ReactNode;
};

export function AssistantSection({ title, children }: AssistantSectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

