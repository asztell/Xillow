import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { Listing, ListingDetail, ListingSource } from "../types";
import { duplicateKey } from "../lib/dedupe";
import {
  ListingFilter,
  ListingRepository,
} from "../repositories/listingRepository";

/**
 * In-memory repository so the API tests need no database. Mirrors
 * `KyselyListingRepository`: it returns the newest row of each duplicate group
 * (ties by id, then source) chosen *before* the filter is applied. Fixtures omit
 * `dup_key`, so it is computed on the fly the way ingest would.
 */
class FakeListingRepository implements ListingRepository {
  lastFilter?: ListingFilter;

  constructor(private readonly listings: Listing[]) {}

  async find(filter: ListingFilter): Promise<Listing[]> {
    this.lastFilter = filter;
    return mostRecentPerGroup(this.listings).filter((listing) =>
      matches(listing, filter),
    );
  }

  async findDetail(id: string, source: string): Promise<ListingDetail | null> {
    const row = this.listings.find((l) => l.id === id && l.source === source);
    if (!row) return null;

    const key = keyOf(row);
    const siblings =
      key === null
        ? [row]
        : this.listings
            .filter((listing) => keyOf(listing) === key)
            .sort((a, b) => {
              const aTime = Date.parse(a.listedDate);
              const bTime = Date.parse(b.listedDate);
              if (aTime !== bTime) return bTime - aTime;
              if (a.id !== b.id) return a.id < b.id ? -1 : 1;
              return a.source < b.source ? -1 : 1;
            });

    return {
      ...row,
      sources: siblings.map((sibling, index) => toSource(sibling, index === 0)),
    };
  }
}

/** Projects a listing into the lightweight shape the detail response carries. */
function toSource(listing: Listing, isCurrent: boolean): ListingSource {
  return {
    id: listing.id,
    source: listing.source,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    price: listing.price,
    listedDate: listing.listedDate,
    status: listing.status,
    isCurrent,
  };
}

/** True when `candidate` outranks `current` as a group's representative. */
function isNewer(candidate: Listing, current: Listing): boolean {
  const candidateTime = Date.parse(candidate.listedDate);
  const currentTime = Date.parse(current.listedDate);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  if (candidate.id !== current.id) return candidate.id < current.id;
  return candidate.source < current.source;
}

function keyOf(listing: Listing): string | null {
  return listing.dup_key ?? duplicateKey(listing);
}

function mostRecentPerGroup(listings: Listing[]): Listing[] {
  const winners = new Map<string, Listing>();
  for (const listing of listings) {
    const key = keyOf(listing);
    if (key === null) continue;
    const current = winners.get(key);
    if (current === undefined || isNewer(listing, current)) {
      winners.set(key, listing);
    }
  }
  const winningIds = new Set(
    [...winners.values()].map((listing) => `${listing.id}\u0000${listing.source}`),
  );
  return listings.filter((listing) => {
    const key = keyOf(listing);
    if (key === null) return true;
    return winningIds.has(`${listing.id}\u0000${listing.source}`);
  });
}

class ThrowingListingRepository implements ListingRepository {
  async find(): Promise<Listing[]> {
    throw new Error("database unavailable");
  }

  async findDetail(): Promise<ListingDetail | null> {
    throw new Error("database unavailable");
  }
}

function matches(listing: Listing, filter: ListingFilter): boolean {
  if (filter.minPrice !== undefined && listing.price < filter.minPrice) return false;
  if (filter.maxPrice !== undefined && listing.price > filter.maxPrice) return false;
  if (
    filter.minBedrooms !== undefined &&
    (listing.bedrooms ?? 0) < filter.minBedrooms
  ) {
    return false;
  }
  if (
    filter.city !== undefined &&
    !listing.city.toLowerCase().includes(filter.city.toLowerCase())
  ) {
    return false;
  }
  if (
    filter.keyword !== undefined &&
    !(listing.description ?? "").toLowerCase().includes(filter.keyword.toLowerCase())
  ) {
    return false;
  }
  return true;
}

const SAME_DATE = "2026-08-29T00:00:00.000Z";

function makeListing(overrides: Partial<Listing> = {}): Listing {
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
    listedDate: SAME_DATE,
    status: "active",
    description: "Bright condo near transit",
    ...overrides,
  };
}

/** Same listedDate everywhere => ordering is driven purely by budget proximity. */
function sampleListings(): Listing[] {
  return [
    makeListing({ id: "A1", source: "MLS_A", address: "123 Main St", price: 450000, bedrooms: 2, city: "Springfield" }),
    makeListing({ id: "A2", source: "MLS_A", address: "456 Oak Ave", price: 525000, bedrooms: 3, city: "Springfield", description: "Fenced yard, pets allowed", latitude: 38.7791, longitude: -77.1901 }),
    makeListing({ id: "A3", source: "MLS_A", address: "789 Pine Rd", price: 399000, bedrooms: 2, city: "Fairfax", description: "Cozy starter home, no pets", latitude: 38.8462, longitude: -77.3064 }),
    // Same geocode as A1 => flagged as a cross-source duplicate.
    makeListing({ id: "B7", source: "MLS_B", address: "123 Main Street", price: 452000, bedrooms: 2, city: "Springfield", description: "Top floor condo, pets allowed" }),
  ];
}

describe("GET /api/listings", () => {
  it("returns a paginated, ranked result set", async () => {
    const repo = new FakeListingRepository(sampleListings());
    const app = createApp(repo);

    const res = await request(app).get("/api/listings").query({ targetBudget: 450000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 3, totalPages: 1, hasNext: false, hasPrev: false });
    expect(res.body.results).toHaveLength(3);

    // Sorted by descending score; the near-budget listings come first.
    const scores = res.body.results.map((l: { score: number }) => l.score);
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));

    // Each result carries the fields the UI needs.
    const first = res.body.results[0];
    expect(first).toHaveProperty("address");
    expect(first).toHaveProperty("price");
    expect(first).toHaveProperty("bedrooms");
    expect(typeof first.score).toBe("number");
  });

  it("keeps only the most recent row of a duplicate group", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ city: "Springfield" });

    expect(res.status).toBe(200);
    // A1, A2 and B7 match; A1/B7 are the same home, so only the newest (A1) shows.
    expect(res.body.total).toBe(2);

    const ids = res.body.results.map((listing: { id: string }) => listing.id);
    expect(ids).toContain("A1");
    expect(ids).not.toContain("B7");
    expect(ids).toContain("A2");

    // No duplicate bookkeeping crosses the API boundary.
    const [first] = res.body.results;
    expect(first).not.toHaveProperty("duplicateGroupId");
    expect(first).not.toHaveProperty("potentialDuplicates");
    expect(first).not.toHaveProperty("isPrimary");
  });

  it("applies filters to the group's newest row, hiding the property otherwise", async () => {
    // One three-feed property: A1 (450k), B7 (452k), C8 (448k, newest).
    const listings = [
      makeListing({ id: "A1", source: "MLS_A", address: "123 Main St", price: 450000, listedDate: "2026-08-29T00:00:00.000Z" }),
      makeListing({ id: "B7", source: "MLS_B", address: "123 Main Street", price: 452000, listedDate: "2026-08-27T00:00:00.000Z" }),
      makeListing({ id: "C8", source: "MLS_C", address: "123 Main Street", price: 448000, listedDate: "2026-09-08T00:00:00.000Z" }),
    ];
    const app = createApp(new FakeListingRepository(listings));

    // The newest row (C8, 448k) is the property's representative.
    const all = await request(app).get("/api/listings");
    expect(all.body.results.map((l: { id: string }) => l.id)).toEqual(["C8"]);

    const wide = await request(app)
      .get("/api/listings")
      .query({ minPrice: 448000, maxPrice: 452000 });
    expect(wide.body.results.map((l: { id: string }) => l.id)).toEqual(["C8"]);

    // A1 (450k) and B7 (452k) fall in range but are not the representative, so
    // the property is hidden rather than shown as an older sibling.
    const mid = await request(app)
      .get("/api/listings")
      .query({ minPrice: 450000, maxPrice: 452000 });
    expect(mid.body.total).toBe(0);
    expect(mid.body.results).toEqual([]);

    const narrow = await request(app)
      .get("/api/listings")
      .query({ minPrice: 452000, maxPrice: 452000 });
    expect(narrow.body.total).toBe(0);
  });

  it("forwards all filters to the repository", async () => {
    const repo = new FakeListingRepository(sampleListings());
    const app = createApp(repo);

    await request(app).get("/api/listings").query({
      minPrice: 400000,
      maxPrice: 500000,
      minBedrooms: 2,
      city: "Springfield",
      keyword: "condo",
    });

    expect(repo.lastFilter).toEqual({
      minPrice: 400000,
      maxPrice: 500000,
      minBedrooms: 2,
      city: "Springfield",
      keyword: "condo",
    });
  });

  it("filters by price range", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ minPrice: 400000, maxPrice: 460000 });
    expect(res.status).toBe(200);
    // The A1/B7 group is represented by A1 (450k); B7 (452k) is dropped before
    // filtering, so only A1 is in range.
    expect(res.body.total).toBe(1);
    for (const listing of res.body.results) {
      expect(listing.price).toBeGreaterThanOrEqual(400000);
      expect(listing.price).toBeLessThanOrEqual(460000);
    }
  });

  it("filters by city case-insensitively", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ city: "springfield" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it("filters by keyword against the description", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ keyword: "pets" });
    expect(res.status).toBe(200);
    // The representative of the A1/B7 group is A1, whose description has no
    // "pets"; B7 is dropped before the keyword filter runs, so only A2 and A3
    // remain - the property is hidden, not shown as its older sibling.
    expect(res.body.total).toBe(2);
  });

  it("filters by minimum bedrooms", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ minBedrooms: 3 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.results[0].bedrooms).toBe(3);
  });

  it("sorts by price ascending when asked", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ sort: "price_asc" });

    expect(res.status).toBe(200);
    // A1=450k, A2=525k, A3=399k (B7 collapses into A1) -> cheapest first.
    const prices: number[] = res.body.results.map((l: { price: number }) => l.price);
    expect(prices).toEqual([399000, 450000, 525000]);
  });

  it("rejects an unknown sort value with 400", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ sort: "popular" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
    expect(res.body.error.field).toBe("sort");
  });

  it("paginates and reports page boundaries", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));

    const first = await request(app).get("/api/listings").query({ page: 1, pageSize: 2 });
    expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2, hasNext: true, hasPrev: false });
    expect(first.body.results).toHaveLength(2);

    const second = await request(app).get("/api/listings").query({ page: 2, pageSize: 2 });
    expect(second.body).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2, hasNext: false, hasPrev: true });
    expect(second.body.results).toHaveLength(1);
  });

  it("returns an empty page when paging past the end", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ page: 99, pageSize: 2 });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.total).toBe(3);
    expect(res.body.hasNext).toBe(false);
  });

  it("returns a clean empty result (not an error) when nothing matches", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ city: "Atlantis" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, totalPages: 0, hasNext: false, hasPrev: false });
    expect(res.body.results).toEqual([]);
  });

  it("rejects minPrice greater than maxPrice with 400", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ minPrice: 600000, maxPrice: 400000 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
    expect(res.body.error.field).toBe("minPrice");
  });

  it("rejects pageSize of zero with 400", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ pageSize: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("pageSize");
  });

  it("rejects a non-numeric price with 400", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ minPrice: "lots" });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("minPrice");
  });

  it("returns 500 when the repository fails", async () => {
    const app = createApp(new ThrowingListingRepository());
    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("GET /api/listings/:source/:id", () => {
  /** One three-feed property, newest last-created (C8) but listed first. */
  function threeWayGroup(): Listing[] {
    return [
      makeListing({ id: "A1", source: "MLS_A", address: "123 Main St", price: 450000, listedDate: "2026-08-29T00:00:00.000Z" }),
      makeListing({ id: "B7", source: "MLS_B", address: "123 Main Street", price: 452000, listedDate: "2026-08-27T00:00:00.000Z" }),
      makeListing({ id: "C8", source: "MLS_C", address: "123 Main Street", price: 448000, listedDate: "2026-09-08T00:00:00.000Z" }),
    ];
  }

  it("returns the requested listing plus its siblings, newest first", async () => {
    const app = createApp(new FakeListingRepository(threeWayGroup()));
    const res = await request(app).get("/api/listings/MLS_C/C8");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "C8", source: "MLS_C", price: 448000 });

    expect(res.body.sources.map((s: ListingSource) => s.id)).toEqual([
      "C8",
      "A1",
      "B7",
    ]);
    // The newest row is the one the grid shows.
    expect(res.body.sources[0]).toMatchObject({ id: "C8", isCurrent: true });
    expect(res.body.sources[1].isCurrent).toBe(false);
    expect(res.body.sources[2].isCurrent).toBe(false);
  });

  it("still returns the whole group when an older sibling is requested", async () => {
    const app = createApp(new FakeListingRepository(threeWayGroup()));
    const res = await request(app).get("/api/listings/MLS_B/B7");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("B7");
    // The newest sibling is still flagged as the current listing.
    expect(res.body.sources.map((s: ListingSource) => s.id)).toEqual([
      "C8",
      "A1",
      "B7",
    ]);
    expect(res.body.sources[0].isCurrent).toBe(true);
    expect(res.body.sources.find((s: ListingSource) => s.id === "B7").isCurrent).toBe(
      false,
    );
  });

  it("returns a single source for a listing with no duplicates", async () => {
    const solo = makeListing({ id: "A9", source: "MLS_A", latitude: 40, longitude: -80 });
    const app = createApp(new FakeListingRepository([solo]));
    const res = await request(app).get("/api/listings/MLS_A/A9");

    expect(res.status).toBe(200);
    expect(res.body.sources).toEqual([
      expect.objectContaining({ id: "A9", source: "MLS_A", isCurrent: true }),
    ]);
  });

  it("returns 404 for an unknown listing", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings/MLS_A/NOPE");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 when the repository fails", async () => {
    const app = createApp(new ThrowingListingRepository());
    const res = await request(app).get("/api/listings/MLS_A/A1");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
