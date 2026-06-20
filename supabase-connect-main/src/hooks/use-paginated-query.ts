import { useCallback, useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 25;

type UsePaginatedQueryOptions = {
  pageSize?: number;
  totalCount?: number | null;
  resetKey?: string | number | null;
};

export function getPaginationRange(page: number, pageSize: number) {
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function usePaginatedQuery({
  pageSize = DEFAULT_PAGE_SIZE,
  totalCount = 0,
  resetKey,
}: UsePaginatedQueryOptions = {}) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const { from, to } = useMemo(() => getPaginationRange(page, pageSize), [page, pageSize]);
  const count = totalCount ?? 0;
  const hasPreviousPage = page > 0;
  const hasNextPage = (page + 1) * pageSize < count;

  const nextPage = useCallback(() => {
    setPage((current) => (current + 1) * pageSize < count ? current + 1 : current);
  }, [count, pageSize]);

  const previousPage = useCallback(() => {
    setPage((current) => Math.max(0, current - 1));
  }, []);

  return {
    page,
    pageSize,
    totalCount: count,
    from,
    to,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    setPage,
  };
}
