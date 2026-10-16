import dotenv from "dotenv";
import path from "node:path";
import { createDb, createPool } from "./db";
import { duplicateKey } from "./lib/dedupe";
import type { Listing } from "./types";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const auditOnly = process.argv.includes("--audit-only");
const BATCH_SIZE = 500;

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
  listed_date: Date;
  status: string;
  description: string | null;
  photos: string[];
  dup_key: string | null;
}

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    source: row.source,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    price: row.price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    sqft: row.sqft,
    latitude: row.latitude,
    longitude: row.longitude,
    listedDate: row.listed_date.toISOString(),
    status: row.status,
    description: row.description,
    photos: row.photos ?? [],
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  try {
    const rows = await db
      .selectFrom("listings")
      .select([
        "id",
        "source",
        "address",
        "city",
        "state",
        "zip",
        "price",
        "bedrooms",
        "bathrooms",
        "sqft",
        "latitude",
        "longitude",
        "listed_date",
        "status",
        "description",
        "photos",
        "dup_key",
      ])
      .execute();

    console.info(`Scanned ${rows.length} listing rows.`);

    let nullKeys = 0;
    let staleKeys = 0;
    let updated = 0;
    const groups = new Map<string, { id: string; source: string }[]>();
    const updates: { key: string; id: string; source: string }[] = [];

    for (const row of rows) {
      const listing = rowToListing(row);
      const computed = duplicateKey(listing);
      const stored = row.dup_key;

      if (computed === null) {
        continue;
      }

      if (stored === null) {
        nullKeys += 1;
        updates.push({ key: computed, id: row.id, source: row.source });
      } else if (stored !== computed) {
        staleKeys += 1;
        updates.push({ key: computed, id: row.id, source: row.source });
      }

      // Track groups for hidden-duplicate detection (audit-only insight).
      const members = groups.get(computed);
      if (members) {
        members.push({ id: row.id, source: row.source });
      } else {
        groups.set(computed, [{ id: row.id, source: row.source }]);
      }
    }

    const hiddenGroups = [...groups.entries()]
      .filter(([, members]) => members.length >= 2)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    if (auditOnly) {
      console.info("\n--- AUDIT ONLY (no writes) ---");
      console.info(`Rows with missing dup_key: ${nullKeys}`);
      console.info(`Rows with stale dup_key:   ${staleKeys}`);
      console.info(
        `Hidden duplicate groups (>=2 rows sharing a computed key): ${hiddenGroups.length}`,
      );
      for (const [key, members] of hiddenGroups) {
        console.info(
          `  ${key}: ${members.map((m) => `${m.id}/${m.source}`).join(", ")}`,
        );
      }
      console.info("Would write", updates.length, "row(s).");
      return;
    }

    // Batched updates.
    for (let start = 0; start < updates.length; start += BATCH_SIZE) {
      const chunk = updates.slice(start, start + BATCH_SIZE);
      await db.transaction().execute(async (trx) => {
        for (const u of chunk) {
          await trx
            .updateTable("listings")
            .set({ dup_key: u.key })
            .where("id", "=", u.id)
            .where("source", "=", u.source)
            .execute();
        }
      });
      updated += chunk.length;
      console.info(`Updated ${updated}/${updates.length} rows...`);
    }

    console.info(
      `\nDone. Filled ${nullKeys} null keys, repaired ${staleKeys} stale keys, wrote ${updated} row(s).`,
    );
    if (hiddenGroups.length > 0) {
      console.info(
        `Found ${hiddenGroups.length} hidden duplicate group(s) sharing a computed dup_key.`,
      );
    }
  } finally {
    await db.destroy();
  }
}

void main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exitCode = 1;
});