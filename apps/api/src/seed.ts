import "./env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDb, createPool } from "./db";
import {
  distinctKeyCount,
  findDuplicateKeys,
  upsertListings,
  type SampleListing,
} from "./lib/seeding";

/**
 * Seeds the `listings` table from sample_listings.json.
 *
 * Idempotent: rows are upserted on the composite key (id, source), so the
 * script can be re-run safely. It also applies schema.sql first so it works
 * even without the Docker init hook.
 *
 * Repeated keys within the batch are reported: the upsert keeps the last
 * occurrence, so a silent overwrite would otherwise hide an accidental
 * duplicate or a genuine update.
 */

// src/seed.ts -> project root, and dist/seed.js -> project root.
const projectRoot = join(__dirname, "..");

/** Warns about repeated `(id, source)` keys. Returns the number reported. */
function reportDuplicateKeys(listings: SampleListing[]): number {
  const duplicates = findDuplicateKeys(listings);
  for (const duplicate of duplicates) {
    const detail = duplicate.conflicting
      ? "conflicting values - the last entry wins"
      : "identical entries";
    console.warn(
      `[seed] duplicate key (id=${duplicate.id}, source=${duplicate.source}) ` +
        `appears ${duplicate.count}x (${detail}).`,
    );
  }
  return duplicates.length;
}

async function main(): Promise<void> {
  const listings = JSON.parse(
    readFileSync(join(projectRoot, "sample_listings.json"), "utf8"),
  ) as SampleListing[];
  const schemaSql = readFileSync(join(projectRoot, "schema.sql"), "utf8");

  const duplicateCount = reportDuplicateKeys(listings);

  const pool = createPool();
  const db = createDb(pool);

  try {
    // schema.sql is a multi-statement DDL script, so it runs through the raw
    // pool rather than the query builder.
    await pool.query(schemaSql);

    await upsertListings(db, listings);

    const distinct = distinctKeyCount(listings);
    const summary =
      distinct === listings.length
        ? `${distinct} listings`
        : `${distinct} distinct listings (${listings.length} rows, ${duplicateCount} duplicate key(s))`;
    console.log(`Seeded ${summary}.`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exitCode = 1;
});
