import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchListings } from "../api/client";
import { toSearchParams, type ListingsQuery } from "../lib/query";

/**
 * Server-state hook for a search.
 *
 * The search params (not the web-only detail selection) form the cache key, so
 * opening or closing the detail modal never refetches the grid. Changing any
 * filter or the page fetches a fresh page. `keepPreviousData` keeps the current
 * page on screen while the next loads (no flicker on pagination). `retry: false`
 * keeps the error state immediate and predictable; the UI offers a manual retry.
 */
export function useListings(query: ListingsQuery) {
  return useQuery({
    queryKey: ["listings", toSearchParams(query).toString()],
    queryFn: ({ signal }) => fetchListings(query, signal),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });
}
