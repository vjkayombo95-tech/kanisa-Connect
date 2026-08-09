import type { ReactNode } from "react";

type BibleReadingLayoutProps = {
  children: ReactNode;
  aside?: ReactNode;
};

export function BibleReadingLayout({ children, aside }: BibleReadingLayoutProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <div className="min-w-0">{children}</div>
      {aside ? <aside className="hidden xl:block xl:sticky xl:top-28">{aside}</aside> : null}
    </div>
  );
}
