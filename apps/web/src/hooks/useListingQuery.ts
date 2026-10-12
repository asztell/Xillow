import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  parseListingsQuery,
  toSearchParams,
  type ListingsQuery,
} from "../lib/query";

/**
 * Keeps the applied search in the URL query string.
 *
 * Reads and writes both go through React Router's `useSearchParams`, so router
 * navigation stays the single source of truth: results are shareable and the
 * browser back/forward buttons work. Writing pushes a new history entry by
 * default, so going back returns to the previous search.
 */
export function useListingQuery(): [
  ListingsQuery,
  (next: ListingsQuery) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();

  // `useSearchParams` memoizes its result by `location.search`, so this only
  // re-parses when the URL actually changes.
  const query = useMemo(
    () => parseListingsQuery(searchParams),
    [searchParams],
  );

  const setQuery = useCallback(
    (next: ListingsQuery) => setSearchParams(toSearchParams(next)),
    [setSearchParams],
  );

  return [query, setQuery];
}
