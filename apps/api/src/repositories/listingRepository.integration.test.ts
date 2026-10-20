import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, Pool } from "pg";
import "../env";
import { createDb } from "../db";
import { upsertListings, type SampleListing } from "../lib/seeding";
import { KyselyListingRepository } from "./listingRepository";

/**
 * Primary-selection semantics, exercised against a real Postgres instance.
 *
 * The in-memory fake used by the route tests mirrors the rule in TypeScript;
 * this test is what actually pins the SQL. It needs a database, so it skips
 * itself when none is reachable (matching `seed.integration.test.ts`).
 */

const databaseUrl = process.env.DATABASE_URL;
const schemaSql = readFileSync(
  join(__dirname, "..", "..", "schema.sql"),
  "utf8",
);

function listing(overrides: Partial<SampleListing> = {}): SampleListing {
  return {
    id: "A1",
    source: "MLS_A",
    address: "123 Main St, Apt 4B",
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
 * One three-feed property (A1 450k, B7 452k, C8 448k newest) plus a distinct
 * home (A2). The prices are chosen so a 450k-452k filter matches only the
 * non-newest siblings.
 */
const SAMPLE: SampleListing[] = [
  listing({
    id: "A1",
    source: "MLS_A",
    address: "123 Main St, Apt 4B",
    price: 450000,
    listedDate: "2026-08-29",
  }),
  listing({
    id: "B7",
    source: "MLS_B",
    address: "123 Main Street, Unit 4B",
    price: 452000,
    listedDate: "2026-08-27",
  }),
  listing({
    id: "C8",
    source: "MLS_C",
    address: "123 Main Street, Apt 4B",
    price: 448000,
    listedDate: "2026-09-08",
  }),
  listing({
    id: "A2",
    source: "MLS_A",
    address: "456 Oak Ave",
    price: 525000,
    latitude: 38.7791,
    longitude: -77.1901,
    listedDate: "2026-09-02",
  }),
];

function withDatabase(connectionString: string, database: string): string {
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

describe("KyselyListingRepository primary selection (integration)", () => {
  let available = false;

  beforeAll(async () => {
    if (databaseUrl) {
      available = await canConnect(databaseUrl);
    }
  });

  it("returns each group's newest row and filters on that row", async (ctx) => {
    const connectionString = databaseUrl;
    if (!connectionString || !available) {
      ctx.skip();
      return;
    }

    const dbName = `xillow_repo_test_${process.pid}_${Date.now()}`;
    const create = new Client({ connectionString });
    await create.connect();
    try {
      await create.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await create.end();
    }

    const pool = new Pool({
      connectionString: withDatabase(connectionString, dbName),
    });
    const db = createDb(pool);

    try {
      await pool.query(schemaSql);
      await upsertListings(db, SAMPLE);

      const repo = new KyselyListingRepository(db);

      const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

      // Unfiltered: one row per property, the newest sibling wins.
      expect(idsOf(await repo.find({})).sort()).toEqual(["A2", "C8"]);

      // The representative (C8, 448k) is in range.
      expect(
        idsOf(await repo.find({ minPrice: 448000, maxPrice: 452000 })),
      ).toEqual(["C8"]);

      // A1 (450k) and B7 (452k) are in range but are not the representative, so
      // the property is hidden rather than shown as an older sibling.
      expect(await repo.find({ minPrice: 450000, maxPrice: 452000 })).toEqual(
        [],
      );
      expect(await repo.find({ minPrice: 452000, maxPrice: 452000 })).toEqual(
        [],
      );

      // findDetail returns the row plus every sibling, newest first.
      const detail = await repo.findDetail("C8", "MLS_C");
      expect(detail).not.toBeNull();
      expect(detail).toMatchObject({
        id: "C8",
        source: "MLS_C",
        price: 448000,
      });
      expect(detail!.sources.map((s) => `${s.source}:${s.id}`)).toEqual([
        "MLS_C:C8",
        "MLS_A:A1",
        "MLS_B:B7",
      ]);
      expect(detail!.sources[0].isCurrent).toBe(true);
      expect(detail!.sources.slice(1).every((s) => !s.isCurrent)).toBe(true);

      // An older sibling still resolves to the full group.
      const sibling = await repo.findDetail("B7", "MLS_B");
      expect(sibling!.sources).toHaveLength(3);
      expect(sibling!.sources[0].id).toBe("C8");

      // A unique listing is its own only source.
      const solo = await repo.findDetail("A2", "MLS_A");
      expect(solo!.sources).toEqual([
        expect.objectContaining({ id: "A2", isCurrent: true }),
      ]);

      // An unknown key returns null (the route maps this to 404).
      expect(await repo.findDetail("NOPE", "MLS_A")).toBeNull();
    } finally {
      await db.destroy();

      const drop = new Client({ connectionString });
      await drop.connect();
      try {
        await drop.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      } finally {
        await drop.end();
      }
    }
  });
});
