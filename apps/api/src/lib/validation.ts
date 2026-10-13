import { SearchParams, SortKey } from "../types";
import { SORT_KEYS, isSortKey } from "./sorting";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export interface ValidationSuccess {
  ok: true;
  params: SearchParams;
}

export interface ValidationFailure {
  ok: false;
  code: "INVALID_QUERY";
  message: string;
  field: string;
}

export type ParseResult = ValidationSuccess | ValidationFailure;

type RawValue =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "value"; value: string };

/** Outcome of reading one field: the normalized value or the first failure. */
type Read<T> = { ok: true; value: T } | { ok: false; failure: ValidationFailure };

/**
 * Normalizes a raw query value. Empty/whitespace-only strings count as absent
 * so that `?city=` behaves the same as omitting the parameter. Repeated
 * parameters (`?page=1&page=2`) arrive as arrays and are rejected explicitly
 * rather than silently taking one of the values.
 */
function readRaw(value: unknown): RawValue {
  if (value === undefined || value === null) {
    return { kind: "absent" };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? { kind: "absent" } : { kind: "value", value: trimmed };
  }
  return { kind: "invalid" };
}

function failure(field: string, message: string): ValidationFailure {
  return { ok: false, code: "INVALID_QUERY", message, field };
}

function readString(
  query: Record<string, unknown>,
  field: string,
): Read<string | undefined> {
  const raw = readRaw(query[field]);
  if (raw.kind === "invalid") {
    return { ok: false, failure: failure(field, `${field} must be a single value`) };
  }
  return { ok: true, value: raw.kind === "value" ? raw.value : undefined };
}

function readNumber(
  query: Record<string, unknown>,
  field: string,
  opts: { integer?: boolean; min?: number } = {},
): Read<number | undefined> {
  const raw = readRaw(query[field]);
  if (raw.kind === "invalid") {
    return { ok: false, failure: failure(field, `${field} must be a single value`) };
  }
  if (raw.kind === "absent") {
    return { ok: true, value: undefined };
  }

  const value = Number(raw.value);
  if (!Number.isFinite(value)) {
    return { ok: false, failure: failure(field, `${field} must be a number`) };
  }
  if (opts.integer && !Number.isInteger(value)) {
    return { ok: false, failure: failure(field, `${field} must be an integer`) };
  }
  if (opts.min !== undefined && value < opts.min) {
    return { ok: false, failure: failure(field, `${field} must be >= ${opts.min}`) };
  }
  return { ok: true, value };
}

/**
 * Parses and validates raw query parameters into a `SearchParams` object.
 *
 * Pure and free of framework dependencies so it can be unit tested directly.
 * Returns either normalized params or a structured, human-readable error. Each
 * field is read in order and the first failure short-circuits, so no work is
 * spent validating fields the caller will never learn about.
 */
export function parseSearchParams(query: Record<string, unknown>): ParseResult {
  const minPrice = readNumber(query, "minPrice", { min: 0 });
  if (!minPrice.ok) return minPrice.failure;
  const maxPrice = readNumber(query, "maxPrice", { min: 0 });
  if (!maxPrice.ok) return maxPrice.failure;
  const minBedrooms = readNumber(query, "minBedrooms", { integer: true, min: 0 });
  if (!minBedrooms.ok) return minBedrooms.failure;
  const targetBudget = readNumber(query, "targetBudget", { min: 0 });
  if (!targetBudget.ok) return targetBudget.failure;
  const city = readString(query, "city");
  if (!city.ok) return city.failure;
  const keyword = readString(query, "keyword");
  if (!keyword.ok) return keyword.failure;

  const rawSort = readString(query, "sort");
  if (!rawSort.ok) return rawSort.failure;
  let sort: SortKey | undefined;
  if (rawSort.value === undefined) {
    sort = undefined;
  } else if (isSortKey(rawSort.value)) {
    sort = rawSort.value;
  } else {
    return failure("sort", `sort must be one of: ${SORT_KEYS.join(", ")}`);
  }

  const page = readNumber(query, "page", { integer: true, min: 1 });
  if (!page.ok) return page.failure;

  const pageSize = readNumber(query, "pageSize", { integer: true, min: 1 });
  if (!pageSize.ok) return pageSize.failure;
  if (pageSize.value !== undefined && pageSize.value > MAX_PAGE_SIZE) {
    return failure("pageSize", `pageSize must be <= ${MAX_PAGE_SIZE}`);
  }

  if (
    minPrice.value !== undefined &&
    maxPrice.value !== undefined &&
    minPrice.value > maxPrice.value
  ) {
    return failure("minPrice", "minPrice must be less than or equal to maxPrice");
  }

  return {
    ok: true,
    params: {
      minPrice: minPrice.value,
      maxPrice: maxPrice.value,
      minBedrooms: minBedrooms.value,
      city: city.value,
      keyword: keyword.value,
      targetBudget: targetBudget.value,
      sort,
      page: page.value ?? DEFAULT_PAGE,
      pageSize: pageSize.value ?? DEFAULT_PAGE_SIZE,
    },
  };
}
