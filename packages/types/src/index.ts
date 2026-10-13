/**
 * Shared domain + API contract types.
 *
 * This is the single source of truth for the shapes that cross the API/UI
 * boundary. It is intentionally type-only (no runtime values) so that both the
 * Node API and the Vite UI can consume it as raw TypeScript source without a
 * build step or inter-package runtime coupling.
 */

export type ListingStatus = "active" | "pending" | "sold";

/** A property listing as returned by the repository / API. */
export interface Listing {
  id: string;
  source: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  latitude: number | null;
  longitude: number | null;
  /** ISO-8601 timestamp. */
  listedDate: string;
  status: string;
  description: string | null;
  /** Photo URLs as received from the source system; empty when none exist. */
  photos?: string[];
}

/** A sibling row from another source that appears to describe the same property. */
export interface DuplicateRef {
  id: string;
  source: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  /** ISO-8601 timestamp. */
  listedDate: string;
}

/**
 * Duplicate suspicion attached to a listing.
 *
 * We deliberately keep every source row in the result set (no collapsing): the
 * same home carried by two MLS feeds shows up twice, each annotated so the UI
 * can flag it. `total` therefore counts raw rows, not distinct properties.
 */
export interface DuplicateAnnotation {
  /** Stable id shared by every row in a suspected group; null when unique. */
  duplicateGroupId: string | null;
  /** The other rows that appear to describe the same property. */
  potentialDuplicates: DuplicateRef[];
  /** True for the newest `listedDate` in a group of two or more. */
  isPrimary: boolean;
}

/** A listing annotated with its relevance score and duplicate suspicion. */
export interface ScoredListing extends Listing, DuplicateAnnotation {
  score: number;
}

/** Sort orders supported by the listings API (all others are invalid). */
export type SortKey =
  | "recommended"
  | "price_desc"
  | "price_asc"
  | "newest"
  | "bedrooms_desc"
  | "bathrooms_desc"
  | "sqft_desc";

/** Validated, normalized search parameters. */
export interface SearchParams {
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  city?: string;
  keyword?: string;
  targetBudget?: number;
  sort?: SortKey;
  page: number;
  pageSize: number;
}

/** Paginated response body for `GET /api/listings`. */
export interface SearchResult {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  results: ScoredListing[];
}

/** Error body returned for 4xx/5xx responses. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}
