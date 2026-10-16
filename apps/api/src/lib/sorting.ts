import type { SortKey } from "../types";
import { compareScored } from "./scoring";

/**
 * Sorting
 * -------
 * The "recommended" order is the relevance ranking produced by `rankListings`
 * (budget proximity + recency). The remaining keys are plain attribute sorts,
 * all of them "high to low" like the popular listing portals ("Most beds",
 * "Most baths", "Largest").
 *
 * Attribute sorts share two properties:
 *
 *   - Missing stats (bedrooms/bathrooms/sqft can be null) always sink to the
 *     end - a home without a recorded count should not leapfrog ones with a
 *     number.
 *   - Every sort breaks exact ties by `id` then `source`, so pagination is
 *     stable across requests no matter which attribute the user chose.
 */

/**
 * Every accepted `sort` value. Declared as an exhaustive record so omitting a
 * member of the `SortKey` union here is a compile error - the runtime list and
 * the type can never drift. The web app mirrors this in
 * `apps/web/src/lib/query.ts` (same `satisfies` guard).
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

export const SORT_KEYS: readonly SortKey[] = Object.keys(
  SORT_KEY_SET,
) as SortKey[];

/** Type guard for raw query strings. */
export function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

interface SortRow {
  id: string;
  source: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  listedDate: string;
  score: number;
}

/** Sentinel that sorts every real value ahead of a missing one. */
const LOWEST = Number.NEGATIVE_INFINITY;

/** Final tie-break for every attribute sort: `id` asc, then `source` asc. */
function byIdThenSource(a: { id: string; source: string }, b: { id: string; source: string }): number {
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  return 0;
}

/** Missing values behave as -Infinity, so they sort last in a descending run. */
function compareNullableDesc(a: number | null, b: number | null): number {
  const av = a ?? LOWEST;
  const bv = b ?? LOWEST;
  if (av === bv) return 0;
  return av > bv ? -1 : 1;
}

/** Newest `listedDate` first (ISO strings compare lexicographically). */
function byNewest(listedA: string, listedB: string): number {
  if (listedA === listedB) return 0;
  return listedA < listedB ? 1 : -1;
}

/** Applies a sort to a copy of the list. `recommended` keeps the score order. */
export function sortListings<T extends SortRow>(listings: T[], sort: SortKey): T[] {
  const sorted = [...listings];
  switch (sort) {
    case "recommended":
      return sorted.sort(compareScored);
    case "price_desc":
      return sorted.sort((a, b) => b.price - a.price || byIdThenSource(a, b));
    case "price_asc":
      return sorted.sort((a, b) => a.price - b.price || byIdThenSource(a, b));
    case "newest":
      return sorted.sort((a, b) => byNewest(a.listedDate, b.listedDate) || byIdThenSource(a, b));
    case "bedrooms_desc":
      return sorted.sort((a, b) => compareNullableDesc(a.bedrooms, b.bedrooms) || byIdThenSource(a, b));
    case "bathrooms_desc":
      return sorted.sort((a, b) => compareNullableDesc(a.bathrooms, b.bathrooms) || byIdThenSource(a, b));
    case "sqft_desc":
      return sorted.sort((a, b) => compareNullableDesc(a.sqft, b.sqft) || byIdThenSource(a, b));
    default: {
      // Compile-time guard: adding a `SortKey` without a case is a type error.
      const unhandled: never = sort;
      throw new Error(`Unsupported sort key: ${String(unhandled)}`);
    }
  }
}
