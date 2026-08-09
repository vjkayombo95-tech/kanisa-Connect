import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageActions } from "./PageActions";
import type { WorkspacePageAction } from "./page-context";
import { useWorkspacePage } from "./useWorkspacePage";

type PageToolbarProps = {
  title: string;
  description?: string;
  actions?: WorkspacePageAction[];
  className?: string;
};

export function PageToolbar({ title, description, actions = [], className }: PageToolbarProps) {
  const page = useWorkspacePage();
  const WorkspaceIcon = page.branding.icon;

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border/70 bg-card/90 p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <Badge variant="outline" className="w-fit gap-1.5 rounded-full">
            {WorkspaceIcon ? <WorkspaceIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {page.branding.badge}
          </Badge>
        </div>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <PageActions actions={actions} />
    </section>
  );
}
