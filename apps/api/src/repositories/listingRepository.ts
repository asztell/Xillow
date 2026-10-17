import { Kysely, sql } from "kysely";
import { Database } from "../db";
import { Listing, ListingDetail, ListingSource } from "../types";

/** Filter criteria pushed down to the data source. */
export interface ListingFilter {
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  city?: string;
  keyword?: string;
}

/**
 * Data-access boundary. The service layer depends on this interface rather
 * than on any specific driver, which keeps the search logic testable without a
 * database.
 *
 * `find` returns at most one row per property: the newest listing of each
 * duplicate group (`dup_key`), selected before `filter` is applied. `findDetail`
 * returns one specific row plus every feed row for the same property.
 */
export interface ListingRepository {
  find(filter: ListingFilter): Promise<Listing[]>;
  findDetail(id: string, source: string): Promise<ListingDetail | null>;
}

/** Escapes LIKE/ILIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Keeps only the newest row of each duplicate group.
 *
 * The representative is chosen over the *whole* table, before the price/city/
 * keyword filters are applied, so a property is always shown (or hidden) as its
 * most recent listing: filtering on price selects among properties by the
 * primary's price, and a property whose newest listing falls outside the range
 * is hidden entirely rather than falling back to an older, cheaper sibling.
 *
 * Ordering: newest `listed_date`, then lowest `id`, then lowest `source` (ties
 * resolved deterministically). Rows without a `dup_key` are unique and always
 * pass; `sibling.dup_key = listings.dup_key` is never true for them because a
 * NULL comparison yields NULL.
 *
 * A correlated `NOT EXISTS` (rather than `DISTINCT ON`) keeps the filters as
 * ordinary `WHERE` clauses on the same query and sidesteps `DISTINCT ON`'s
 * treatment of NULLs as one group. The `(dup_key, listed_date)` index answers
 * the per-row lookup.
 */
const PRIMARY_OF_GROUP = sql<boolean>`not exists (
  select 1
  from listings as sibling
  where sibling.dup_key is not null
    and sibling.dup_key = listings.dup_key
    and (
      sibling.listed_date > listings.listed_date
      or (sibling.listed_date = listings.listed_date and sibling.id < listings.id)
      or (
        sibling.listed_date = listings.listed_date
        and sibling.id = listings.id
        and sibling.source < listings.source
      )
    )
)`;

/**
 * Columns selected for a `Listing`. `price` and `bathrooms` are NUMERIC in
 * Postgres and would otherwise arrive as strings, so they are cast to `float8`.
 */
const LISTING_COLUMNS = [
  "id",
  "source",
  "address",
  "city",
  "state",
  "zip",
  sql<number>`price::float8`.as("price"),
  "bedrooms",
  sql<number | null>`bathrooms::float8`.as("bathrooms"),
  "sqft",
  "latitude",
  "longitude",
  sql<Date>`listed_date`.as("listedDate"),
  "status",
  "description",
  "photos",
  "dup_key",
] as const;

/** The row shape produced by selecting `LISTING_COLUMNS` from `listings`. */
interface ListingRow {
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
  listedDate: Date;
  status: string;
  description: string | null;
  photos: string[];
  dup_key: string | null;
}

/** Normalizes a raw row into the API `Listing` shape (date as an ISO string). */
function toListing(row: ListingRow): Listing {
  return {
    ...row,
    listedDate: row.listedDate.toISOString(),
    dup_key: row.dup_key ?? null,
  };
}

/** Projects a listing into the lightweight shape the provenance panel needs. */
function toSource(listing: Listing, isCurrent: boolean): ListingSource {
  return {
    id: listing.id,
    source: listing.source,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    price: listing.price,
    listedDate: listing.listedDate,
    status: listing.status,
    isCurrent,
  };
}

export class KyselyListingRepository implements ListingRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(filter: ListingFilter): Promise<Listing[]> {
    let query = this.db.selectFrom("listings").select([...LISTING_COLUMNS]);

    // One row per property, chosen globally (see PRIMARY_OF_GROUP), then filtered.
    query = query.where(PRIMARY_OF_GROUP);

    if (filter.minPrice !== undefined) {
      query = query.where("price", ">=", filter.minPrice);
    }
    if (filter.maxPrice !== undefined) {
      query = query.where("price", "<=", filter.maxPrice);
    }
    if (filter.minBedrooms !== undefined) {
      query = query.where("bedrooms", ">=", filter.minBedrooms);
    }
    if (filter.city !== undefined) {
      query = query.where("city", "ilike", `%${escapeLike(filter.city)}%`);
    }
    if (filter.keyword !== undefined) {
      query = query.where(
        "description",
        "ilike",
        `%${escapeLike(filter.keyword)}%`,
      );
    }

    const rows = await query.execute();

    return rows.map(toListing);
  }

  async findDetail(id: string, source: string): Promise<ListingDetail | null> {
    const row = await this.db
      .selectFrom("listings")
      .select([...LISTING_COLUMNS])
      .where("id", "=", id)
      .where("source", "=", source)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const listing = toListing(row);
    const dupKey = listing.dup_key ?? null;

    // A row without a duplicate key is its own only source.
    if (dupKey === null) {
      return { ...listing, sources: [toSource(listing, true)] };
    }

    // Same ordering as PRIMARY_OF_GROUP, so index 0 is the row the grid shows.
    const siblings = await this.db
      .selectFrom("listings")
      .select([...LISTING_COLUMNS])
      .where("dup_key", "=", dupKey)
      .orderBy("listed_date", "desc")
      .orderBy("id", "asc")
      .orderBy("source", "asc")
      .execute();

    return {
      ...listing,
      sources: siblings.map((sibling, index) =>
        toSource(toListing(sibling), index === 0),
      ),
    };
  }
}
