import type { Listing } from "../types";

/**
 * Cross-source duplicate keys
 * ---------------------------
 * The same physical property is routinely carried by more than one MLS feed
 * (e.g. "A1" on MLS_A and "B7" on MLS_B) with slightly different address
 * strings, prices and dates. `duplicateKey()` reduces a row to a key for the
 * underlying property. It is materialized on the `dup_key` column at ingest (see
 * `lib/seeding.ts`), so a search can return one row per property *in SQL* -
 * before any filter is applied - via `KyselyListingRepository.find`, without
 * recomputing the key per query. Rows without a `dup_key` are treated as unique
 * (run `npm run backfill:dup-key` to populate legacy rows).
 *
 * Signals used, strongest first:
 *
 *   1. Geocode (primary). Rows that share a location are the same place;
 *      identical coordinates (the usual case across feeds) always collide. We
 *      quantize to ~11 m so trivial geocoder jitter still matches, and include
 *      the unit in the key so two condos in one building are not merged.
 *   2. Normalized address (fallback + corroboration). Used when coordinates are
 *      missing: lowercase, strip punctuation, expand street-type abbreviations
 *      ("st" -> "street") and lift out the unit ("apt/unit/#"). The zip is
 *      intentionally ignored - feeds disagree on it (e.g. 22150 vs 22151).
 *
 * The unit guard is what keeps geo-only matching honest: `123 Main St, Apt 4B`
 * and `123 Main St, Apt 5C` share a geocode but are distinct homes.
 */

/** Street-type tokens normalized to a single canonical spelling. */
const STREET_ABBREVIATIONS: Record<string, string> = {
  st: "street",
  str: "street",
  ave: "avenue",
  av: "avenue",
  blvd: "boulevard",
  rd: "road",
  dr: "drive",
  ln: "lane",
  ct: "court",
  pl: "place",
  ter: "terrace",
  terr: "terrace",
  cir: "circle",
  hwy: "highway",
  pkwy: "parkway",
  sq: "square",
};

/** Tokens that introduce a unit / apartment number. */
const UNIT_MARKERS = new Set(["apt", "apartment", "unit", "ste", "suite"]);

/** ~11 m at the equator at 4 decimal places. */
const GEO_PRECISION = 4;

/** Hoisted so each call reuses the same compiled regexes instead of re-creating them. */
const NON_TOKEN_CHARS = /[^a-z0-9\s-]/g;
const WHITESPACE_RUN = /\s+/;
const LEADING_STREET_NUMBER = /^\d+[a-z]?$/;

export interface NormalizedAddress {
  /** Leading street number, e.g. "123" - null when absent. */
  number: string | null;
  /** Canonicalized street name, e.g. "main street". */
  street: string;
  /** Apartment/unit token, e.g. "4b" - null when absent. */
  unit: string | null;
}

/**
 * Reduces an address to comparable parts: street number, canonical street name
 * and optional unit. Purpose-built for duplicate matching, not for display.
 */
export function normalizeAddress(address: string): NormalizedAddress {
  const tokens = address
    .toLowerCase()
    .replaceAll("#", " unit ") // "#4b" / "# 4b" -> "unit 4b"
    .replaceAll(NON_TOKEN_CHARS, " ") // drop punctuation
    .split(WHITESPACE_RUN)
    .filter(Boolean);

  let number: string | null = null;
  if (tokens.length > 0 && LEADING_STREET_NUMBER.test(tokens[0])) {
    number = tokens.shift() ?? null;
  }

  let unit: string | null = null;
  const unitIndex = tokens.findIndex((token) => UNIT_MARKERS.has(token));
  if (unitIndex !== -1) {
    unit = tokens[unitIndex + 1] ?? null;
    tokens.splice(unitIndex, unit === null ? 1 : 2);
  }

  const street = tokens
    .map((token) => STREET_ABBREVIATIONS[token] ?? token)
    .join(" ");

  return { number, street, unit };
}

/**
 * Builds the grouping key for a listing, or null when there is nothing reliable
 * to group on. Returns the same key for rows we believe are the same property.
 */
export function duplicateKey(listing: Listing): string | null {
  const { number, street, unit } = normalizeAddress(listing.address);

  if (listing.latitude !== null && listing.longitude !== null) {
    const geo = `${listing.latitude.toFixed(GEO_PRECISION)},${listing.longitude.toFixed(GEO_PRECISION)}`;
    return `geo:${geo}:${unit ?? ""}`;
  }

  // No coordinates: fall back to the normalized address.
  if (number === null || street === "") {
    return null;
  }
  return `addr:${listing.city.toLowerCase()}:${number}:${street}:${unit ?? ""}`;
}
