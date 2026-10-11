import { Pool } from "pg";
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
 * than on `pg` directly, which keeps the search logic testable without a
 * database.
 */
export interface ListingRepository {
  find(filter: ListingFilter): Promise<Listing[]>;
}

interface ListingRow {
  id: string;
  source: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: string | number;
  bedrooms: number | null;
  bathrooms: string | number | null;
  sqft: number | null;
  latitude: string | number | null;
  longitude: string | number | null;
  listedDate: Date | string;
  status: string;
  description: string | null;
}

/** Escapes LIKE/ILIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toNumber(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRow(row: ListingRow): Listing {
  return {
    id: row.id,
    source: row.source,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    price: toNumber(row.price) ?? 0,
    bedrooms: row.bedrooms === null ? null : Number(row.bedrooms),
    bathrooms: toNumber(row.bathrooms),
    sqft: row.sqft === null ? null : Number(row.sqft),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    listedDate:
      row.listedDate instanceof Date
        ? row.listedDate.toISOString()
        : String(row.listedDate),
    status: row.status,
    description: row.description,
  };
}

export class PgListingRepository implements ListingRepository {
  constructor(private readonly pool: Pool) {}

  async find(filter: ListingFilter): Promise<Listing[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    // Each filter is added only when present, and always as a bound parameter.
    const addCondition = (sql: (placeholder: string) => string, value: unknown) => {
      values.push(value);
      conditions.push(sql(`$${values.length}`));
    };

    if (filter.minPrice !== undefined) {
      addCondition((p) => `price >= ${p}`, filter.minPrice);
    }
    if (filter.maxPrice !== undefined) {
      addCondition((p) => `price <= ${p}`, filter.maxPrice);
    }
    if (filter.minBedrooms !== undefined) {
      addCondition((p) => `bedrooms >= ${p}`, filter.minBedrooms);
    }
    if (filter.city !== undefined) {
      addCondition(
        (p) => `city ILIKE ${p} ESCAPE '\\'`,
        `%${escapeLike(filter.city)}%`,
      );
    }
    if (filter.keyword !== undefined) {
      addCondition(
        (p) => `description ILIKE ${p} ESCAPE '\\'`,
        `%${escapeLike(filter.keyword)}%`,
      );
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await this.pool.query<ListingRow>(
      `SELECT id, source, address, city, state, zip,
              price,
              bedrooms,
              bathrooms,
              sqft,
              latitude,
              longitude,
              listed_date AS "listedDate",
              status,
              description
         FROM listings
         ${where}`,
      values,
    );

    return rows.map(mapRow);
  }
}
