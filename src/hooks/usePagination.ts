import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], pageSize = 12) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Reset to page 1 if items shrink below current page
  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage) setCurrentPage(safePage);

  const paginatedItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return {
    paginatedItems,
    currentPage: safePage,
    totalPages,
    totalItems: items.length,
    setCurrentPage,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}
