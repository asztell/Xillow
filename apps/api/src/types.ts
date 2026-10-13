/**
 * Re-exported from `@xillow/types` so the API and UI share one contract.
 *
 * The domain/API types now live in `packages/types`. This module is kept as a
 * thin, explicit re-export so existing `../types` imports stay stable.
 */
export type {
  ListingStatus,
  Listing,
  DuplicateRef,
  DuplicateAnnotation,
  ScoredListing,
  SearchParams,
  SearchResult,
  SortKey,
  ApiError,
} from "@xillow/types";
