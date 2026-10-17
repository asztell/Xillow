import type { SearchResult, SortKey } from "@xillow/types";
import { Pagination } from "./Pagination";
import { ListingCards } from "./ListingCards";
import { SortSelect } from "./SortSelect";

export type ResultsStatus = "loading" | "error" | "empty" | "success";

/** Presentation-ready error: the message plus the offending field, if any. */
export interface ResultsError {
  message: string;
  field?: string;
}

interface ResultsProps {
  status: ResultsStatus;
  data?: SearchResult;
  error: ResultsError | null;
  isFetching: boolean;
  sort?: SortKey;
  onSortChange: (sort: SortKey) => void;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  /** Opens the detail overlay for a listing. */
  onSelect: (source: string, id: string) => void;
}

/** Renders the four states the brief calls for: loading, error, empty, success. */
export function Results({
  status,
  data,
  error,
  isFetching,
  sort,
  onSortChange,
  onRetry,
  onPageChange,
  onSelect,
}: ResultsProps) {
  if (status === "loading") {
    return (
      <p className="state" role="status">
        Loading listings…
      </p>
    );
  }

  if (status === "error") {
    const field = error?.field ? ` (${error.field})` : "";
    return (
      <div className="state state-error" role="alert">
        <p className="state-title">Something went wrong{field}.</p>
        <p className="state-detail">{error?.message ?? "Unknown error."}</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (status === "empty" || !data) {
    return (
      <p className="state" role="status">
        No listings match your search. Try widening your filters.
      </p>
    );
  }

  return (
    <section className="results" aria-label="Search results">
      <div className="results-header">
        <p className="results-meta" aria-live="polite">
          Showing {data.results.length} of {data.total} listings
          {isFetching ? " · updating…" : ""}
        </p>
        <SortSelect value={sort} onChange={onSortChange} disabled={isFetching} />
      </div>
      <ListingCards listings={data.results} onSelect={onSelect} />
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        hasPrev={data.hasPrev}
        hasNext={data.hasNext}
        busy={isFetching}
        onPageChange={onPageChange}
      />
    </section>
  );
}