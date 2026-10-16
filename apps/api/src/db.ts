import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

/**
 * Kysely table/column declarations.
 *
 * Column names are snake_case to match the database; `price` and `bathrooms`
 * are declared as `number` because the repository casts the NUMERIC columns to
 * `float8` on select (pg returns NUMERIC as a string by default).
 */
export interface ListingsTable {
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
  listed_date: Date;
  status: string;
  description: string | null;
  photos: string[];
  dup_key: string | null;
}

export interface Database {
  listings: ListingsTable;
}

/**
 * Creates a Postgres connection pool.
 *
 * Kept as a factory (rather than a module-level singleton) so that it is easy
 * to construct pools with different configuration in scripts and tests.
 */
export function createPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }
  return new Pool({ connectionString });
}

/**
 * Wraps a `pg` pool in a typed Kysely instance. Kysely is only the query
 * builder here - `pg` remains the driver via `PostgresDialect`.
 */
export function createDb(pool: Pool): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}
