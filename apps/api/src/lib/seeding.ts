import type { Kysely } from "kysely";
import type { Database } from "../db";
import type { Listing } from "../types";
import { duplicateKey } from "./dedupe";

/**
 * Ingest helpers shared by the seed CLI and the seed tests.
 *
 * `sample_listings.json` mirrors the records received from the source systems,
 * so its shape is kept verbatim (no derived columns such as an "updated at";
 * `photos` is part of what a feed sends).
 */

/** One record exactly as received in `sample_listings.json`. */
export interface SampleListing {
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
  listedDate: string;
  status: string;
  description: string | null;
  /** Photo URLs as received from the source system; omit/empty when none exist. */
  photos?: string[];
}

/** Date-only ISO values ("2026-08-29") get pinned to midnight UTC. */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizes an ISO date ("2026-08-29") to a UTC timestamp. */
export function toTimestamp(value: string): string {
  return ISO_DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value;
}

export interface DuplicateKeyWarning {
  id: string;
  source: string;
  /** How many times the key appears in the batch. */
  count: number;
  /**
   * True when the repeated entries disagree. The upsert keeps the last
   * occurrence, so a conflicting repeat silently drops the earlier values.
   */
  conflicting: boolean;
}

/**
 * Composite primary key as a single map key. The NUL separator cannot appear
 * in an id, so the encoding is unambiguous.
 */
function listingKey(listing: SampleListing): string {
  return `${listing.id}\u0000${listing.source}`;
}

/**
 * Order-independent serialization, so key order can't produce false positives.
 *
 * Keys are compared by code unit rather than with `localeCompare`: the two
 * records only need the *same* ordering to compare equal, and code-unit
 * ordering is both cheaper and independent of the host's ICU data.
 */
function canonical(listing: SampleListing): string {
  const entries = Object.entries(listing).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return JSON.stringify(entries);
}

/**
 * Finds `(id, source)` keys that appear more than once in a batch.
 *
 * These are not a data error per se - the composite primary key means the
 * upsert simply keeps the last occurrence - but an accidental repeat (or a
 * conflicting repeat) is worth surfacing instead of overwriting in silence.
 */
export function findDuplicateKeys(
  listings: SampleListing[],
): DuplicateKeyWarning[] {
  // Only the first occurrence of each key is kept, together with its
  // canonical payload, so repeats are serialized once instead of re-serializing
  // the first record on every occurrence.
  const firstSeen = new Map<
    string,
    { id: string; source: string; payload: string }
  >();
  const counts = new Map<string, number>();
  const conflicting = new Set<string>();

  for (const listing of listings) {
    const key = listingKey(listing);
    counts.set(key, (counts.get(key) ?? 0) + 1);

    const first = firstSeen.get(key);
    if (first === undefined) {
      firstSeen.set(key, {
        id: listing.id,
        source: listing.source,
        payload: canonical(listing),
      });
    } else if (first.payload !== canonical(listing)) {
      conflicting.add(key);
    }
  }

  return [...firstSeen.entries()]
    .map(([key, first]) => ({
      id: first.id,
      source: first.source,
      count: counts.get(key) ?? 1,
      conflicting: conflicting.has(key),
    }))
    .filter((warning) => warning.count > 1)
    .sort((a, b) =>
      a.id === b.id
        ? a.source.localeCompare(b.source)
        : a.id.localeCompare(b.id),
    );
}

/** Number of distinct `(id, source)` keys in a batch. */
export function distinctKeyCount(listings: SampleListing[]): number {
  return new Set(listings.map(listingKey)).size;
}

/**
 * Rows per INSERT statement. Batching keeps the seed to a handful of round
 * trips while staying well clear of Postgres' parameter limit.
 */
const UPSERT_CHUNK_SIZE = 500;

/**
 * Collapses a batch to one row per `(id, source)` key, keeping the last
 * occurrence. The feed may repeat a key, and a single multi-row INSERT with
 * `ON CONFLICT DO UPDATE` cannot touch the same conflict target twice (Postgres
 * raises "cannot affect row a second time"), so collapsing first both preserves
 * the documented "last value wins" semantics and makes the statement legal.
 */
function lastByKey(listings: SampleListing[]): SampleListing[] {
  const byKey = new Map<string, SampleListing>();
  for (const listing of listings) {
    byKey.set(listingKey(listing), listing);
  }
  return [...byKey.values()];
}

/** Maps a source record onto the `listings` table's column names. */
function toRow(listing: SampleListing) {
  return {
    id: listing.id,
    source: listing.source,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    sqft: listing.sqft,
    latitude: listing.latitude,
    longitude: listing.longitude,
    listed_date: new Date(toTimestamp(listing.listedDate)),
    status: listing.status,
    description: listing.description,
    photos: listing.photos ?? [],
    dup_key: duplicateKey(listing as Listing),
  };
}

/**
 * Upserts a batch on the composite key `(id, source)`, so re-running is
 * idempotent: existing rows are updated in place and never duplicated. The
 * whole batch runs in a single transaction (chunked into multi-row inserts) so
 * a partial batch is never left behind.
 */
export async function upsertListings(
  db: Kysely<Database>,
  listings: SampleListing[],
): Promise<void> {
  const rows = lastByKey(listings).map(toRow);
  if (rows.length === 0) return;

  await db.transaction().execute(async (trx) => {
    for (let start = 0; start < rows.length; start += UPSERT_CHUNK_SIZE) {
      await trx
        .insertInto("listings")
        .values(rows.slice(start, start + UPSERT_CHUNK_SIZE))
        .onConflict((oc) =>
          oc.columns(["id", "source"]).doUpdateSet((eb) => ({
            address: eb.ref("excluded.address"),
            city: eb.ref("excluded.city"),
            state: eb.ref("excluded.state"),
            zip: eb.ref("excluded.zip"),
            price: eb.ref("excluded.price"),
            bedrooms: eb.ref("excluded.bedrooms"),
            bathrooms: eb.ref("excluded.bathrooms"),
            sqft: eb.ref("excluded.sqft"),
            latitude: eb.ref("excluded.latitude"),
            longitude: eb.ref("excluded.longitude"),
            listed_date: eb.ref("excluded.listed_date"),
            status: eb.ref("excluded.status"),
            description: eb.ref("excluded.description"),
            photos: eb.ref("excluded.photos"),
            dup_key: eb.ref("excluded.dup_key"),
          })),
        )
        .execute();
    }
  });
}
