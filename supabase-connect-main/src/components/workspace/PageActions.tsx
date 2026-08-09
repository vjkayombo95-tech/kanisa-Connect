import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";

import type { WorkspacePageAction } from "./page-context";
import { useWorkspacePage } from "./useWorkspacePage";

type PageActionsProps = {
  actions: WorkspacePageAction[];
  className?: string;
};

export function PageActions({ actions, className }: PageActionsProps) {
  const page = useWorkspacePage();
  const visibleActions = actions.filter((action) => {
    if (action.hidden) return false;
    if (!action.permission) return true;
    return page.permissions.has(action.permission);
  });

  if (!visibleActions.length) return null;

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      {visibleActions.map((action) => {
        const Icon = action.icon;
        const content = (
          <>
            {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
            {action.label}
          </>
        );

        if (action.to && !action.disabled) {
          return (
            <Button key={action.id} asChild variant={action.variant ?? "outline"} size="sm">
              <AppLink to={action.to}>{content}</AppLink>
            </Button>
          );
        }

        return (
          <Button
            key={action.id}
            type="button"
            variant={action.variant ?? "outline"}
            size="sm"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {content}
          </Button>
        );
      })}
    </div>
  );
}
