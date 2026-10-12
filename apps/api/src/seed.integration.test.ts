import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, Pool } from "pg";
import "./env";
import { createDb } from "./db";
import { upsertListings, type SampleListing } from "./lib/seeding";

/**
 * Seed idempotency, exercised against a real Postgres instance.
 *
 * The test manages its own throwaway database (`xillow_seed_test_*`) so it never
 * touches the development data, then seeds it twice and asserts the row count is
 * stable and free of duplicate `(id, source)` keys. When no database is
 * reachable - e.g. `npm test` on a machine without Docker running - the test
 * skips itself rather than failing the suite.
 */

const databaseUrl = process.env.DATABASE_URL;
const schemaSql = readFileSync(join(__dirname, "..", "schema.sql"), "utf8");

function listing(overrides: Partial<SampleListing> = {}): SampleListing {
  return {
    id: "A1",
    source: "MLS_A",
    address: "123 Main St",
    city: "Springfield",
    state: "VA",
    zip: "22150",
    price: 450000,
    bedrooms: 2,
    bathrooms: 1.5,
    sqft: 980,
    latitude: 38.7893,
    longitude: -77.1873,
    listedDate: "2026-08-29",
    status: "active",
    description: "Bright condo near transit",
    ...overrides,
  };
}

/**
 * A small batch with two distinct keys and one conflicting repeat. The repeat
 * is intentional: it proves re-seeding updates in place (last value wins)
 * instead of inserting a second row.
 */
const SAMPLE: SampleListing[] = [
  listing({ id: "A1", source: "MLS_A", price: 450000 }),
  listing({ id: "B7", source: "MLS_B", price: 452000 }),
  listing({ id: "A1", source: "MLS_A", price: 465000 }),
];

/** Points a connection string at a different database on the same server. */
function withDatabase(
  connectionString: string,
  database: string,
): string {
  const parsed = new URL(connectionString);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function canConnect(connectionString: string): Promise<boolean> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 2000,
  });
  try {
    await client.connect();
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function scalar(pool: Pool, sql: string): Promise<number> {
  const result = await pool.query<{ n: number }>(sql);
  return result.rows[0].n;
}

describe("seed idempotency (integration)", () => {
  let available = false;

  beforeAll(async () => {
    if (databaseUrl) {
      available = await canConnect(databaseUrl);
    }
  });

  it("re-running the seed keeps the row count stable and duplicate-free", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }

    const dbName = `xillow_seed_test_${process.pid}_${Date.now()}`;
    const create = new Client({ connectionString: databaseUrl });
    await create.connect();
    try {
      await create.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await create.end();
    }

    const pool = new Pool({
      connectionString: withDatabase(databaseUrl!, dbName),
    });
    const db = createDb(pool);

    try {
      await pool.query(schemaSql);

      await upsertListings(db, SAMPLE);
      expect(await scalar(pool, "SELECT count(*)::int AS n FROM listings")).toBe(2);

      // Second run: the upsert must update, not duplicate.
      await upsertListings(db, SAMPLE);
      expect(await scalar(pool, "SELECT count(*)::int AS n FROM listings")).toBe(2);
      expect(
        await scalar(
          pool,
          "SELECT count(DISTINCT (id, source))::int AS n FROM listings",
        ),
      ).toBe(2);

      // The conflicting repeat is resolved by "last value wins".
      const { rows } = await pool.query<{ price: number }>(
        "SELECT price::float8 AS price FROM listings WHERE id = $1 AND source = $2",
        ["A1", "MLS_A"],
      );
      expect(rows[0]?.price).toBe(465000);
    } finally {
      await db.destroy();

      const drop = new Client({ connectionString: databaseUrl });
      await drop.connect();
      try {
        await drop.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      } finally {
        await drop.end();
      }
    }
  });
});
