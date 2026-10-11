/**
 * Shared domain types for the Listing Search Service.
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
}

/** A listing annotated with its computed relevance score (0..1). */
export interface ScoredListing extends Listing {
  score: number;
}

/** Validated, normalized search parameters. */
export interface SearchParams {
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  city?: string;
  keyword?: string;
  targetBudget?: number;
  page: number;
  pageSize: number;
}

/** Paginated response body for `GET /listings`. */
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
