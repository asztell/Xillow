import { SearchParams, SortKey } from "../types";
import { isSortKey } from "./sorting";

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

/**
 * Parses and validates raw query parameters into a `SearchParams` object.
 *
 * Pure and free of framework dependencies so it can be unit tested directly.
 * Returns either normalized params or a structured, human-readable error.
 */
export function parseSearchParams(query: Record<string, unknown>): ParseResult {
  const errors: Array<{ field: string; message: string }> = [];

  const readString = (field: string): string | undefined => {
    const raw = readRaw(query[field]);
    if (raw.kind === "invalid") {
      errors.push({ field, message: `${field} must be a single value` });
      return undefined;
    }
    return raw.kind === "value" ? raw.value : undefined;
  };

  const readNumber = (
    field: string,
    opts: { integer?: boolean; min?: number } = {},
  ): number | undefined => {
    const raw = readRaw(query[field]);
    if (raw.kind === "invalid") {
      errors.push({ field, message: `${field} must be a single value` });
      return undefined;
    }
    if (raw.kind === "absent") {
      return undefined;
    }

    const value = Number(raw.value);
    if (!Number.isFinite(value)) {
      errors.push({ field, message: `${field} must be a number` });
      return undefined;
    }
    if (opts.integer && !Number.isInteger(value)) {
      errors.push({ field, message: `${field} must be an integer` });
      return undefined;
    }
    if (opts.min !== undefined && value < opts.min) {
      errors.push({ field, message: `${field} must be >= ${opts.min}` });
      return undefined;
    }
    return value;
  };

  const minPrice = readNumber("minPrice", { min: 0 });
  const maxPrice = readNumber("maxPrice", { min: 0 });
  const minBedrooms = readNumber("minBedrooms", { integer: true, min: 0 });
  const targetBudget = readNumber("targetBudget", { min: 0 });
  const city = readString("city");
  const keyword = readString("keyword");

  const rawSort = readString("sort");
  let sort: SortKey | undefined;
  if (rawSort === undefined) {
    sort = undefined;
  } else if (isSortKey(rawSort)) {
    sort = rawSort;
  } else {
    errors.push({
      field: "sort",
      message:
        "sort must be one of: recommended, price_desc, price_asc, newest, bedrooms_desc, bathrooms_desc, sqft_desc",
    });
  }

  const page = readNumber("page", { integer: true, min: 1 }) ?? DEFAULT_PAGE;

  let pageSize = readNumber("pageSize", { integer: true, min: 1 });
  if (pageSize !== undefined && pageSize > MAX_PAGE_SIZE) {
    errors.push({
      field: "pageSize",
      message: `pageSize must be <= ${MAX_PAGE_SIZE}`,
    });
    pageSize = undefined;
  }
  pageSize ??= DEFAULT_PAGE_SIZE;

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.push({
      field: "minPrice",
      message: "minPrice must be less than or equal to maxPrice",
    });
  }

  if (errors.length > 0) {
    const [first] = errors;
    return {
      ok: false,
      code: "INVALID_QUERY",
      message: first.message,
      field: first.field,
    };
  }

  return {
    ok: true,
    params: { minPrice, maxPrice, minBedrooms, city, keyword, targetBudget, sort, page, pageSize },
  };
}
