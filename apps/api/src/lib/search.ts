import { SearchParams, SearchResult } from "../types";
import { ListingRepository } from "../repositories/listingRepository";
import { annotateDuplicates } from "./dedupe";
import { rankListings } from "./scoring";

export interface SearchOptions {
  /** Reference "now" - injectable for deterministic tests. */
  now?: Date;
}

/**
 * Runs a search: filters via the repository, annotates likely duplicates, ranks
 * the matches by relevance, then slices out the requested page.
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

  // Duplicates are annotated, not removed: every source row is ranked and
  // returned, and `total` keeps counting raw rows.
  const annotated = annotateDuplicates(listings);

  const ranked = rankListings(annotated, {
    targetBudget: params.targetBudget,
    now: options.now,
  });

  const total = ranked.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize);
  const start = (params.page - 1) * params.pageSize;
  const results = ranked.slice(start, start + params.pageSize);

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
