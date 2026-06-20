import { Button } from "@/components/ui/button";

type PaginationFooterProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  previousPage: () => void;
  nextPage: () => void;
  isLoading?: boolean;
};

export function PaginationFooter({
  page,
  pageSize,
  totalCount,
  hasPreviousPage,
  hasNextPage,
  previousPage,
  nextPage,
  isLoading = false,
}: PaginationFooterProps) {
  const start = totalCount === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalCount, (page + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {start}-{end} of {totalCount}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={previousPage} disabled={!hasPreviousPage || isLoading}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={nextPage} disabled={!hasNextPage || isLoading}>
          Next
        </Button>
      </div>
    </div>
  );
}
