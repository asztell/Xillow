import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { Listing } from "../types";
import {
  ListingFilter,
  ListingRepository,
} from "../repositories/listingRepository";

/** In-memory repository so the API tests need no database. */
class FakeListingRepository implements ListingRepository {
  lastFilter?: ListingFilter;

  constructor(private readonly listings: Listing[]) {}

  async find(filter: ListingFilter): Promise<Listing[]> {
    this.lastFilter = filter;
    return this.listings.filter((listing) => matches(listing, filter));
  }
}

class ThrowingListingRepository implements ListingRepository {
  async find(): Promise<Listing[]> {
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
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 4, totalPages: 1, hasNext: false, hasPrev: false });
    expect(res.body.results).toHaveLength(4);

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

  it("keeps duplicate rows and annotates them instead of collapsing", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ city: "Springfield" });

    expect(res.status).toBe(200);
    // Nothing is removed: A1, A2 and B7 are all returned.
    expect(res.body.total).toBe(3);

    const byId = new Map<string, Record<string, unknown>>(
      res.body.results.map((listing: { id: string }) => [
        listing.id,
        listing as Record<string, unknown>,
      ]),
    );
    const a1 = byId.get("A1")!;
    const b7 = byId.get("B7")!;

    expect(a1.duplicateGroupId).toBe(b7.duplicateGroupId);
    expect(a1.duplicateGroupId).not.toBeNull();
    expect(a1.potentialDuplicates).toEqual([
      {
        id: "B7",
        source: "MLS_B",
        address: "123 Main Street",
        city: "Springfield",
        state: "VA",
        zip: "22150",
        price: 452000,
        listedDate: SAME_DATE,
      },
    ]);
    expect(a1.isPrimary).toBe(true);
    expect(b7.isPrimary).toBe(false);

    // A2 shares the city but not the location, so it is not flagged.
    expect(byId.get("A2")!.duplicateGroupId).toBeNull();
    expect(byId.get("A2")!.potentialDuplicates).toEqual([]);
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
    expect(res.body.total).toBe(2);
    for (const listing of res.body.results) {
      expect(listing.price).toBeGreaterThanOrEqual(400000);
      expect(listing.price).toBeLessThanOrEqual(460000);
    }
  });

  it("filters by city case-insensitively", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ city: "springfield" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  it("filters by keyword against the description", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ keyword: "pets" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  it("filters by minimum bedrooms", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ minBedrooms: 3 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.results[0].bedrooms).toBe(3);
  });

  it("paginates and reports page boundaries", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));

    const first = await request(app).get("/api/listings").query({ page: 1, pageSize: 2 });
    expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 4, totalPages: 2, hasNext: true, hasPrev: false });
    expect(first.body.results).toHaveLength(2);

    const second = await request(app).get("/api/listings").query({ page: 2, pageSize: 2 });
    expect(second.body).toMatchObject({ page: 2, pageSize: 2, total: 4, totalPages: 2, hasNext: false, hasPrev: true });
    expect(second.body.results).toHaveLength(2);
  });

  it("returns an empty page when paging past the end", async () => {
    const app = createApp(new FakeListingRepository(sampleListings()));
    const res = await request(app).get("/api/listings").query({ page: 99, pageSize: 2 });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
    expect(res.body.total).toBe(4);
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
