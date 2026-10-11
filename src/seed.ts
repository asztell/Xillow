import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPool } from "./db";

/**
 * Seeds the `listings` table from sample_listings.json.
 *
 * Idempotent: the table is upserted on the composite key (id, source), so the
 * script can be re-run safely. It also applies schema.sql first so it works
 * even without the Docker init hook.
 */

interface SampleListing {
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

// src/seed.ts -> project root, and dist/seed.js -> project root.
const projectRoot = join(__dirname, "..");

/** Normalizes an ISO date ("2026-08-29") to a UTC timestamp. */
function toTimestamp(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;
}

const UPSERT_SQL = `
  INSERT INTO listings (
    id, source, address, city, state, zip, price, bedrooms, bathrooms, sqft,
    latitude, longitude, listed_date, status, description
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
  )
  ON CONFLICT (id, source) DO UPDATE SET
    address     = EXCLUDED.address,
    city        = EXCLUDED.city,
    state       = EXCLUDED.state,
    zip         = EXCLUDED.zip,
    price       = EXCLUDED.price,
    bedrooms    = EXCLUDED.bedrooms,
    bathrooms   = EXCLUDED.bathrooms,
    sqft        = EXCLUDED.sqft,
    latitude    = EXCLUDED.latitude,
    longitude   = EXCLUDED.longitude,
    listed_date = EXCLUDED.listed_date,
    status      = EXCLUDED.status,
    description = EXCLUDED.description
`;

async function main(): Promise<void> {
  const listings: SampleListing[] = JSON.parse(
    readFileSync(join(projectRoot, "sample_listings.json"), "utf8"),
  );
  const schemaSql = readFileSync(join(projectRoot, "schema.sql"), "utf8");

  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query(schemaSql);
    await client.query("BEGIN");

    for (const listing of listings) {
      await client.query(UPSERT_SQL, [
        listing.id,
        listing.source,
        listing.address,
        listing.city,
        listing.state,
        listing.zip,
        listing.price,
        listing.bedrooms,
        listing.bathrooms,
        listing.sqft,
        listing.latitude,
        listing.longitude,
        toTimestamp(listing.listedDate),
        listing.status,
        listing.description,
      ]);
    }

    await client.query("COMMIT");
    console.log(`Seeded ${listings.length} listings.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exitCode = 1;
});
