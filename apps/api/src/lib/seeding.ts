import type { Kysely } from "kysely";
import type { Database } from "../db";

/**
 * Ingest helpers shared by the seed CLI and the seed tests.
 *
 * `sample_listings.json` mirrors the records received from the source systems,
 * so its shape is kept verbatim (no added columns such as an "updated at").
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
}

/** Normalizes an ISO date ("2026-08-29") to a UTC timestamp. */
export function toTimestamp(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
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

/** Order-independent serialization, so key order can't produce false positives. */
function canonical(listing: SampleListing): string {
  return JSON.stringify(
    Object.entries(listing).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Finds `(id, source)` keys that appear more than once in a batch.
 *
 * These are not a data error per se - the composite primary key means the
 * upsert simply keeps the last occurrence - but an accidental repeat (or a
 * conflicting repeat) is worth surfacing instead of overwriting in silence.
 */
export function findDuplicateKeys(listings: SampleListing[]): DuplicateKeyWarning[] {
  const firstSeen = new Map<string, SampleListing>();
  const counts = new Map<string, number>();
  const conflicting = new Set<string>();

  for (const listing of listings) {
    const key = `${listing.id}\u0000${listing.source}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);

    const first = firstSeen.get(key);
    if (first === undefined) {
      firstSeen.set(key, listing);
    } else if (canonical(first) !== canonical(listing)) {
      conflicting.add(key);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [id, source] = key.split("\u0000");
      return { id, source, count, conflicting: conflicting.has(key) };
    })
    .sort((a, b) =>
      a.id === b.id ? a.source.localeCompare(b.source) : a.id.localeCompare(b.id),
    );
}

/** Number of distinct `(id, source)` keys in a batch. */
export function distinctKeyCount(listings: SampleListing[]): number {
  return new Set(listings.map((l) => `${l.id}\u0000${l.source}`)).size;
}

/**
 * Upserts a batch on the composite key `(id, source)`, so re-running is
 * idempotent: existing rows are updated in place and never duplicated. Runs in a
 * single transaction so a partial batch is never left behind.
 */
export async function upsertListings(
  db: Kysely<Database>,
  listings: SampleListing[],
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    for (const listing of listings) {
      await trx
        .insertInto("listings")
        .values({
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
        })
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
          })),
        )
        .execute();
    }
  });
}
