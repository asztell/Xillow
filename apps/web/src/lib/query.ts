import type { SearchParams, SortKey } from "@xillow/types";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/**
 * Accepted `sort` values, mirrored from `apps/api/src/lib/sorting.ts`. Declared
 * as an exhaustive record so dropping a member of the `SortKey` union here is a
 * compile error, keeping the runtime list and the type in lockstep.
 */
const SORT_KEY_SET = {
  recommended: true,
  price_desc: true,
  price_asc: true,
  newest: true,
  bedrooms_desc: true,
  bathrooms_desc: true,
  sqft_desc: true,
} satisfies Record<SortKey, true>;

export const SORT_KEYS = Object.keys(SORT_KEY_SET) as SortKey[];

/** The applied search - the shape stored in the URL and sent to the API. */
export type ListingsQuery = SearchParams & {
  /**
   * When set, the detail modal is open for this listing. Web-only: it travels in
   * the browser URL (so the modal is shareable and back-button friendly) but is
   * never sent to the API.
   */
  detail?: ListingRef;
};

/** A listing selected for the detail modal, keyed by its `(source, id)` pair. */
export interface ListingRef {
  source: string;
  id: string;
}

interface NumberOptions {
  integer?: boolean;
  min?: number;
  max?: number;
}

function readNumber(
  params: URLSearchParams,
  key: string,
  options: NumberOptions = {},
): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  if (options.integer && !Number.isInteger(value)) return undefined;
  if (options.min !== undefined && value < options.min) return undefined;
  if (options.max !== undefined && value > options.max) return undefined;
  return value;
}

function readString(params: URLSearchParams, key: string): string | undefined {
  const trimmed = params.get(key)?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Reads an applied query out of the URL, defensively: hand-edited or stale
 * values fall back to defaults rather than throwing. Malformed *combinations*
 * (e.g. minPrice > maxPrice) are left for the API to reject so the UI can
 * surface exactly the error a direct API caller would see.
 */
export function parseListingsQuery(params: URLSearchParams): ListingsQuery {
  return {
    minPrice: readNumber(params, "minPrice", { min: 0 }),
    maxPrice: readNumber(params, "maxPrice", { min: 0 }),
    minBedrooms: readNumber(params, "minBedrooms", { integer: true, min: 0 }),
    city: readString(params, "city"),
    keyword: readString(params, "keyword"),
    targetBudget: readNumber(params, "targetBudget", { min: 0 }),
    sort: readSort(params),
    page: readNumber(params, "page", { integer: true, min: 1 }) ?? DEFAULT_PAGE,
    pageSize:
      readNumber(params, "pageSize", { integer: true, min: 1, max: MAX_PAGE_SIZE }) ??
      DEFAULT_PAGE_SIZE,
    detail: readDetail(params),
  };
}

/** Reads the optional detail-modal selection (`listingSource` + `listingId`). */
function readDetail(params: URLSearchParams): ListingRef | undefined {
  const source = readString(params, "listingSource");
  const id = readString(params, "listingId");
  return source && id ? { source, id } : undefined;
}

/** Reads the `sort` param, dropping anything outside the whitelist. */
function readSort(params: URLSearchParams): SortKey | undefined {
  const raw = params.get("sort")?.trim();
  if (raw === undefined) return undefined;
  return (SORT_KEYS as readonly string[]).includes(raw) ? (raw as SortKey) : undefined;
}

/** Serializes an applied query to URL params in a stable, readable order. */
export function toSearchParams(query: ListingsQuery): URLSearchParams {
  const params = new URLSearchParams();
  const setNumber = (key: string, value: number | undefined) => {
    if (value !== undefined) params.set(key, String(value));
  };

  setNumber("minPrice", query.minPrice);
  setNumber("maxPrice", query.maxPrice);
  setNumber("minBedrooms", query.minBedrooms);
  if (query.city) params.set("city", query.city);
  if (query.keyword) params.set("keyword", query.keyword);
  setNumber("targetBudget", query.targetBudget);
  if (query.sort && query.sort !== "recommended") params.set("sort", query.sort);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  return params;
}

/**
 * Like `toSearchParams`, but also carries the web-only detail selection. Used
 * for the browser URL; the API request uses `toSearchParams` (search only).
 */
export function toUrlSearchParams(query: ListingsQuery): URLSearchParams {
  const params = toSearchParams(query);
  if (query.detail) {
    params.set("listingSource", query.detail.source);
    params.set("listingId", query.detail.id);
  }
  return params;
}

/** Identity of the *filters* only - used to decide when the form should reset. */
export function filtersKey(query: ListingsQuery): string {
  const params = toSearchParams(query);
  params.delete("page");
  params.delete("pageSize");
  params.delete("sort");
  return params.toString();
}
