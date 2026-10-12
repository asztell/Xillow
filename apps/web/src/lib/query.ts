import type { SearchParams } from "@xillow/types";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** The applied search - the shape stored in the URL and sent to the API. */
export type ListingsQuery = SearchParams;

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
    page: readNumber(params, "page", { integer: true, min: 1 }) ?? DEFAULT_PAGE,
    pageSize:
      readNumber(params, "pageSize", { integer: true, min: 1, max: MAX_PAGE_SIZE }) ??
      DEFAULT_PAGE_SIZE,
  };
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
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  return params;
}

/** Identity of the *filters* only - used to decide when the form should reset. */
export function filtersKey(query: ListingsQuery): string {
  const params = toSearchParams(query);
  params.delete("page");
  params.delete("pageSize");
  return params.toString();
}
