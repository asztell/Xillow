import { Pool } from "pg";

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
