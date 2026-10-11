import { Kysely, sql } from "kysely";
import { Database } from "../db";
import { Listing } from "../types";

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
 */
export interface ListingRepository {
  find(filter: ListingFilter): Promise<Listing[]>;
}

/** Escapes LIKE/ILIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export class KyselyListingRepository implements ListingRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(filter: ListingFilter): Promise<Listing[]> {
    let query = this.db
      .selectFrom("listings")
      .select([
        "id",
        "source",
        "address",
        "city",
        "state",
        "zip",
        // NUMERIC comes back as a string from pg; cast so the API returns numbers.
        sql<number>`price::float8`.as("price"),
        "bedrooms",
        sql<number | null>`bathrooms::float8`.as("bathrooms"),
        "sqft",
        "latitude",
        "longitude",
        sql<Date>`listed_date`.as("listedDate"),
        "status",
        "description",
      ]);

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

    return rows.map((row) => ({
      ...row,
      listedDate: row.listedDate.toISOString(),
    }));
  }
}
