import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FilterToolbarProps = {
  children: ReactNode;
  resultCount: number;
  totalCount: number;
  onClear: () => void;
  actions?: ReactNode;
};

export function FilterToolbar({ children, resultCount, totalCount, onClear, actions }: FilterToolbarProps) {
  return (
    <Card className="glass-card">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{resultCount}</span> of{" "}
            <span className="font-medium text-foreground">{totalCount}</span> results
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onClear}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
            {actions}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
