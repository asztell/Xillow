import "./env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDb, createPool } from "./db";

/**
 * Seeds the `listings` table from sample_listings.json.
 *
 * Idempotent: rows are upserted on the composite key (id, source), so the
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
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
}

async function main(): Promise<void> {
  const listings: SampleListing[] = JSON.parse(
    readFileSync(join(projectRoot, "sample_listings.json"), "utf8"),
  );
  const schemaSql = readFileSync(join(projectRoot, "schema.sql"), "utf8");

  const pool = createPool();
  const db = createDb(pool);

  try {
    // schema.sql is a multi-statement DDL script, so it runs through the raw
    // pool rather than the query builder.
    await pool.query(schemaSql);

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

    console.log(`Seeded ${listings.length} listings.`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exitCode = 1;
});
