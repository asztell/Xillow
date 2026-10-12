import type { SearchResult } from "@xillow/types";
import { ListingApiError } from "../api/client";
import { Pagination } from "./Pagination";
import { ResultsTable } from "./ResultsTable";

export type ResultsStatus = "loading" | "error" | "empty" | "success";

interface ResultsProps {
  status: ResultsStatus;
  data?: SearchResult;
  error: Error | null;
  isFetching: boolean;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}

/** Renders the four states the brief calls for: loading, error, empty, success. */
export function Results({
  status,
  data,
  error,
  isFetching,
  onRetry,
  onPageChange,
}: ResultsProps) {
  if (status === "loading") {
    return (
      <p className="state" role="status">
        Loading listings…
      </p>
    );
  }

  if (status === "error") {
    const field =
      error instanceof ListingApiError && error.field ? ` (${error.field})` : "";
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
      <p className="results-meta" aria-live="polite">
        Showing {data.results.length} of {data.total} listings
        {isFetching ? " · updating…" : ""}
      </p>
      <ResultsTable listings={data.results} />
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
