import type { SortKey } from "@xillow/types";
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { ListingApiError } from "./api/client";
import { ListingDetailModal } from "./components/ListingDetailModal";
import { Results, type ResultsError } from "./components/Results";
import { SearchForm } from "./components/SearchForm";
import { ThemeToggle } from "./components/ThemeToggle";
import { useListings } from "./hooks/useListings";
import { useListingQuery } from "./hooks/useListingQuery";
import { filtersKey } from "./lib/query";

/**
 * Maps a thrown error onto the view-facing shape `Results` renders. Keeping the
 * `instanceof ListingApiError` check here means the presentation component has
 * no dependency on the API client.
 */
function toResultsError(error: Error | null): ResultsError | null {
  if (!error) return null;
  return {
    message: error.message,
    field: error instanceof ListingApiError ? error.field : undefined,
  };
}

export default function App() {
  const [query, setQuery] = useListingQuery();
  const listings = useListings(query);
  const navigate = useNavigate();
  const location = useLocation();

  const status = listings.isPending
    ? "loading"
    : listings.isError
      ? "error"
      : listings.data && listings.data.total > 0
        ? "success"
        : "empty";

  // Changing the sort is a new search: land on the first page.
  const handleSortChange = (sort: SortKey) =>
    setQuery({ ...query, sort, page: 1 });

  // The detail modal lives in the URL (`listingSource`/`listingId`) so it is
  // shareable and back-button friendly, and the grid stays mounted behind it.
  const detail = query.detail ?? null;

  const openDetail = useCallback(
    (source: string, id: string) =>
      // Push from the grid so Back closes the modal; replace when switching to
      // a sibling listing inside it, so one modal session is one history entry.
      setQuery(
        { ...query, detail: { source, id } },
        { replace: query.detail !== undefined },
      ),
    [query, setQuery],
  );

  const closeDetail = useCallback(() => {
    if (location.key === "default") {
      // Deep link: there is no in-app entry to go back to, so clear the param.
      setQuery({ ...query, detail: undefined }, { replace: true });
    } else {
      void navigate(-1);
    }
  }, [location.key, navigate, query, setQuery]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <h1>Xillow</h1>
          <ThemeToggle />
        </div>
        <p className="app-tagline">
          Search property listings across multiple MLS feeds.
        </p>
      </header>

      {/* Remount when the applied filters change so the draft tracks the URL
          (e.g. browser back/forward), without resetting on page changes. */}
      <SearchForm
        key={filtersKey(query)}
        query={query}
        onSubmit={setQuery}
        disabled={listings.isFetching}
      />

      <Results
        status={status}
        data={listings.data}
        error={toResultsError(listings.error)}
        isFetching={listings.isFetching}
        sort={query.sort}
        onSortChange={handleSortChange}
        onRetry={() => void listings.refetch()}
        onPageChange={(page) => setQuery({ ...query, page })}
        onSelect={openDetail}
      />

      {detail && (
        <ListingDetailModal
          source={detail.source}
          id={detail.id}
          onSelect={openDetail}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}
