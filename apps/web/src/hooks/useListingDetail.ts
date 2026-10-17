import { useQuery } from "@tanstack/react-query";
import { fetchListingDetail } from "../api/client";

/**
 * Server-state hook for one listing and its cross-source siblings.
 *
 * `retry: false` keeps the 404/error state immediate so the modal can show it
 * straight away; the staleTime avoids refetching the same listing while the
 * modal is open and closed again.
 */
export function useListingDetail(source: string, id: string) {
  return useQuery({
    queryKey: ["listing", source, id],
    queryFn: ({ signal }) => fetchListingDetail(source, id, signal),
    retry: false,
    staleTime: 30_000,
  });
}
