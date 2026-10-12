import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type ListingsQuery } from "./query";

/** Raw, string-backed form state (controlled inputs hold strings). */
export interface FilterFormValues {
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  city: string;
  keyword: string;
  targetBudget: string;
  pageSize: string;
}

export type FilterField = keyof FilterFormValues;
export type FormErrors = Partial<Record<FilterField, string>>;

export const FILTER_LABELS: Record<FilterField, string> = {
  minPrice: "Min price ($)",
  maxPrice: "Max price ($)",
  minBedrooms: "Min bedrooms",
  city: "City",
  keyword: "Keyword (description)",
  targetBudget: "Target budget ($)",
  pageSize: "Results per page",
};

export function emptyForm(): FilterFormValues {
  return {
    minPrice: "",
    maxPrice: "",
    minBedrooms: "",
    city: "",
    keyword: "",
    targetBudget: "",
    pageSize: String(DEFAULT_PAGE_SIZE),
  };
}

export function formFromQuery(query: ListingsQuery): FilterFormValues {
  const asText = (value: number | undefined) => (value === undefined ? "" : String(value));
  return {
    minPrice: asText(query.minPrice),
    maxPrice: asText(query.maxPrice),
    minBedrooms: asText(query.minBedrooms),
    city: query.city ?? "",
    keyword: query.keyword ?? "",
    targetBudget: asText(query.targetBudget),
    pageSize: String(query.pageSize),
  };
}

function checkNumeric(
  field: FilterField,
  values: FilterFormValues,
  errors: FormErrors,
  options: { integer?: boolean; min?: number; max?: number } = {},
): number | undefined {
  const raw = values[field].trim();
  if (raw === "") return undefined;

  const label = FILTER_LABELS[field];
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors[field] = `${label} must be a number.`;
    return undefined;
  }
  if (options.integer && !Number.isInteger(value)) {
    errors[field] = `${label} must be a whole number.`;
    return undefined;
  }
  if (options.min !== undefined && value < options.min) {
    errors[field] = `${label} must be at least ${options.min}.`;
    return undefined;
  }
  if (options.max !== undefined && value > options.max) {
    errors[field] = `${label} must be at most ${options.max}.`;
    return undefined;
  }
  return value;
}

/**
 * Client-side mirror of the API's validation rules. It exists to give instant
 * feedback; the API stays the source of truth and still rejects anything this
 * misses (defence in depth).
 */
export function validateFilters(values: FilterFormValues): FormErrors {
  const errors: FormErrors = {};

  const minPrice = checkNumeric("minPrice", values, errors, { min: 0 });
  const maxPrice = checkNumeric("maxPrice", values, errors, { min: 0 });
  checkNumeric("minBedrooms", values, errors, { integer: true, min: 0 });
  checkNumeric("targetBudget", values, errors, { min: 0 });
  checkNumeric("pageSize", values, errors, { integer: true, min: 1, max: MAX_PAGE_SIZE });

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.minPrice = "Min price must be less than or equal to max price.";
  }

  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * The facets that count as "active" filters. Pagination (`page`, `pageSize`) is
 * a display setting, not a filter, so it is excluded from the tally.
 */
const FILTER_KEYS = [
  "minPrice",
  "maxPrice",
  "minBedrooms",
  "city",
  "keyword",
  "targetBudget",
] as const satisfies readonly (keyof ListingsQuery)[];

/** How many facets the given query narrows by, for the "Filters" badge. */
export function countActiveFilters(query: ListingsQuery): number {
  return FILTER_KEYS.filter((key) => {
    const value = query[key];
    return value !== undefined && value !== "";
  }).length;
}

/** How many facets the draft form currently fills in. */
export function countActiveFormFilters(values: FilterFormValues): number {
  return FILTER_KEYS.filter((key) => values[key].trim() !== "").length;
}

/** Converts validated form values into an applied query for the given page. */
export function queryFromForm(values: FilterFormValues, page: number): ListingsQuery {
  const asNumber = (raw: string) => {
    const trimmed = raw.trim();
    return trimmed === "" ? undefined : Number(trimmed);
  };

  return {
    minPrice: asNumber(values.minPrice),
    maxPrice: asNumber(values.maxPrice),
    minBedrooms: asNumber(values.minBedrooms),
    city: values.city.trim() || undefined,
    keyword: values.keyword.trim() || undefined,
    targetBudget: asNumber(values.targetBudget),
    page,
    pageSize: asNumber(values.pageSize) ?? DEFAULT_PAGE_SIZE,
  };
}
