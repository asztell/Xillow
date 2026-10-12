interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  busy?: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  hasPrev,
  hasNext,
  busy = false,
  onPageChange,
}: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev || busy}
      >
        Previous
      </button>
      <span className="pagination-status" aria-live="polite">
        Page {page} of {Math.max(totalPages, 1)} · {total}{" "}
        {total === 1 ? "listing" : "listings"}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext || busy}
      >
        Next
      </button>
    </nav>
  );
}
