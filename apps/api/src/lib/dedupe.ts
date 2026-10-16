import type { DuplicateAnnotation, DuplicateRef, Listing } from "../types";

/**
 * Cross-source duplicate detection
 * --------------------------------
 * The same physical property is routinely carried by more than one MLS feed
 * (e.g. "A1" on MLS_A and "B7" on MLS_B) with slightly different address
 * strings, prices and dates. We do not merge those rows - every source row is
 * still returned and `total` still counts raw rows - we only *annotate* them so
 * the UI can flag a likely duplicate.
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
 *
 * Limitation: grouping runs over the *filtered* result set, so a filter that
 * excludes one sibling suppresses the note on the survivor. A `dup_key` column
 * materialized at ingest would remove that caveat at scale.
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

/** Newest `listedDate` first; ties broken by (id, source) for determinism. */
function compareForPrimary(a: Listing, b: Listing): number {
  const aTime = Date.parse(a.listedDate);
  const bTime = Date.parse(b.listedDate);
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  if (a.id !== b.id) {
    return a.id < b.id ? -1 : 1;
  }
  if (a.source !== b.source) {
    return a.source < b.source ? -1 : 1;
  }
  return 0;
}

/**
 * Picks the group's primary row (the newest, then lowest id, then lowest
 * source) in a single pass instead of sorting the whole group.
 */
function findPrimary<T extends Listing>(members: readonly T[]): T {
  let primary = members[0];
  for (let i = 1; i < members.length; i += 1) {
    if (compareForPrimary(members[i], primary) < 0) {
      primary = members[i];
    }
  }
  return primary;
}

function toDuplicateRef(listing: Listing): DuplicateRef {
  return {
    id: listing.id,
    source: listing.source,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    price: listing.price,
    listedDate: listing.listedDate,
  };
}

/**
 * Returns each listing annotated with its duplicate group, the other members of
 * that group, and whether it is the group's primary (newest) row. Rows without a
 * suspected duplicate get `{ duplicateGroupId: null, potentialDuplicates: [], isPrimary: false }`.
 *
 * Pure and non-mutating: the input objects are not changed, so it never affects
 * filtering, ranking or pagination.
 */
export function annotateDuplicates<T extends Listing>(
  listings: T[],
): (T & DuplicateAnnotation)[] {
  const groups = new Map<string, T[]>();
  for (const listing of listings) {
    const key = duplicateKey(listing);
    if (key === null) {
      continue;
    }
    const members = groups.get(key);
    if (members) {
      members.push(listing);
    } else {
      groups.set(key, [listing]);
    }
  }

  const annotations = new Map<T, DuplicateAnnotation>();
  let groupNumber = 0;

  // Iterate keys in a deterministic order so a given set of groups always gets
  // the same ids (the repository's row order is not guaranteed).
  const duplicateGroups = [...groups.entries()]
    .filter(([, members]) => members.length >= 2)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  for (const [, members] of duplicateGroups) {
    const groupId = `dup-${String(++groupNumber).padStart(2, "0")}`;
    const primary = findPrimary(members);

    // Built once per group instead of once per member: with N members that is
    // N projections and N lookups rather than N filters plus N projections.
    const refs = members.map(toDuplicateRef);

    for (const [index, member] of members.entries()) {
      annotations.set(member, {
        duplicateGroupId: groupId,
        potentialDuplicates: refs.filter((_, other) => other !== index),
        isPrimary: member === primary,
      });
    }
  }

  return listings.map((listing) => ({
    ...listing,
    ...(annotations.get(listing) ?? {
      duplicateGroupId: null,
      potentialDuplicates: [],
      isPrimary: false,
    }),
  }));
}
