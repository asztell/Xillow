import { SearchParams, SearchResult } from "../types";
import { ListingRepository } from "../repositories/listingRepository";
import { rankListings } from "./scoring";
import { sortListings } from "./sorting";

export interface SearchOptions {
  /** Reference "now" - injectable for deterministic tests. */
  now?: Date;
}

/**
 * Runs a search: the repository returns the newest listing of each duplicate
 * group (already filtered to the requested criteria), which is then ranked by
 * relevance and sliced into the requested page.
 *
 * Because the representative is chosen *before* filtering, a filter applies to
 * the property's most recent listing: a price range that excludes the newest
 * sibling hides the property entirely rather than surfacing an older one, and
 * `total` counts the deduplicated properties shown.
 *
 * Ranking is done in application code (rather than SQL) so the scoring rules
 * stay in one easily testable place. See README for the trade-off at scale.
 */
export async function searchListings(
  repo: ListingRepository,
  params: SearchParams,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const listings = await repo.find({
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minBedrooms: params.minBedrooms,
    city: params.city,
    keyword: params.keyword,
  });

  const scored = rankListings(listings, {
    targetBudget: params.targetBudget,
    now: options.now,
  });

  // Apply the requested sort before paginating so every page reflects the same
  // global order. "Recommended" (and an absent sort) is already the relevance
  // order produced above, so re-sorting it would only do the work twice.
  const sorted =
    params.sort && params.sort !== "recommended"
      ? sortListings(scored, params.sort)
      : scored;

  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize);
  const start = (params.page - 1) * params.pageSize;
  const results = sorted.slice(start, start + params.pageSize);

  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
    results,
  };
}
